import { Module } from '@nestjs/common';

import { JiraModule } from '../jira/jira.module.js';
import { QueryModule } from '../query/query.module.js';
import { SummaryModule } from '../summary/summary.module.js';
import { ApiController } from './api.controller.js';
import { ApiService } from './api.service.js';

@Module({
  imports: [JiraModule, QueryModule, SummaryModule],
  controllers: [ApiController],
  providers: [ApiService],
})
export class ApiModule {}
