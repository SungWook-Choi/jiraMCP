import { Injectable } from '@nestjs/common';

import { CliApiClient, JiraSearchApiResponse } from '../cli/cli-api.client.js';

export interface McpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
  };
}

export interface McpToolCallResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  structuredContent?: unknown;
  isError?: boolean;
}

type ToolArguments = Record<string, unknown>;

const MCP_SERVER_NAME = 'qwen-jira-mcp';
const MCP_SERVER_VERSION = '0.6.0';

@Injectable()
export class McpService {
  constructor(private readonly cliApiClient: CliApiClient) {}

  getServerInfo() {
    return {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
      status: 'ready',
      transport: 'stdio',
      readOnly: true,
    };
  }

  getToolDefinitions(): McpToolDefinition[] {
    return [
      {
        name: 'health_status',
        title: 'Health Status',
        description:
          'Purpose: check whether the local NestJS server is running and whether Jira is configured.\n' +
          'Example: {}',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
        },
      },
      {
        name: 'jira_search',
        title: 'Jira Search',
        description:
          'Purpose: query Jira through the local server using the existing search contract.\n' +
          'Allowed mode values: assignee, project, assignee_project.\n' +
          'Example: {"mode":"project","projectKey":"ABC","period":"this_week"}',
        inputSchema: {
          type: 'object',
          required: ['mode'],
          properties: {
            mode: {
              type: 'string',
              enum: ['assignee', 'project', 'assignee_project'],
            },
            assigneeMode: {
              type: 'string',
              enum: ['personal', 'all'],
            },
            assignee: {
              type: 'string',
            },
            projectKey: {
              type: 'string',
            },
            period: {
              type: 'string',
              enum: ['this_week', 'last_week', 'today', 'yesterday', 'custom_range'],
            },
            startDate: {
              type: 'string',
            },
            endDate: {
              type: 'string',
            },
            outputFormat: {
              type: 'string',
              enum: ['console', 'markdown'],
            },
          },
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
        },
      },
      {
        name: 'jira_issue_get',
        title: 'Jira Issue Get',
        description:
          'Purpose: fetch a single Jira issue by issue key through the local server.\n' +
          'Example: {"issueKey":"ABC-123"}',
        inputSchema: {
          type: 'object',
          required: ['issueKey'],
          properties: {
            issueKey: {
              type: 'string',
              minLength: 1,
            },
          },
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
        },
      },
      {
        name: 'jira_project_lookup',
        title: 'Jira Project Lookup',
        description:
          'Purpose: search Jira projects through the local server.\n' +
          'Example: {"query":"ABC"}',
        inputSchema: {
          type: 'object',
          required: ['query'],
          properties: {
            query: {
              type: 'string',
              minLength: 1,
            },
          },
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
        },
      },
    ];
  }

  async callTool(name: string, args: unknown): Promise<McpToolCallResult> {
    try {
      switch (name) {
        case 'health_status':
          return this.createStructuredResult(
            'health_status',
            await this.cliApiClient.getHealthStatus(),
          );
        case 'jira_search':
          return this.createJiraSearchResult(this.normalizeToolArguments(args));
        case 'jira_issue_get':
          return this.createStructuredResult(
            'jira_issue_get',
            await this.cliApiClient.getIssueByKey(
              this.requireString(this.normalizeToolArguments(args).issueKey, 'issueKey'),
            ),
          );
        case 'jira_project_lookup':
          return this.createStructuredResult(
            'jira_project_lookup',
            await this.cliApiClient.lookupProjects(
              this.requireString(this.normalizeToolArguments(args).query, 'query'),
            ),
          );
        default:
          return this.createErrorResult(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return this.createErrorResult(this.formatErrorMessage(error));
    }
  }

  private async createJiraSearchResult(args: ToolArguments): Promise<McpToolCallResult> {
    const response = await this.cliApiClient.searchJira({
      mode: this.requireString(args.mode, 'mode') as 'assignee' | 'project' | 'assignee_project',
      assigneeMode: this.optionalString(args.assigneeMode) as 'personal' | 'all' | undefined,
      assignee: this.optionalString(args.assignee),
      projectKey: this.optionalString(args.projectKey),
      period: this.optionalString(args.period),
      startDate: this.optionalString(args.startDate),
      endDate: this.optionalString(args.endDate),
      outputFormat: this.optionalString(args.outputFormat) as 'console' | 'markdown' | undefined,
    });

    return this.createStructuredResult('jira_search', response, this.renderSearchSummary(response));
  }

  private createStructuredResult(
    toolName: string,
    structuredContent: unknown,
    summary?: string,
  ): McpToolCallResult {
    const text = summary ?? this.createDefaultSummary(toolName, structuredContent);

    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
      structuredContent,
    };
  }

  private createDefaultSummary(toolName: string, structuredContent: unknown): string {
    return `${toolName} completed.\n\n${JSON.stringify(structuredContent, null, 2)}`;
  }

  private renderSearchSummary(response: JiraSearchApiResponse): string {
    const lines = [
      `jira_search completed. total=${response.total}, returned=${response.issues.length}`,
      `query.mode=${response.query.mode}`,
      `query.period=${response.query.period}`,
    ];

    if (response.issues.length > 0) {
      const firstIssue = response.issues[0];
      lines.push(`first_issue=[${firstIssue.key}] ${firstIssue.summary}`);
    }

    return `${lines.join('\n')}\n\n${JSON.stringify(response, null, 2)}`;
  }

  private createErrorResult(message: string): McpToolCallResult {
    return {
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
      isError: true,
    };
  }

  private normalizeToolArguments(args: unknown): ToolArguments {
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      throw new Error('Tool arguments must be a JSON object.');
    }

    return args as ToolArguments;
  }

  private requireString(value: unknown, fieldName: string): string {
    const normalized = this.optionalString(value);

    if (!normalized) {
      throw new Error(`${fieldName} is required.`);
    }

    return normalized;
  }

  private optionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : undefined;
  }

  private formatErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    return 'Unknown MCP error.';
  }
}
