import 'reflect-metadata';

import { createAppContext } from './bootstrap/app-context.js';
import { loadEnvFile } from './config/env-loader.js';
import { McpService } from './mcp/mcp.service.js';

async function bootstrap() {
  loadEnvFile();

  const app = await createAppContext();

  try {
    const mcpService = app.get(McpService);
    process.stdout.write(`${JSON.stringify(mcpService.getServerDescriptor(), null, 2)}\n`);
  } finally {
    await app.close();
  }
}

void bootstrap();
