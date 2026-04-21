import { BadRequestException } from '@nestjs/common';

import { AssigneeMode, OutputFormat, QueryMode, VALID_PERIODS } from '../query/query.schema.js';

export interface JiraSearchHttpRequest {
  mode: QueryMode;
  assigneeMode?: AssigneeMode;
  assignee?: string;
  projectKey?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  outputFormat?: OutputFormat;
}

export interface JiraCommentCreateHttpRequest {
  issueKey: string;
  body: string;
}

const QUERY_MODES: QueryMode[] = ['assignee', 'project', 'assignee_project'];
const ASSIGNEE_MODES: AssigneeMode[] = ['personal', 'all'];
const OUTPUT_FORMATS: OutputFormat[] = ['console', 'markdown'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export function parseJiraSearchRequest(body: unknown): JiraSearchHttpRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException(
      'Request body must be a JSON object with mode and optional assignee/projectKey fields.',
    );
  }

  const source = body as Record<string, unknown>;
  const mode = parseMode(source.mode);
  const assigneeMode = parseOptionalAssigneeMode(source.assigneeMode);
  const assignee = parseOptionalString(source.assignee, 'assignee');
  const projectKey = parseOptionalString(source.projectKey, 'projectKey');
  const period = parseOptionalPeriod(source.period);
  const startDate = parseOptionalString(source.startDate, 'startDate');
  const endDate = parseOptionalString(source.endDate, 'endDate');
  const outputFormat = parseOptionalOutputFormat(source.outputFormat);

  if ((mode === 'assignee' && assigneeMode !== 'all') || mode === 'assignee_project') {
    if (!assignee) {
      throw new BadRequestException(
        'assignee is required when mode is assignee (personal) or assignee_project.',
      );
    }
  }

  if (mode !== 'assignee' && assigneeMode) {
    throw new BadRequestException(
      'assigneeMode is only supported when mode is assignee.',
    );
  }

  if ((mode === 'project' || mode === 'assignee_project') && !projectKey) {
    throw new BadRequestException(
      'projectKey is required when mode is project or assignee_project.',
    );
  }

  if (period === 'custom_range') {
    if (!startDate) {
      throw new BadRequestException(
        'startDate is required when period is custom_range. Use YYYY-MM-DD format.',
      );
    }

    if (!endDate) {
      throw new BadRequestException(
        'endDate is required when period is custom_range. Use YYYY-MM-DD format.',
      );
    }

    if (!DATE_PATTERN.test(startDate)) {
      throw new BadRequestException(
        `startDate must be in YYYY-MM-DD format. Received: "${startDate}".`,
      );
    }

    if (!DATE_PATTERN.test(endDate)) {
      throw new BadRequestException(
        `endDate must be in YYYY-MM-DD format. Received: "${endDate}".`,
      );
    }

    if (startDate > endDate) {
      throw new BadRequestException(
        `startDate (${startDate}) must not be after endDate (${endDate}).`,
      );
    }
  }

  return {
    mode,
    assigneeMode,
    assignee,
    projectKey,
    period,
    startDate,
    endDate,
    outputFormat,
  };
}

export function parseJiraCommentCreateRequest(body: unknown): JiraCommentCreateHttpRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException(
      'Request body must be a JSON object with issueKey and body fields.',
    );
  }

  const source = body as Record<string, unknown>;
  const issueKey = parseRequiredString(source.issueKey, 'issueKey');
  const commentBody = parseRequiredString(source.body, 'body');

  return {
    issueKey,
    body: commentBody,
  };
}

function parseOptionalAssigneeMode(value: unknown): AssigneeMode | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('assigneeMode must be personal or all.');
  }

  const normalized = value.trim().toLowerCase() as AssigneeMode;

  if (!ASSIGNEE_MODES.includes(normalized)) {
    throw new BadRequestException('assigneeMode must be personal or all.');
  }

  return normalized;
}

function parseMode(value: unknown): QueryMode {
  if (typeof value !== 'string') {
    throw new BadRequestException(
      'mode must be one of: assignee, project, assignee_project.',
    );
  }

  const normalized = value.trim() as QueryMode;

  if (!QUERY_MODES.includes(normalized)) {
    throw new BadRequestException(
      'mode must be one of: assignee, project, assignee_project.',
    );
  }

  return normalized;
}

function parseOptionalPeriod(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(
      `period must be one of: ${VALID_PERIODS.join(', ')}.`,
    );
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (!VALID_PERIODS.includes(normalized as (typeof VALID_PERIODS)[number])) {
    throw new BadRequestException(
      `period must be one of: ${VALID_PERIODS.join(', ')}. Received: "${normalized}".`,
    );
  }

  return normalized;
}

function parseOptionalOutputFormat(value: unknown): OutputFormat | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('outputFormat must be console or markdown.');
  }

  const normalized = value.trim() as OutputFormat;

  if (!OUTPUT_FORMATS.includes(normalized)) {
    throw new BadRequestException('outputFormat must be console or markdown.');
  }

  return normalized;
}

function parseOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`${fieldName} must be a string.`);
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : undefined;
}

function parseRequiredString(value: unknown, fieldName: string): string {
  const normalized = parseOptionalString(value, fieldName);

  if (!normalized) {
    throw new BadRequestException(`${fieldName} is required.`);
  }

  return normalized;
}
