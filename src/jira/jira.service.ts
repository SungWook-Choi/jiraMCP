import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JiraSettings } from '../config/jira-settings.js';
import { QuerySchema } from '../query/query.schema.js';

export interface JiraSearchRequest {
  jql: string;
  query: QuerySchema;
}

export interface JiraProjectCandidate {
  key: string;
  name: string;
}

export interface JiraIssueCandidate {
  key: string;
  summary: string;
  status: string;
  projectKey: string | null;
  projectName: string | null;
}

export interface JiraCommentCreateRequest {
  issueKey: string;
  body: string;
}

export interface JiraCommentCreateResponse {
  issueKey: string;
  commentId: string;
}

export interface JiraSearchResult {
  issues: Array<{
    key: string;
    summary: string;
    status: string;
    assignee: string | null;
    projectKey: string | null;
    projectName: string | null;
    updated: string | null;
    description: string | null;
    comments: string[];
    weeklyIssues: string[];
  }>;
  request: JiraSearchRequest;
  total: number;
}

interface JiraSearchResponse {
  issues?: JiraIssueResponse[];
  total?: number;
  nextPageToken?: string;
}

interface JiraCommentResponse {
  id?: string;
}

interface JiraMyselfResponse {
  accountId?: string;
}

interface JiraUserSearchResponseItem {
  accountId?: string;
  displayName?: string;
  emailAddress?: string;
  name?: string;
  key?: string;
}

interface JiraChangelogItem {
  field: string;
}

interface JiraChangelogHistory {
  created: string;
  items: JiraChangelogItem[];
}

interface JiraIssueResponse {
  key?: string;
  fields?: {
    summary?: string;
    status?: {
      name?: string;
    };
    assignee?: {
      displayName?: string;
    } | null;
    project?: {
      key?: string;
      name?: string;
    };
    created?: string;
    updated?: string;
    description?: unknown;
    comment?: {
      comments?: Array<{
        body?: unknown;
      }>;
    };
  };
  changelog?: {
    histories?: JiraChangelogHistory[];
  };
}

const JIRA_SEARCH_PATH = '/rest/api/3/search/jql';
const JIRA_ISSUE_PATH = '/rest/api/3/issue';
const JIRA_MYSELF_PATH = '/rest/api/3/myself';
const JIRA_USER_SEARCH_PATH = '/rest/api/3/user/search';
const JIRA_PROJECT_SEARCH_PATH = '/rest/api/3/project/search';
const JIRA_WEEKLY_REPORT_SEARCH_PAGE_SIZE = 50;
const CHANGELOG_TRACKED_FIELDS = new Set([
  'status',
  'assignee',
  'summary',
  'description',
  'timespent',
  'timeestimate',
  'timeoriginalestimate',
]);
const JIRA_SEARCH_FIELDS = [
  'summary',
  'status',
  'assignee',
  'project',
  'created',
  'updated',
  'description',
  'comment',
];
const JIRA_ISSUE_LOOKUP_FIELDS = ['summary', 'status', 'project'];
const JIRA_MAX_RESULTS = 20;
const JIRA_ISSUE_LOOKUP_MAX_RESULTS = 10;
const WEEKLY_ISSUE_TAG = '[주간 이슈]';
const ASSIGNEE_ALL_EXCLUDED_STATUSES = ['해야 할 일', 'To Do', '완료', 'Done'] as const;

@Injectable()
export class JiraService {
  constructor(private readonly configService: ConfigService) {}

  getSettings(): JiraSettings {
    return {
      baseUrl: this.configService.get<string>('jira.baseUrl', ''),
      email: this.configService.get<string>('jira.email', ''),
      apiToken: this.configService.get<string>('jira.apiToken', ''),
      projectKey: this.configService.get<string>('jira.projectKey'),
      defaultPeriod: this.configService.get<string>('jira.defaultPeriod', 'this_week'),
    };
  }

  describeConnection(): string {
    const settings = this.getSettings();

    return `Jira base URL: ${settings.baseUrl || '(not configured)'}`;
  }

