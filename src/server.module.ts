import { Module } from '@nestjs/common';

import { AppModule } from './app.module.js';
import { WeeklyReportModule } from './weekly-report/weekly-report.module.js';

@Module({
  imports: [AppModule, WeeklyReportModule],
})
export class ServerModule {}
