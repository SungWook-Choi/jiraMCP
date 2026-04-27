import { Module } from '@nestjs/common';

import { JiraModule } from '../jira/jira.module.js';
import { WeeklyReportSchedulerService } from './weekly-report-scheduler.service.js';

@Module({
  imports: [JiraModule],
  providers: [WeeklyReportSchedulerService],
})
export class WeeklyReportModule {}
