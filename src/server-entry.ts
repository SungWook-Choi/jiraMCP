import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import {
  clearServerRuntimeState,
  formatServerAddress,
  getServerRuntimePathsFromEnv,
  readServerRuntimeState,
  writeServerRuntimeState,
} from './bootstrap/server-runtime.js';
import { loadEnvFile } from './config/env-loader.js';

async function bootstrap() {
  const runtimePaths = getServerRuntimePathsFromEnv();
  loadEnvFile();
  logLifecycle('Server starting.', runtimePaths !== null);

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  const host = parseHost(process.env.HOST);
  const port = parsePort(process.env.PORT);
  const serverAddress = formatServerAddress(host, port) ?? `http://${host}:${port}`;
  let shuttingDown = false;

  const shutdown = async (reason: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logLifecycle(`Server stopping (${reason}).`, runtimePaths !== null);

    try {
      await app.close();
    } finally {
      if (runtimePaths !== null) {
        clearServerRuntimeState(runtimePaths, process.pid);
      }

      logLifecycle(`Server stopped (${reason}).`, runtimePaths !== null);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM').finally(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT').finally(() => process.exit(0));
  });

  process.on('uncaughtException', (error) => {
    process.stderr.write(`[${new Date().toISOString()}] Server error: ${formatErrorMessage(error)}\n`);

    void shutdown('uncaughtException').finally(() => process.exit(1));
  });

  process.on('unhandledRejection', (error) => {
    process.stderr.write(
      `[${new Date().toISOString()}] Server rejection: ${formatErrorMessage(error)}\n`,
    );

    void shutdown('unhandledRejection').finally(() => process.exit(1));
  });

  await app.listen(port, host);

  if (runtimePaths !== null) {
    const currentState = readServerRuntimeState(runtimePaths);

    writeServerRuntimeState(runtimePaths, {
      pid: process.pid,
      status: 'running',
      startedAt: currentState?.startedAt ?? new Date().toISOString(),
      cwd: process.cwd(),
      logPath: runtimePaths.logPath,
      host,
      port,
    });
  }

  logLifecycle(`Listening on ${serverAddress}.`, runtimePaths !== null);
}

function parsePort(value?: string): number {
  const parsed = Number.parseInt(value ?? '3000', 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 3000;
  }

  return parsed;
}

function parseHost(value?: string): string {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : '127.0.0.1';
}

function logLifecycle(message: string, backgroundMode: boolean): void {
  const line = `[${new Date().toISOString()}] ${message}\n`;

  process.stdout.write(backgroundMode ? line : `qwen-jira API ${message.toLowerCase()}\n`);
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

void bootstrap().catch((error) => {
  process.stderr.write(`[${new Date().toISOString()}] Server start failed: ${formatErrorMessage(error)}\n`);

  const runtimePaths = getServerRuntimePathsFromEnv();

  if (runtimePaths !== null) {
    clearServerRuntimeState(runtimePaths, process.pid);
  }

  process.exit(1);
});
