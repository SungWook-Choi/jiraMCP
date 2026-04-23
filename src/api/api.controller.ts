import { BadRequestException } from '@nestjs/common';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { ApiService } from './api.service.js';
import { parseJiraCommentCreateRequest, parseJiraSearchRequest } from './jira-search.request.js';

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

  @Get('jira/issues')
  async searchIssuesByTitle(@Query('query') query: string) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('query 매개변수가 필요합니다.');
    }

    return this.apiService.searchIssuesByTitle(query.trim());
  }

  @Get('jira/issues/:issueKey')
  async getIssueByKey(@Param('issueKey') issueKey: string) {
    if (!issueKey || issueKey.trim().length === 0) {
      throw new BadRequestException('issueKey 매개변수가 필요합니다.');
    }

    return this.apiService.getIssueByKey(issueKey.trim());
  }

  @Get('jira/projects')
  async lookupProjects(@Query('query') query: string) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('query 매개변수가 필요합니다.');
    }

    return this.apiService.lookupProjects(query.trim());
  }

  @Post('jira/comments')
  async createComment(@Body() body: unknown) {
    const request = parseJiraCommentCreateRequest(body);

    return this.apiService.createComment(request);
  }
}
