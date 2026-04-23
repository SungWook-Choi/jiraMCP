import { Module } from '@nestjs/common';

import { ConfigCliService } from './config-cli.service.js';

@Module({
  providers: [ConfigCliService],
})
export class ConfigCliModule {}
