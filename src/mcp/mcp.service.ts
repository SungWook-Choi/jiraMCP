import { Injectable } from '@nestjs/common';

import { QueryService } from '../query/query.service.js';

@Injectable()
export class McpService {
  constructor(private readonly queryService: QueryService) {}

  getServerDescriptor() {
    return {
      name: 'qwen3-jira-mcp',
      status: 'scaffold',
      sharedQueryShape: this.queryService.createEmptyQuery(),
    };
  }
}
