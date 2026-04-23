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

export class AssigneeAllConfigError extends Error {
  constructor() {
    super('assigneeMode=all은 qwen-jira-config에서 assigneeAllInclude를 설정해야 합니다.');
    this.name = 'AssigneeAllConfigError';
  }
}

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
  }, options?: {
    assigneeAllInclude?: string[];
  }): QuerySchema {
    const assigneeMode = this.normalizeAssigneeMode(input.mode, input.assigneeMode);
    const period = this.normalizePeriod(input.period, input.mode, assigneeMode);

    if (period === 'custom_range') {
      this.validateCustomRange(input.startDate, input.endDate);
    }

    return {
      mode: input.mode,
      assigneeMode,
      assignees: this.normalizeAssignees(
        input.mode,
        assigneeMode,
        input.assignee,
        options?.assigneeAllInclude,
      ),
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
        `period는 다음 중 하나여야 합니다: ${VALID_PERIODS.join(', ')}. 입력값: "${normalized}".`,
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
      throw new Error('period가 custom_range일 때는 startDate가 필요합니다. YYYY-MM-DD 형식을 사용해주세요.');
    }

    if (!endDate) {
      throw new Error('period가 custom_range일 때는 endDate가 필요합니다. YYYY-MM-DD 형식을 사용해주세요.');
    }

    if (!DATE_PATTERN.test(startDate)) {
      throw new Error(`startDate는 YYYY-MM-DD 형식이어야 합니다. 입력값: "${startDate}".`);
    }

    if (!DATE_PATTERN.test(endDate)) {
      throw new Error(`endDate는 YYYY-MM-DD 형식이어야 합니다. 입력값: "${endDate}".`);
    }

    if (startDate > endDate) {
      throw new Error(`startDate (${startDate})는 endDate (${endDate})보다 늦을 수 없습니다.`);
    }
  }

  private normalizeAssignees(
    mode: QueryMode,
    assigneeMode: AssigneeMode,
    assignee?: string,
    assigneeAllInclude?: string[],
  ): string[] {
    if (mode === 'project') {
      return [];
    }

    if (mode === 'assignee' && assigneeMode === 'all') {
      const includedAssignees = (assigneeAllInclude ?? [])
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);

      if (includedAssignees.length === 0) {
        throw new AssigneeAllConfigError();
      }

      return includedAssignees;
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
