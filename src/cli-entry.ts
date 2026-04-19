import 'reflect-metadata';

import { CliService } from './cli/cli.service.js';
import { createAppContext } from './bootstrap/app-context.js';
import { loadEnvFile } from './config/env-loader.js';

async function bootstrap() {
  loadEnvFile();

  const app = await createAppContext();

  try {
    const cliService = app.get(CliService);
    await cliService.run();
  } finally {
    await app.close();
  }
}

void bootstrap();
