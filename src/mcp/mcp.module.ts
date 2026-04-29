import { Module } from '@nestjs/common';

import { CliModule } from '../cli/cli.module.js';
import { McpService } from './mcp.service.js';

@Module({
  imports: [CliModule],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
