import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JiraSettings } from '../config/jira-settings.js';
import { QuerySchema } from '../query/query.schema.js';

export interface JiraSearchRequest {
  jql: string;
  query: QuerySchema;
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
    precautions: string[];
  }>;
  request: JiraSearchRequest;
  total: number;
}

interface JiraSearchResponse {
  issues?: JiraIssueResponse[];
  total?: number;
}

interface JiraUserSearchResponseItem {
  accountId?: string;
  displayName?: string;
  emailAddress?: string;
  name?: string;
  key?: string;
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
    updated?: string;
    description?: unknown;
    comment?: {
      comments?: Array<{
        body?: unknown;
      }>;
    };
  };
}

const JIRA_SEARCH_PATH = '/rest/api/3/search/jql';
const JIRA_USER_SEARCH_PATH = '/rest/api/3/user/search';
const JIRA_SEARCH_FIELDS = [
  'summary',
  'status',
  'assignee',
  'project',
  'updated',
  'description',
  'comment',
];
const JIRA_MAX_RESULTS = 20;
const PRECAUTION_TAG = '[주의사항]';

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
      }),
    });

    if (!response.ok) {
      const errorBody = await this.readResponseBody(response);

      throw new Error(
        `Jira search request failed (${response.status} ${response.statusText}): ${errorBody}`,
      );
    }

    const payload = (await response.json()) as JiraSearchResponse;

    return {
      issues: (payload.issues ?? []).map((issue) => this.normalizeIssue(issue)),
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

    if (query.period === 'this_week') {
      clauses.push('updated >= startOfWeek()');
    }

    if (clauses.length === 0) {
      return 'ORDER BY updated DESC';
    }

    return `${clauses.join(' AND ')} ORDER BY updated DESC`;
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

  private normalizeIssue(issue: JiraIssueResponse): JiraSearchResult['issues'][number] {
    const description = this.extractText(issue.fields?.description);
    const comments = (issue.fields?.comment?.comments ?? [])
      .map((comment) => this.extractText(comment.body))
      .filter((commentText) => commentText.length > 0);
    const precautions = this.extractPrecautions([description, ...comments]);

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
      precautions,
    };
  }

  private extractPrecautions(sourceTexts: string[]): string[] {
    const collected: string[] = [];

    for (const sourceText of sourceTexts) {
      if (!sourceText) {
        continue;
      }

      const normalizedSource = this.normalizeWhitespace(sourceText);
      let searchIndex = 0;

      while (searchIndex < normalizedSource.length) {
        const startIndex = normalizedSource.indexOf(PRECAUTION_TAG, searchIndex);

        if (startIndex < 0) {
          break;
        }

        const contentStartIndex = startIndex + PRECAUTION_TAG.length;
        const remainingText = normalizedSource.slice(contentStartIndex);
        const nextSectionIndex = remainingText.search(/\n\s*\[[^\]\n]+\]/u);
        const section =
          nextSectionIndex >= 0
            ? remainingText.slice(0, nextSectionIndex)
            : remainingText;

        collected.push(...this.splitPrecautionSection(section));
        searchIndex = contentStartIndex;
      }
    }

    return this.uniqueValues(collected);
  }

  private splitPrecautionSection(section: string): string[] {
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