  async searchIssues(query: QuerySchema): Promise<JiraSearchResult> {
    const settings = this.getSettings();
    const request = await this.buildSearchRequest(query, settings);
    const response = await fetch(this.buildSearchUrl(settings.baseUrl), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: this.createAuthorizationHeader(settings),
      },
      body: JSON.stringify({
        jql: request.jql,
        fields: JIRA_SEARCH_FIELDS,
        maxResults: JIRA_MAX_RESULTS,
        expand: 'changelog',
      }),
    });

    if (!response.ok) {
      const errorBody = await this.readResponseBody(response);

      throw new Error(
        `Jira search request failed (${response.status} ${response.statusText}): ${errorBody}`,
      );
    }

    const payload = (await response.json()) as JiraSearchResponse;
    const bounds = this.computePeriodBounds(query);
    const matchedIssues = (payload.issues ?? []).filter((issue) =>
      this.hasRelevantChangelogActivity(issue, bounds.start, bounds.end),
    );

    return {
      issues: matchedIssues.map((issue) => this.normalizeIssue(issue)),
      request,
      total: payload.total ?? 0,
    };
  }

  async buildSearchRequest(
    query: QuerySchema,
    settings: JiraSettings = this.getSettings(),
  ): Promise<JiraSearchRequest> {
    const assigneeClause = await this.buildAssigneeClause(query, settings);

    return {
      jql: this.buildJql(query, assigneeClause),
      query,
    };
  }

  private buildJql(query: QuerySchema, assigneeClause?: string | null): string {
    const clauses: string[] = [];

    if (assigneeClause) {
      clauses.push(assigneeClause);
    }

    if (query.mode !== 'assignee' && query.projectKeys.length > 0) {
      clauses.push(`project in (${query.projectKeys.map(this.quoteValue).join(', ')})`);
    }

    const periodClause = this.buildPeriodClause(query);

    if (periodClause) {
      clauses.push(periodClause);
    }

    const excludedStatusesClause = this.buildExcludedStatusesClause(query);

    if (excludedStatusesClause) {
      clauses.push(excludedStatusesClause);
    }

    if (clauses.length === 0) {
      return 'ORDER BY updated DESC';
    }

    return `${clauses.join(' AND ')} ORDER BY updated DESC`;
  }

  private buildPeriodClause(query: QuerySchema): string | null {
    switch (query.period) {
      case 'this_week':
        return this.buildCandidatePeriodClause(
          'updated >= startOfWeek()',
          'created >= startOfWeek()',
          'status changed AFTER startOfWeek()',
        );
      case 'last_week':
        return this.buildCandidatePeriodClause(
          'updated >= startOfWeek(-1) AND updated < startOfWeek()',
          'created >= startOfWeek(-1) AND created < startOfWeek()',
          'status changed DURING (startOfWeek(-1), startOfWeek())',
        );
      case 'today':
        return this.buildCandidatePeriodClause(
          'updated >= startOfDay()',
          'created >= startOfDay()',
          'status changed AFTER startOfDay()',
        );
      case 'yesterday':
        return this.buildCandidatePeriodClause(
          'updated >= startOfDay(-1) AND updated < startOfDay()',
          'created >= startOfDay(-1) AND created < startOfDay()',
          'status changed DURING (startOfDay(-1), startOfDay())',
        );
      case 'custom_range':
        if (query.startDate && query.endDate) {
          const nextDay = this.addOneDay(query.endDate);

          return `updated >= "${query.startDate}" AND updated < "${nextDay}"`;
        }

        return null;
      default:
        return null;
    }
  }

  private buildCandidatePeriodClause(
    updatedClause: string,
    createdClause: string,
    statusChangedClause: string,
  ): string {
    return `((${updatedClause}) OR (${createdClause}) OR (${statusChangedClause}))`;
  }

  private buildExcludedStatusesClause(query: QuerySchema): string | null {
    if (query.mode !== 'assignee' || query.assigneeMode !== 'all') {
      return null;
    }

    return `status not in (${ASSIGNEE_ALL_EXCLUDED_STATUSES.map((status) => this.quoteValue(status)).join(', ')})`;
  }

  async lookupProjects(query: string): Promise<JiraProjectCandidate[]> {
    const settings = this.getSettings();
    const url = this.buildProjectSearchUrl(settings.baseUrl, query);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: this.createAuthorizationHeader(settings),
      },
    });

    if (!response.ok) {
      const errorBody = await this.readResponseBody(response);

      throw new Error(
        `Project lookup request failed (${response.status} ${response.statusText}): ${errorBody}`,
      );
    }

    const payload = (await response.json()) as { values?: Array<{ key?: string; name?: string }> };

    return (payload.values ?? [])
      .map((p) => ({ key: (p.key ?? '').trim(), name: (p.name ?? '').trim() }))
      .filter((p) => p.key.length > 0);
  }

  async searchIssuesByTitle(query: string): Promise<JiraIssueCandidate[]> {
    const settings = this.getSettings();
    const response = await fetch(this.buildSearchUrl(settings.baseUrl), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: this.createAuthorizationHeader(settings),
      },
      body: JSON.stringify({
        jql: `summary ~ ${this.quoteValue(query)} ORDER BY updated DESC`,
        fields: JIRA_ISSUE_LOOKUP_FIELDS,
        maxResults: JIRA_ISSUE_LOOKUP_MAX_RESULTS,
      }),
    });

    if (!response.ok) {
      const errorBody = await this.readResponseBody(response);

      throw new Error(
        `Issue title search failed (${response.status} ${response.statusText}): ${errorBody}`,
      );
    }

    const payload = (await response.json()) as JiraSearchResponse;

    return (payload.issues ?? []).map((issue) => this.normalizeIssueCandidate(issue));
  }

  async getIssueByKey(issueKey: string): Promise<JiraIssueCandidate> {
    const settings = this.getSettings();
    const response = await fetch(this.buildIssueUrl(settings.baseUrl, issueKey), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: this.createAuthorizationHeader(settings),
      },
    });

    if (!response.ok) {
      const errorBody = await this.readResponseBody(response);

      throw new Error(
        `Issue lookup failed for "${issueKey}" (${response.status} ${response.statusText}): ${errorBody}`,
      );
    }

    const payload = (await response.json()) as JiraIssueResponse;

    return this.normalizeIssueCandidate(payload);
  }

  async createComment(request: JiraCommentCreateRequest): Promise<JiraCommentCreateResponse> {
    const settings = this.getSettings();
    const response = await fetch(this.buildIssueCommentUrl(settings.baseUrl, request.issueKey), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: this.createAuthorizationHeader(settings),
      },
      body: JSON.stringify({
        body: this.createCommentBodyDocument(request.body),
      }),
    });

    if (!response.ok) {
      const errorBody = await this.readResponseBody(response);

      throw new Error(
        `Comment create failed for "${request.issueKey}" (${response.status} ${response.statusText}): ${errorBody}`,
      );
    }

    const payload = (await response.json()) as JiraCommentResponse;

    return {
      issueKey: request.issueKey,
      commentId: payload.id?.trim() || '(unknown comment id)',
    };
  }

  async getCurrentUserAccountId(): Promise<string> {
    const settings = this.getSettings();
    const response = await fetch(this.buildMyselfUrl(settings.baseUrl), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: this.createAuthorizationHeader(settings),
      },
    });

    if (!response.ok) {
      const errorBody = await this.readResponseBody(response);

      throw new Error(
        `Jira myself request failed (${response.status} ${response.statusText}): ${errorBody}`,
      );
    }

    const payload = (await response.json()) as JiraMyselfResponse;
    const accountId = payload.accountId?.trim();

    if (!accountId) {
      throw new Error('Jira myself response does not include accountId.');
    }

    return accountId;
  }

  async searchWeeklyReportIssues(
    accountId: string,
    start: Date,
    end: Date,
  ): Promise<JiraSearchResult['issues']> {
    const settings = this.getSettings();
    const candidateIssues = await this.fetchWeeklyReportIssueCandidates(accountId, settings);
    const filteredIssues = candidateIssues.filter((issue) =>
      this.hasRelevantChangelogActivity(issue, start, end),
    );
    const uniqueIssues = this.uniqueIssuesByKey(filteredIssues);

    return uniqueIssues.map((issue) => this.normalizeIssue(issue));
  }

  private buildProjectSearchUrl(baseUrl: string, query: string): string {
    const normalizedBaseUrl = this.normalizeBaseUrl(baseUrl);
    const url = new URL(`${normalizedBaseUrl}${JIRA_PROJECT_SEARCH_PATH}`);

    url.searchParams.set('query', query);
    url.searchParams.set('maxResults', '20');

    return url.toString();
  }

  private buildIssueUrl(baseUrl: string, issueKey: string): string {
    const normalizedBaseUrl = this.normalizeBaseUrl(baseUrl);
    const url = new URL(`${normalizedBaseUrl}${JIRA_ISSUE_PATH}/${encodeURIComponent(issueKey)}`);

    url.searchParams.set('fields', JIRA_ISSUE_LOOKUP_FIELDS.join(','));

    return url.toString();
  }

  private buildIssueCommentUrl(baseUrl: string, issueKey: string): string {
    const normalizedBaseUrl = this.normalizeBaseUrl(baseUrl);

    return `${normalizedBaseUrl}${JIRA_ISSUE_PATH}/${encodeURIComponent(issueKey)}/comment`;
  }

  private buildMyselfUrl(baseUrl: string): string {
    const normalizedBaseUrl = this.normalizeBaseUrl(baseUrl);

    return `${normalizedBaseUrl}${JIRA_MYSELF_PATH}`;
  }

  private async buildAssigneeClause(
    query: QuerySchema,
    settings: JiraSettings,
  ): Promise<string | null> {
    if (query.mode === 'project' || query.assignees.length === 0) {
      return null;
    }

    const accountIds = await Promise.all(
      query.assignees.map((assigneeInput) => this.resolveAssigneeAccountId(assigneeInput, settings)),
    );

    return `assignee in (${accountIds.map((accountId) => this.quoteValue(accountId)).join(', ')})`;
  }

  private buildSearchUrl(baseUrl: string): string {
    const normalizedBaseUrl = this.normalizeBaseUrl(baseUrl);

    return `${normalizedBaseUrl}${JIRA_SEARCH_PATH}`;
  }

  private async fetchWeeklyReportIssueCandidates(
    accountId: string,
    settings: JiraSettings,
  ): Promise<JiraIssueResponse[]> {
    const issues: JiraIssueResponse[] = [];
    const seenKeys = new Set<string>();
    const jql = `assignee = ${this.quoteValue(accountId)} ORDER BY updated DESC`;
    let nextPageToken: string | undefined;

    while (true) {
      const searchUrl = new URL(this.buildSearchUrl(settings.baseUrl));

      searchUrl.searchParams.set('jql', jql);
      searchUrl.searchParams.set('maxResults', String(JIRA_WEEKLY_REPORT_SEARCH_PAGE_SIZE));
      searchUrl.searchParams.set('expand', 'changelog');

      for (const field of JIRA_SEARCH_FIELDS) {
        searchUrl.searchParams.append('fields', field);
      }

      if (nextPageToken) {
        searchUrl.searchParams.set('nextPageToken', nextPageToken);
      }

      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: this.createAuthorizationHeader(settings),
        },
      });

      if (!response.ok) {
        const errorBody = await this.readResponseBody(response);

        throw new Error(
          `Weekly report Jira search failed (${response.status} ${response.statusText}): ${errorBody}`,
        );
      }

      const payload = (await response.json()) as JiraSearchResponse;
      const pageIssues = payload.issues ?? [];

      for (const issue of pageIssues) {
        const key = issue.key?.trim();

        if (!key || seenKeys.has(key)) {
          continue;
        }

        seenKeys.add(key);
        issues.push(issue);
      }

      nextPageToken = payload.nextPageToken?.trim() || undefined;

      if (!nextPageToken) {
        break;
      }
    }

    return issues;
  }

  private normalizeBaseUrl(baseUrl: string): string {
    const trimmed = baseUrl.trim();

    if (!trimmed) {
      throw new Error('Jira base URL is not configured.');
    }

    const withScheme = /^[a-z]+:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
      const url = new URL(withScheme);

      if (!url.hostname) {
        throw new Error('missing hostname');
      }

      return url.origin.replace(/\/+$/u, '');
    } catch {
      throw new Error(
        `Jira base URL is invalid: ${baseUrl}. Set JIRA_BASE_URL to a Jira site host or URL.`,
      );
    }
  }

  private createAuthorizationHeader(settings: JiraSettings): string {
    const credentials = `${settings.email}:${settings.apiToken}`;

    return `Basic ${Buffer.from(credentials, 'utf8').toString('base64')}`;
  }

  private async resolveAssigneeAccountId(
    assigneeInput: string,
    settings: JiraSettings,
  ): Promise<string> {
    const candidates = await this.lookupUsers(assigneeInput, settings);
    const exactMatches = candidates.filter((candidate) =>
      this.matchesAssigneeInput(candidate, assigneeInput),
    );

    if (exactMatches.length === 1) {
      const accountId = exactMatches[0].accountId?.trim();

      if (accountId) {
        return accountId;
      }
    }

    if (exactMatches.length > 1) {
      throw new Error(
        `Assignee lookup failed for "${assigneeInput}": multiple Jira users matched exactly. Please use a more specific Jira account identifier.`,
      );
    }

    throw new Error(
      `Assignee lookup failed for "${assigneeInput}": no exact Jira user match was found. Please enter the user's exact Jira display name or account ID.`,
    );
  }

  private async lookupUsers(
    assigneeInput: string,
    settings: JiraSettings,
  ): Promise<JiraUserSearchResponseItem[]> {
    const searchUrl = this.buildUserSearchUrl(settings.baseUrl, assigneeInput);
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: this.createAuthorizationHeader(settings),
      },
    });

    if (!response.ok) {
      const errorBody = await this.readResponseBody(response);

      throw new Error(
        `Assignee lookup request failed for "${assigneeInput}" (${response.status} ${response.statusText}): ${errorBody}`,
      );
    }

    const payload = (await response.json()) as JiraUserSearchResponseItem[];

    return Array.isArray(payload) ? payload : [];
  }

  private buildUserSearchUrl(baseUrl: string, assigneeInput: string): string {
    const normalizedBaseUrl = this.normalizeBaseUrl(baseUrl);
    const url = new URL(`${normalizedBaseUrl}${JIRA_USER_SEARCH_PATH}`);

    url.searchParams.set('query', assigneeInput);
    url.searchParams.set('maxResults', '20');

    return url.toString();
  }

  private matchesAssigneeInput(
    candidate: JiraUserSearchResponseItem,
    assigneeInput: string,
  ): boolean {
    const normalizedInput = this.normalizeLookupValue(assigneeInput);

    if (!normalizedInput) {
      return false;
    }

    return [candidate.accountId, candidate.displayName, candidate.emailAddress, candidate.name, candidate.key]
      .map((value) => this.normalizeLookupValue(value))
      .some((value) => value === normalizedInput);
  }

  private computePeriodBounds(query: QuerySchema): { start: Date; end: Date } {
    const now = new Date();

    switch (query.period) {
      case 'today': {
        const start = this.startOfLocalDay(now);
        return { start, end: now };
      }
      case 'yesterday': {
        const end = this.startOfLocalDay(now);
        const start = new Date(end);
        start.setDate(start.getDate() - 1);
        return { start, end };
      }
      case 'this_week': {
        const start = this.startOfLocalWeek(now);
        return { start, end: now };
      }
      case 'last_week': {
        const end = this.startOfLocalWeek(now);
        const start = new Date(end);
        start.setDate(start.getDate() - 7);
        return { start, end };
      }
      case 'custom_range': {
        if (!query.startDate || !query.endDate) {
          return { start: new Date(0), end: now };
        }

        const start = this.parseLocalDate(query.startDate);
        const end = this.parseLocalDate(this.addOneDay(query.endDate));
        return { start, end };
      }
      default:
        return { start: new Date(0), end: now };
    }
  }

  private hasRelevantChangelogActivity(issue: JiraIssueResponse, start: Date, end: Date): boolean {
    const histories = issue.changelog?.histories ?? [];

    for (const history of histories) {
      const created = new Date(history.created);

      if (created < start || created >= end) {
        continue;
      }

      for (const item of history.items) {
        if (CHANGELOG_TRACKED_FIELDS.has(item.field.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  }

  private uniqueIssuesByKey(issues: JiraIssueResponse[]): JiraIssueResponse[] {
    const seen = new Set<string>();

    return issues.filter((issue) => {
      const key = issue.key?.trim();

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  private startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private startOfLocalWeek(date: Date): Date {
    const start = this.startOfLocalDay(date);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;

    start.setDate(start.getDate() + diff);

    return start;
  }

  private parseLocalDate(date: string): Date {
    const [year, month, day] = date.split('-').map((value) => Number.parseInt(value, 10));

    return new Date(year, month - 1, day);
  }

  private normalizeIssue(issue: JiraIssueResponse): JiraSearchResult['issues'][number] {
    const description = this.extractText(issue.fields?.description);
    const comments = (issue.fields?.comment?.comments ?? [])
      .map((comment) => this.extractText(comment.body))
      .filter((commentText) => commentText.length > 0);
    const weeklyIssues = this.extractWeeklyIssues(comments);

    return {
      key: issue.key ?? '(unknown issue key)',
      summary: issue.fields?.summary?.trim() || '(no summary)',
      status: issue.fields?.status?.name?.trim() || '(unknown status)',
      assignee: issue.fields?.assignee?.displayName?.trim() || null,
      projectKey: issue.fields?.project?.key?.trim() || null,
      projectName: issue.fields?.project?.name?.trim() || null,
      updated: issue.fields?.updated ?? null,
      description: description || null,
      comments,
      weeklyIssues,
    };
  }

  private normalizeIssueCandidate(issue: JiraIssueResponse): JiraIssueCandidate {
    return {
      key: issue.key?.trim() || '(unknown issue key)',
      summary: issue.fields?.summary?.trim() || '(no summary)',
      status: issue.fields?.status?.name?.trim() || '(unknown status)',
      projectKey: issue.fields?.project?.key?.trim() || null,
      projectName: issue.fields?.project?.name?.trim() || null,
    };
  }

  private extractWeeklyIssues(commentTexts: string[]): string[] {
    const collected: string[] = [];

    for (const commentText of commentTexts) {
      const normalizedSource = this.normalizeWhitespace(commentText);
      let searchIndex = 0;

      while (searchIndex < normalizedSource.length) {
        const startIndex = normalizedSource.indexOf(WEEKLY_ISSUE_TAG, searchIndex);

        if (startIndex < 0) {
          break;
        }

        const contentStartIndex = startIndex + WEEKLY_ISSUE_TAG.length;
        const remainingText = normalizedSource.slice(contentStartIndex);
        const nextSectionIndex = remainingText.search(/\n\s*\[[^\]\n]+\]/u);
        const section =
          nextSectionIndex >= 0
            ? remainingText.slice(0, nextSectionIndex)
            : remainingText;

        collected.push(...this.splitWeeklyIssueSection(section));
        searchIndex = contentStartIndex;
      }
    }

    return this.uniqueValues(collected);
  }

  private splitWeeklyIssueSection(section: string): string[] {
    const normalizedSection = section.trim().replace(/^[:\-]\s*/u, '').trim();

    if (!normalizedSection) {
      return [];
    }

    const lines = normalizedSection
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.replace(/^[-*•\d.)\s]+/u, '').trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return [];
    }

    if (lines.length === 1) {
      return lines;
    }

    return lines;
  }

  private extractText(value: unknown): string {
    const flattened = this.flattenJiraText(value);

    return this.normalizeWhitespace(flattened);
  }

  private flattenJiraText(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (!value || typeof value !== 'object') {
      return '';
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.flattenJiraText(entry)).join('');
    }

    const node = value as {
      type?: string;
      text?: string;
      attrs?: Record<string, unknown>;
      content?: unknown[];
    };
    const contentText = (node.content ?? [])
      .map((entry) => this.flattenJiraText(entry))
      .join('');

    if (node.type === 'text') {
      return node.text ?? '';
    }

    if (node.type === 'hardBreak') {
      return '\n';
    }

    const attrText = this.extractTextFromAttrs(node.attrs);
    const combined = contentText || attrText;

    if (
      node.type === 'paragraph' ||
      node.type === 'heading' ||
      node.type === 'blockquote' ||
      node.type === 'panel' ||
      node.type === 'listItem' ||
      node.type === 'bulletList' ||
      node.type === 'orderedList' ||
      node.type === 'table' ||
      node.type === 'tableRow'
    ) {
      return `${combined}\n`;
    }

    return combined;
  }

  private createCommentBodyDocument(body: string): Record<string, unknown> {
    const lines = body.split('\n');
    const content: Array<Record<string, unknown>> = [];

    lines.forEach((line, index) => {
      if (line.length > 0) {
        content.push({
          type: 'text',
          text: line,
        });
      }

      if (index < lines.length - 1) {
        content.push({ type: 'hardBreak' });
      }
    });

    return {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content,
        },
      ],
    };
  }

  private extractTextFromAttrs(attrs?: Record<string, unknown>): string {
    if (!attrs) {
      return '';
    }

    const textCandidates = ['text', 'title', 'shortName'];

    for (const key of textCandidates) {
      const value = attrs[key];

      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return '';
  }

  private normalizeWhitespace(value: string): string {
    return value
      .replace(/\r\n/gu, '\n')
      .replace(/\n{3,}/gu, '\n\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();
  }

  private uniqueValues(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
  }

  private addOneDay(date: string): string {
    const d = new Date(`${date}T00:00:00Z`);

    d.setUTCDate(d.getUTCDate() + 1);

    return d.toISOString().slice(0, 10);
  }

  private normalizeLookupValue(value?: string): string {
    return value?.trim().toLowerCase() ?? '';
  }

  private async readResponseBody(response: Response): Promise<string> {
    const text = await response.text();
    const normalized = text.trim();

    return normalized || 'No response body';
  }

  private quoteValue(value: string): string {
    return `"${value.replaceAll('"', '\\"')}"`;
  }
}
