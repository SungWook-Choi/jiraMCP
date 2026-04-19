import { Module } from '@nestjs/common';

import { SummaryService } from './summary.service.js';

@Module({
  providers: [SummaryService],
  exports: [SummaryService],
})
export class SummaryModule {}
