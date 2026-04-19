import { Module } from '@nestjs/common';

import { QueryService } from './query.service.js';

@Module({
  providers: [QueryService],
  exports: [QueryService],
})
export class QueryModule {}
