import { Body, Controller, Get, Post } from '@nestjs/common';

import { ApiService } from './api.service.js';
import { parseJiraSearchRequest } from './jira-search.request.js';

@Controller()
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @Get('health')
  getHealth() {
    return this.apiService.getHealthStatus();
  }

  @Post('jira/search')
  async searchJira(@Body() body: unknown) {
    const request = parseJiraSearchRequest(body);

    return this.apiService.searchJira(request);
  }
}
