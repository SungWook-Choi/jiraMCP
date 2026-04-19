import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { loadEnvFile } from './config/env-loader.js';

async function bootstrap() {
  loadEnvFile();

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  const host = parseHost(process.env.HOST);
  const port = parsePort(process.env.PORT);

  await app.listen(port, host);

  process.stdout.write(`qwen-jira API listening on http://${host}:${port}\n`);
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

void bootstrap();
