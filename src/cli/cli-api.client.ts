import { Injectable } from '@nestjs/common';

import {
  JiraCommentCreateRequest,
  JiraCommentCreateResponse,
  JiraIssueCandidate,
  JiraProjectCandidate,
  JiraSearchRequest,
  JiraSearchResult,
} from '../jira/jira.service.js';
import {
  readQwenJiraUserConfig,
  resolveQwenJiraLocalServerBaseUrl,
} from '../config/qwen-jira-user-config.js';
import { AssigneeMode, QueryMode, QuerySchema } from '../query/query.schema.js';

interface JiraSearchApiRequest {
  mode: QueryMode;
  assigneeMode?: AssigneeMode;
  assignee?: string;
  projectKey?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  outputFormat?: QuerySchema['output']['format'];
}

interface HealthStatusResponse {
  status: string;
  jiraConfigured: boolean;
  missingEnv: string[];
}

export interface JiraSearchApiResponse {
  query: QuerySchema;
  request: JiraSearchRequest;
  total: number;
  issues: JiraSearchResult['issues'];
  consoleRendered: string;
  markdownRendered: string;
  rendered: string;
}

export interface JiraIssueLookupByKeyResponse {
  key: string;
  summary: string;
  status: string;
  projectKey: string | null;
  projectName: string | null;
}

@Injectable()
export class CliApiClient {
  async describeTarget(): Promise<string> {
    return `로컬 서버 API: ${await this.getBaseUrl()}`;
  }

  async getHealthStatus(): Promise<HealthStatusResponse> {
    const response = await this.fetchFromServer('/health', {
      method: 'GET',
    });

    return (await response.json()) as HealthStatusResponse;
  }

  async searchJira(request: JiraSearchApiRequest): Promise<JiraSearchApiResponse> {
    const response = await this.fetchFromServer('/jira/search', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    return (await response.json()) as JiraSearchApiResponse;
  }

  async lookupProjects(query: string): Promise<JiraProjectCandidate[]> {
    const encodedQuery = encodeURIComponent(query);
    const response = await this.fetchFromServer(`/jira/projects?query=${encodedQuery}`, {
      method: 'GET',
    });

    return (await response.json()) as JiraProjectCandidate[];
  }

  async searchIssuesByTitle(query: string): Promise<JiraIssueCandidate[]> {
    const encodedQuery = encodeURIComponent(query);
    const response = await this.fetchFromServer(`/jira/issues?query=${encodedQuery}`, {
      method: 'GET',
    });

    return (await response.json()) as JiraIssueCandidate[];
  }

  async getIssueByKey(issueKey: string): Promise<JiraIssueLookupByKeyResponse> {
    const encodedKey = encodeURIComponent(issueKey);
    const response = await this.fetchFromServer(`/jira/issues/${encodedKey}`, {
      method: 'GET',
    });

    return (await response.json()) as JiraIssueLookupByKeyResponse;
  }

  async createComment(request: JiraCommentCreateRequest): Promise<JiraCommentCreateResponse> {
    const response = await this.fetchFromServer('/jira/comments', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    return (await response.json()) as JiraCommentCreateResponse;
  }

  private async fetchFromServer(path: string, init: RequestInit): Promise<Response> {
    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl}${path}`;
    let response: Response;

    try {
      response = await fetch(url, init);
    } catch {
      throw new Error(
        `로컬 서버에 연결할 수 없습니다: ${baseUrl}. API 서버를 먼저 시작한 뒤 다시 시도해주세요.`,
      );
    }

    if (!response.ok) {
      const errorBody = await this.readResponseBody(response);

      throw new Error(
        `로컬 서버 요청 실패 (${response.status} ${response.statusText}): ${errorBody}`,
      );
    }

    return response;
  }

  private async getBaseUrl(): Promise<string> {
    const configured =
      process.env.QWEN_JIRA_API_BASE_URL?.trim() ||
      process.env.LOCAL_SERVER_API_BASE_URL?.trim();
    const baseUrl = configured || resolveQwenJiraLocalServerBaseUrl(await readQwenJiraUserConfig());

    try {
      const url = new URL(baseUrl);

      return url.origin.replace(/\/+$/u, '');
    } catch {
      throw new Error(
        `로컬 서버 API 기본 URL이 올바르지 않습니다: ${baseUrl}. QWEN_JIRA_API_BASE_URL에 유효한 http(s) URL을 설정해주세요.`,
      );
    }
  }

  private async readResponseBody(response: Response): Promise<string> {
    const text = (await response.text()).trim();

    return text.length > 0 ? text : '응답 본문이 없습니다.';
  }
}
