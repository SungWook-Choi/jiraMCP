import { Injectable } from '@nestjs/common';

import { JiraSearchResult } from '../jira/jira.service.js';
import { QuerySchema } from '../query/query.schema.js';

@Injectable()
export class SummaryService {
  renderConsoleIssues(issues: JiraSearchResult['issues']): string {
    if (issues.length === 0) {
      return 'No issues matched the current query.';
    }

    return issues
      .map((issue, index) => {
        const lines = [
          `${index + 1}. ${issue.key} [${issue.status}]`,
          `   Summary: ${issue.summary}`,
          `   Assignee: ${issue.assignee ?? '(unassigned)'}`,
          `   Project: ${this.formatProject(issue.projectKey, issue.projectName)}`,
          `   Updated: ${issue.updated ?? '(not provided)'}`,
          ...this.renderConsoleWeeklyIssues(issue.weeklyIssues),
        ];

        return lines.join('\n');
      })
      .join('\n\n');
  }

  renderMarkdownResult(query: QuerySchema, result: JiraSearchResult): string {
    const filters = this.renderQueryFilters(query);
    const headerLines = [
      '# Jira Search Result',
      '',
      `- Mode: \`${query.mode}\``,
      `- Period: \`${query.period}\``,
      `- Assignees: ${filters.assignees}`,
      `- Projects: ${filters.projects}`,
      `- Prepared JQL: \`${result.request.jql}\``,
      `- Returned issues: ${this.renderIssueCount(result)}`,
      '',
    ];

    if (result.issues.length === 0) {
      return [...headerLines, 'No issues matched the current query.', ''].join('\n');
    }

    const issueSections = result.issues.map((issue, index) => {
      const lines = [
        `## ${index + 1}. ${issue.key}`,
        '',
        `- Summary: ${issue.summary}`,
        `- Status: ${issue.status}`,
        `- Assignee: ${issue.assignee ?? '(unassigned)'}`,
        `- Project: ${this.formatProject(issue.projectKey, issue.projectName)}`,
        `- Updated: ${issue.updated ?? '(not provided)'}`,
        '',
        '### Description',
        '',
        issue.description ?? '(not provided)',
        '',
        '### 주간 이슈',
        '',
        ...this.renderMarkdownWeeklyIssues(issue.weeklyIssues),
      ];

      return lines.join('\n');
    });

    return [...headerLines, issueSections.join('\n\n')].join('\n');
  }

  private renderQueryFilters(query: QuerySchema): {
    assignees: string;
    projects: string;
  } {
    return {
      assignees:
        query.assignees.length > 0
          ? query.assignees.map((assignee) => `\`${assignee}\``).join(', ')
          : '(not set)',
      projects:
        query.projectKeys.length > 0
          ? query.projectKeys.map((projectKey) => `\`${projectKey}\``).join(', ')
          : '(not set)',
    };
  }

  private renderIssueCount(result: JiraSearchResult): string {
    if (result.total > result.issues.length) {
      return `${result.issues.length} of ${result.total}`;
    }

    return `${result.issues.length}`;
  }

  private renderConsoleWeeklyIssues(weeklyIssues: string[]): string[] {
    if (weeklyIssues.length === 0) {
      return ['   주간 이슈: (not found)'];
    }

    return [
      '   주간 이슈:',
      ...weeklyIssues.map((weeklyIssue) => `     - ${weeklyIssue}`),
    ];
  }

  private renderMarkdownWeeklyIssues(weeklyIssues: string[]): string[] {
    if (weeklyIssues.length === 0) {
      return ['- (not found)'];
    }

    return weeklyIssues.map((weeklyIssue) => `- ${weeklyIssue}`);
  }

  private formatProject(projectKey: string | null, projectName: string | null): string {
    if (projectKey && projectName) {
      return `${projectKey} - ${projectName}`;
    }

    if (projectKey) {
      return projectKey;
    }

    if (projectName) {
      return projectName;
    }

    return '(not provided)';
  }
}
