import { Injectable } from '@nestjs/common';

import { JiraProjectCandidate, JiraSearchRequest, JiraSearchResult } from '../jira/jira.service.js';
import { QueryMode, QuerySchema } from '../query/query.schema.js';

interface JiraSearchApiRequest {
  mode: QueryMode;
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

const DEFAULT_LOCAL_SERVER_BASE_URL = 'http://127.0.0.1:3000';

@Injectable()
export class CliApiClient {
  describeTarget(): string {
    return `Local server API: ${this.getBaseUrl()}`;
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

  private async fetchFromServer(path: string, init: RequestInit): Promise<Response> {
    const url = `${this.getBaseUrl()}${path}`;
    let response: Response;

    try {
      response = await fetch(url, init);
    } catch {
      throw new Error(
        `Local server is unavailable at ${this.getBaseUrl()}. Start the API server and try again.`,
      );
    }

    if (!response.ok) {
      const errorBody = await this.readResponseBody(response);

      throw new Error(
        `Local server request failed (${response.status} ${response.statusText}): ${errorBody}`,
      );
    }

    return response;
  }

  private getBaseUrl(): string {
    const configured =
      process.env.QWEN_JIRA_API_BASE_URL?.trim() ||
      process.env.LOCAL_SERVER_API_BASE_URL?.trim() ||
      DEFAULT_LOCAL_SERVER_BASE_URL;

    try {
      const url = new URL(configured);

      return url.origin.replace(/\/+$/u, '');
    } catch {
      throw new Error(
        `Local server API base URL is invalid: ${configured}. Set QWEN_JIRA_API_BASE_URL to a valid http(s) URL.`,
      );
    }
  }

  private async readResponseBody(response: Response): Promise<string> {
    const text = (await response.text()).trim();

    return text.length > 0 ? text : 'No response body.';
  }
}
