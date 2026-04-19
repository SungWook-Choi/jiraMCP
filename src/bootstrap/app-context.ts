import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module.js';

export async function createAppContext() {
  return NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
}
