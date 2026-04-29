import { Module } from '@nestjs/common';

import { QueryModule } from '../query/query.module.js';
import { CliApiClient } from './cli-api.client.js';
import { CliService } from './cli.service.js';

@Module({
  imports: [QueryModule],
  providers: [CliApiClient, CliService],
  exports: [CliApiClient, CliService],
})
export class CliModule {}
