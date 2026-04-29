import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { loadEnvFile } from './config/env-loader.js';
import { McpService } from './mcp/mcp.service.js';
import { McpStdioServer } from './mcp/mcp-stdio.server.js';

async function bootstrap() {
  loadEnvFile();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const mcpService = app.get(McpService);
  const mcpServer = new McpStdioServer(mcpService);

  mcpServer.start();

  const shutdown = async () => {
    mcpServer.stop();
    await app.close();
  };

  process.stdin.once('end', () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });

  process.once('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });
}

void bootstrap();
