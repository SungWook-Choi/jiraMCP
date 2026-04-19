import { Module } from '@nestjs/common';

import { JiraModule } from '../jira/jira.module.js';
import { QueryModule } from '../query/query.module.js';
import { SummaryModule } from '../summary/summary.module.js';
import { McpService } from './mcp.service.js';

@Module({
  imports: [JiraModule, QueryModule, SummaryModule],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
