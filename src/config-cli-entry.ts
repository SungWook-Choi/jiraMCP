import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { ConfigCliModule } from './config-cli/config-cli.module.js';
import { ConfigCliService } from './config-cli/config-cli.service.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(ConfigCliModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const configCliService = app.get(ConfigCliService);
    await configCliService.run();
  } finally {
    await app.close();
  }
}

void bootstrap();
