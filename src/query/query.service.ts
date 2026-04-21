import { Injectable } from '@nestjs/common';

import {
  AssigneeMode,
  OutputFormat,
  QueryMode,
  QueryPeriod,
  QuerySchema,
  VALID_PERIODS,
} from './query.schema.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

@Injectable()
export class QueryService {
  createEmptyQuery(): QuerySchema {
    return {
      mode: 'assignee',
      assigneeMode: 'personal',
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
    assigneeMode?: AssigneeMode;
    assignee?: string;
    projectKey?: string;
    period?: string;
    startDate?: string;
    endDate?: string;
    outputFormat?: OutputFormat;
  }): QuerySchema {
    const assigneeMode = this.normalizeAssigneeMode(input.mode, input.assigneeMode);
    const period = this.normalizePeriod(input.period, input.mode, assigneeMode);

    if (period === 'custom_range') {
      this.validateCustomRange(input.startDate, input.endDate);
    }

    return {
      mode: input.mode,
      assigneeMode,
      assignees: this.normalizeAssignees(input.mode, assigneeMode, input.assignee),
      projectKeys: this.normalizeProjectKeys(input.mode, input.projectKey),
      period,
      startDate: period === 'custom_range' ? input.startDate : undefined,
      endDate: period === 'custom_range' ? input.endDate : undefined,
      output: {
        format: input.outputFormat ?? 'console',
      },
    };
  }

  normalizePeriod(
    period?: string,
    mode?: QueryMode,
    assigneeMode?: AssigneeMode,
  ): QueryPeriod {
    if (mode === 'assignee' && assigneeMode === 'all') {
      return 'this_week';
    }

    const normalized = period?.trim().toLowerCase();

    if (!normalized) {
      return 'this_week';
    }

    if (!VALID_PERIODS.includes(normalized as QueryPeriod)) {
      throw new Error(
        `period must be one of: ${VALID_PERIODS.join(', ')}. Received: "${normalized}".`,
      );
    }

    return normalized as QueryPeriod;
  }

  private normalizeAssigneeMode(mode: QueryMode, assigneeMode?: AssigneeMode): AssigneeMode {
    if (mode !== 'assignee') {
      return 'personal';
    }

    if (!assigneeMode) {
      return 'personal';
    }

    return assigneeMode;
  }

  private validateCustomRange(startDate?: string, endDate?: string): void {
    if (!startDate) {
      throw new Error('startDate is required when period is custom_range. Use YYYY-MM-DD format.');
    }

    if (!endDate) {
      throw new Error('endDate is required when period is custom_range. Use YYYY-MM-DD format.');
    }

    if (!DATE_PATTERN.test(startDate)) {
      throw new Error(`startDate must be in YYYY-MM-DD format. Received: "${startDate}".`);
    }

    if (!DATE_PATTERN.test(endDate)) {
      throw new Error(`endDate must be in YYYY-MM-DD format. Received: "${endDate}".`);
    }

    if (startDate > endDate) {
      throw new Error(`startDate (${startDate}) must not be after endDate (${endDate}).`);
    }
  }

  private normalizeAssignees(
    mode: QueryMode,
    assigneeMode: AssigneeMode,
    assignee?: string,
  ): string[] {
    if (mode === 'project') {
      return [];
    }

    if (mode === 'assignee' && assigneeMode === 'all') {
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
