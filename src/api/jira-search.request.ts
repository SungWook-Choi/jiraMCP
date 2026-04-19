import { BadRequestException } from '@nestjs/common';

import { OutputFormat, QueryMode } from '../query/query.schema.js';

export interface JiraSearchHttpRequest {
  mode: QueryMode;
  assignee?: string;
  projectKey?: string;
  period?: string;
  outputFormat?: OutputFormat;
}

const QUERY_MODES: QueryMode[] = ['assignee', 'project', 'assignee_project'];
const OUTPUT_FORMATS: OutputFormat[] = ['console', 'markdown'];

export function parseJiraSearchRequest(body: unknown): JiraSearchHttpRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException(
      'Request body must be a JSON object with mode and optional assignee/projectKey fields.',
    );
  }

  const source = body as Record<string, unknown>;
  const mode = parseMode(source.mode);
  const assignee = parseOptionalString(source.assignee, 'assignee');
  const projectKey = parseOptionalString(source.projectKey, 'projectKey');
  const period = parseOptionalString(source.period, 'period');
  const outputFormat = parseOptionalOutputFormat(source.outputFormat);

  if ((mode === 'assignee' || mode === 'assignee_project') && !assignee) {
    throw new BadRequestException(
      'assignee is required when mode is assignee or assignee_project.',
    );
  }

  if ((mode === 'project' || mode === 'assignee_project') && !projectKey) {
    throw new BadRequestException(
      'projectKey is required when mode is project or assignee_project.',
    );
  }

  return {
    mode,
    assignee,
    projectKey,
    period,
    outputFormat,
  };
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
