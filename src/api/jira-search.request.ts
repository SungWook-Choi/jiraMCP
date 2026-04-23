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
      '요청 본문은 mode와 선택적 assignee/projectKey 필드를 포함한 JSON 객체여야 합니다.',
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
        'mode가 assignee (personal) 또는 assignee_project일 때 assignee가 필요합니다.',
      );
    }
  }

  if (mode !== 'assignee' && assigneeMode) {
    throw new BadRequestException(
      'assigneeMode는 mode가 assignee일 때만 사용할 수 있습니다.',
    );
  }

  if ((mode === 'project' || mode === 'assignee_project') && !projectKey) {
    throw new BadRequestException(
      'mode가 project 또는 assignee_project일 때 projectKey가 필요합니다.',
    );
  }

  if (period === 'custom_range') {
    if (!startDate) {
      throw new BadRequestException(
        'period가 custom_range일 때는 startDate가 필요합니다. YYYY-MM-DD 형식을 사용해주세요.',
      );
    }

    if (!endDate) {
      throw new BadRequestException(
        'period가 custom_range일 때는 endDate가 필요합니다. YYYY-MM-DD 형식을 사용해주세요.',
      );
    }

    if (!DATE_PATTERN.test(startDate)) {
      throw new BadRequestException(
        `startDate는 YYYY-MM-DD 형식이어야 합니다. 입력값: "${startDate}".`,
      );
    }

    if (!DATE_PATTERN.test(endDate)) {
      throw new BadRequestException(
        `endDate는 YYYY-MM-DD 형식이어야 합니다. 입력값: "${endDate}".`,
      );
    }

    if (startDate > endDate) {
      throw new BadRequestException(
        `startDate (${startDate})는 endDate (${endDate})보다 늦을 수 없습니다.`,
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
      '요청 본문은 issueKey와 body 필드를 포함한 JSON 객체여야 합니다.',
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
    throw new BadRequestException('assigneeMode는 personal 또는 all이어야 합니다.');
  }

  const normalized = value.trim().toLowerCase() as AssigneeMode;

  if (!ASSIGNEE_MODES.includes(normalized)) {
    throw new BadRequestException('assigneeMode는 personal 또는 all이어야 합니다.');
  }

  return normalized;
}

function parseMode(value: unknown): QueryMode {
  if (typeof value !== 'string') {
    throw new BadRequestException(
      'mode는 다음 중 하나여야 합니다: assignee, project, assignee_project.',
    );
  }

  const normalized = value.trim() as QueryMode;

  if (!QUERY_MODES.includes(normalized)) {
    throw new BadRequestException(
      'mode는 다음 중 하나여야 합니다: assignee, project, assignee_project.',
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
      `period는 다음 중 하나여야 합니다: ${VALID_PERIODS.join(', ')}.`,
    );
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (!VALID_PERIODS.includes(normalized as (typeof VALID_PERIODS)[number])) {
    throw new BadRequestException(
      `period는 다음 중 하나여야 합니다: ${VALID_PERIODS.join(', ')}. 입력값: "${normalized}".`,
    );
  }

  return normalized;
}

function parseOptionalOutputFormat(value: unknown): OutputFormat | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('outputFormat은 console 또는 markdown이어야 합니다.');
  }

  const normalized = value.trim() as OutputFormat;

  if (!OUTPUT_FORMATS.includes(normalized)) {
    throw new BadRequestException('outputFormat은 console 또는 markdown이어야 합니다.');
  }

  return normalized;
}

function parseOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`${fieldName}은 문자열이어야 합니다.`);
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : undefined;
}

function parseRequiredString(value: unknown, fieldName: string): string {
  const normalized = parseOptionalString(value, fieldName);

  if (!normalized) {
    throw new BadRequestException(`${fieldName}이 필요합니다.`);
  }

  return normalized;
}
