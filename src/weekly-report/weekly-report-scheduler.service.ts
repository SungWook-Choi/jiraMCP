import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  QwenJiraUserConfig,
  readQwenJiraUserConfig,
  resolveQwenJiraWeeklyReportOutputDir,
  WEEKLY_REPORT_WEEKDAYS,
  WeeklyReportWeekday,
} from '../config/qwen-jira-user-config.js';
import { JiraService } from '../jira/jira.service.js';

const POLL_INTERVAL_MS = 60_000;
const SEOUL_TIME_ZONE_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEK_TIME_SPAN_MS = 7 * 24 * 60 * 60 * 1000;

interface WeeklyReportSchedule {
  weekday: WeeklyReportWeekday;
  hour: number;
}

@Injectable()
export class WeeklyReportSchedulerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WeeklyReportSchedulerService.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private evaluationInFlight = false;
  private lastAttemptedCycleKey: string | null = null;
  private lastDisabledSignature: string | null = null;

  constructor(private readonly jiraService: JiraService) {}

  async onApplicationBootstrap(): Promise<void> {
    this.startPolling();
    await this.evaluateOnce();
  }

  onApplicationShutdown(): void {
    this.stopPolling();
  }

  private startPolling(): void {
    if (this.pollTimer !== null) {
      return;
    }

    this.logger.log(`Weekly report scheduler started with ${POLL_INTERVAL_MS / 1000} second polling.`);
    this.pollTimer = setInterval(() => {
      void this.evaluateOnce();
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer === null) {
      return;
    }

    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async evaluateOnce(): Promise<void> {
    if (this.evaluationInFlight) {
      return;
    }

    this.evaluationInFlight = true;

    try {
      const userConfig = await readQwenJiraUserConfig();
      const schedule = this.resolveSchedule(userConfig);

      if (schedule === null) {
        this.logDisabledOnce(userConfig);
        return;
      }

      this.lastDisabledSignature = null;

      const seoulNow = this.toSeoulDate(new Date());

      if (!this.isMatchingSchedule(seoulNow, schedule)) {
        return;
      }

      const endBoundary = this.createSeoulBoundary(seoulNow, schedule.hour);
      const cycleKey = this.formatIsoWeekKey(endBoundary);

      if (this.lastAttemptedCycleKey === cycleKey) {
        return;
      }

      this.lastAttemptedCycleKey = cycleKey;

      await this.generateWeeklyReport(userConfig, endBoundary, cycleKey);
    } catch (error) {
      this.logger.error(`Weekly report scheduler failed: ${this.formatErrorMessage(error)}`);
    } finally {
      this.evaluationInFlight = false;
    }
  }

  private async generateWeeklyReport(
    userConfig: QwenJiraUserConfig | null,
    endBoundary: Date,
    cycleKey: string,
  ): Promise<void> {
    const startBoundary = new Date(endBoundary.getTime() - WEEK_TIME_SPAN_MS);

    try {
      const accountId = await this.jiraService.getCurrentUserAccountId();
      const issues = await this.jiraService.searchWeeklyReportIssues(
        accountId,
        startBoundary,
        endBoundary,
      );
      const outputDir = resolveQwenJiraWeeklyReportOutputDir(userConfig);
      const filePath = join(outputDir, `jira-weekly-report-${cycleKey}.md`);
      const content = this.renderWeeklyReportContent(cycleKey, issues);

      await mkdir(outputDir, { recursive: true });
      await writeFile(filePath, content, 'utf8');

      this.logger.log(
        `Weekly report generated: ${filePath} (${issues.length} issues, accountId=${accountId}, window=${startBoundary.toISOString()}~${endBoundary.toISOString()})`,
      );
    } catch (error) {
      this.logger.error(
        `Weekly report generation failed for ${cycleKey}: ${this.formatErrorMessage(error)}`,
      );
    }
  }

  private resolveSchedule(config: QwenJiraUserConfig | null): WeeklyReportSchedule | null {
    const weekday = config?.weeklyReportWeekday;
    const hour = config?.weeklyReportHour;

    if (weekday === undefined || hour === undefined) {
      return null;
    }

    if (!WEEKLY_REPORT_WEEKDAYS.includes(weekday)) {
      return null;
    }

    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      return null;
    }

    return {
      weekday,
      hour,
    };
  }

  private logDisabledOnce(config: QwenJiraUserConfig | null): void {
    const signature = JSON.stringify({
      weekday: config?.weeklyReportWeekday ?? null,
      hour: config?.weeklyReportHour ?? null,
    });

    if (this.lastDisabledSignature === signature) {
      return;
    }

    this.lastDisabledSignature = signature;
    this.logger.warn('Weekly report scheduler is disabled because weeklyReportWeekday or weeklyReportHour is missing.');
  }

  private isMatchingSchedule(nowInSeoul: Date, schedule: WeeklyReportSchedule): boolean {
    return (
      this.getSeoulWeekdayIndex(nowInSeoul) === this.weekdayToIndex(schedule.weekday) &&
      nowInSeoul.getUTCHours() === schedule.hour
    );
  }

  private renderWeeklyReportContent(
    cycleKey: string,
    issues: Array<{
      key: string;
      summary: string;
      projectKey: string | null;
      projectName: string | null;
    }>,
  ): string {
    const title = `## ${cycleKey} 주간보고`;

    if (issues.length === 0) {
      return `${title}\n`;
    }

    const items = issues.map((issue, index) => {
      const projectLabel = issue.projectName ?? issue.projectKey ?? '(unknown project)';

      return `${index + 1}. [${projectLabel}] ${issue.summary}`;
    });

    return `${title}\n\n${items.join('\n')}\n`;
  }

  private toSeoulDate(date: Date): Date {
    return new Date(date.getTime() + SEOUL_TIME_ZONE_OFFSET_MS);
  }

  private createSeoulBoundary(nowInSeoul: Date, hour: number): Date {
    return new Date(
      Date.UTC(
        nowInSeoul.getUTCFullYear(),
        nowInSeoul.getUTCMonth(),
        nowInSeoul.getUTCDate(),
        hour - 9,
        0,
        0,
        0,
      ),
    );
  }

  private getSeoulWeekdayIndex(nowInSeoul: Date): number {
    return nowInSeoul.getUTCDay();
  }

  private weekdayToIndex(weekday: WeeklyReportWeekday): number {
    switch (weekday) {
      case 'monday':
        return 1;
      case 'tuesday':
        return 2;
      case 'wednesday':
        return 3;
      case 'thursday':
        return 4;
      case 'friday':
        return 5;
      case 'saturday':
        return 6;
      case 'sunday':
        return 0;
    }
  }

  private formatIsoWeekKey(endBoundary: Date): string {
    const { weekYear, weekNumber } = this.getIsoWeekInfo(endBoundary);
    const paddedWeekNumber = String(weekNumber).padStart(2, '0');

    return `${weekYear}-W${paddedWeekNumber}`;
  }

  private getIsoWeekInfo(seoulDate: Date): { weekYear: number; weekNumber: number } {
    const date = new Date(
      Date.UTC(seoulDate.getUTCFullYear(), seoulDate.getUTCMonth(), seoulDate.getUTCDate()),
    );
    const dayNumber = date.getUTCDay() || 7;

    date.setUTCDate(date.getUTCDate() + 4 - dayNumber);

    const weekYear = date.getUTCFullYear();
    const yearStart = new Date(Date.UTC(weekYear, 0, 1));
    const weekNumber = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    return {
      weekYear,
      weekNumber,
    };
  }

  private formatErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    return String(error);
  }
}
