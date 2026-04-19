import { Injectable } from '@nestjs/common';

import {
  OutputFormat,
  QueryMode,
  QueryPeriod,
  QuerySchema,
} from './query.schema.js';

@Injectable()
export class QueryService {
  createEmptyQuery(): QuerySchema {
    return {
      mode: 'assignee',
      assignees: [],
      projectKeys: [],
      period: 'this_week',
      output: {
        format: 'console',
      },
    };
  }

  createQuery(input: {
    mode: QueryMode;
    assignee?: string;
    projectKey?: string;
    period?: string;
    outputFormat?: OutputFormat;
  }): QuerySchema {
    return {
      mode: input.mode,
      assignees: this.normalizeAssignees(input.mode, input.assignee),
      projectKeys: this.normalizeProjectKeys(input.mode, input.projectKey),
      period: this.normalizePeriod(input.period),
      output: {
        format: input.outputFormat ?? 'console',
      },
    };
  }

  normalizePeriod(period?: string): QueryPeriod {
    const normalized = period?.trim().toLowerCase();

    if (!normalized) {
      return 'this_week';
    }

    return normalized;
  }

  private normalizeAssignees(mode: QueryMode, assignee?: string): string[] {
    if (mode === 'project') {
      return [];
    }

    const normalized = assignee?.trim();

    return normalized ? [normalized] : [];
  }

  private normalizeProjectKeys(mode: QueryMode, projectKey?: string): string[] {
    if (mode === 'assignee') {
      return [];
    }

    const normalized = projectKey?.trim().toUpperCase();

    return normalized ? [normalized] : [];
  }
}
