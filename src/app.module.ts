import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ApiModule } from './api/api.module.js';
import { CliModule } from './cli/cli.module.js';
import { jiraConfig } from './config/jira.config.js';
import { JiraModule } from './jira/jira.module.js';
import { McpModule } from './mcp/mcp.module.js';
import { QueryModule } from './query/query.module.js';
import { SummaryModule } from './summary/summary.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jiraConfig],
    }),
    ApiModule,
    JiraModule,
    QueryModule,
    SummaryModule,
    CliModule,
    McpModule,
  ],
})
export class AppModule {}
