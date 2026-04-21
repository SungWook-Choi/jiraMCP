import { Injectable } from '@nestjs/common';

import { getMissingJiraEnv } from '../config/jira-settings.js';
import { JiraService } from '../jira/jira.service.js';
import { QueryService } from '../query/query.service.js';
import { SummaryService } from '../summary/summary.service.js';
import { JiraCommentCreateHttpRequest, JiraSearchHttpRequest } from './jira-search.request.js';

@Injectable()
export class ApiService {
  constructor(
    private readonly jiraService: JiraService,
    private readonly queryService: QueryService,
    private readonly summaryService: SummaryService,
  ) {}

  getHealthStatus() {
    const missingEnv = getMissingJiraEnv(process.env);

    return {
      status: 'ok',
      jiraConfigured: missingEnv.length === 0,
      missingEnv,
    };
  }

  async lookupProjects(query: string) {
    return this.jiraService.lookupProjects(query);
  }

  async searchIssuesByTitle(query: string) {
    return this.jiraService.searchIssuesByTitle(query);
  }

  async getIssueByKey(issueKey: string) {
    return this.jiraService.getIssueByKey(issueKey);
  }

  async createComment(request: JiraCommentCreateHttpRequest) {
    return this.jiraService.createComment(request);
  }

  async searchJira(request: JiraSearchHttpRequest) {
    const query = this.queryService.createQuery(request);
    const result = await this.jiraService.searchIssues(query);
    const consoleRendered = this.summaryService.renderConsoleIssues(result.issues);
    const markdownRendered = this.summaryService.renderMarkdownResult(query, result);
    const rendered =
      query.output.format === 'markdown'
        ? markdownRendered
        : consoleRendered;

    return {
      query,
      request: result.request,
      total: result.total,
      issues: result.issues,
      consoleRendered,
      markdownRendered,
      rendered,
    };
  }
}
