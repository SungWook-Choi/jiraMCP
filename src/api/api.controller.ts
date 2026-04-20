import { BadRequestException } from '@nestjs/common';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';

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

  @Get('jira/projects')
  async lookupProjects(@Query('query') query: string) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('query parameter is required.');
    }

    return this.apiService.lookupProjects(query.trim());
  }
}
