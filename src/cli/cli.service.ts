import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { AssigneeMode, QueryMode, VALID_PERIODS } from '../query/query.schema.js';
import { CliApiClient, JiraSearchApiResponse } from './cli-api.client.js';
import {
  CliCollectedComment,
  CliCollectedQuery,
  CliCommentType,
  CliIssueSelectionMethod,
  CliTopLevelAction,
} from './cli.types.js';

const PERIOD_LABELS: Record<string, string> = {
  this_week: 'this_week  (이번 주)',
  last_week: 'last_week  (지난 주)',
  today: 'today      (오늘)',
  yesterday: 'yesterday  (어제)',
  custom_range: 'custom_range (날짜 범위 직접 입력)',
};

@Injectable()
export class CliService {
  constructor(private readonly cliApiClient: CliApiClient) {}

  async run(): Promise<void> {
    process.stdout.write('qwen-jira CLI\n');

    let healthStatus: Awaited<ReturnType<CliApiClient['getHealthStatus']>>;

    try {
      healthStatus = await this.cliApiClient.getHealthStatus();
    } catch (error) {
      process.stdout.write(`${this.formatErrorMessage(error)}\n`);
      return;
    }

    if (!healthStatus.jiraConfigured) {
      process.stdout.write(
        `Missing Jira environment variables on local server: ${healthStatus.missingEnv.join(', ')}\n`,
      );
      return;
    }

    process.stdout.write(`${this.cliApiClient.describeTarget()}\n`);

    const readline = createInterface({ input, output });

    try {
      const action = await this.promptForTopLevelAction(readline);

      if (action === 'query') {
        await this.runQueryFlow(readline);
        return;
      }

      await this.runCommentFlow(readline);
    } finally {
      readline.close();
    }
  }

  private async runQueryFlow(readline: ReturnType<typeof createInterface>): Promise<void> {
    const query = await this.promptForQuery(readline);
    let jiraResult: JiraSearchApiResponse;

    try {
      jiraResult = await this.cliApiClient.searchJira(query);
    } catch (error) {
      process.stdout.write(`Jira search failed: ${this.formatErrorMessage(error)}\n`);
      return;
    }

    process.stdout.write('\n');
    process.stdout.write(`Selected mode: ${jiraResult.query.mode}\n`);
    process.stdout.write(`Prepared JQL: ${jiraResult.request.jql}\n`);
    process.stdout.write(`Returned issues: ${jiraResult.issues.length}`);

    if (jiraResult.total > jiraResult.issues.length) {
      process.stdout.write(` of ${jiraResult.total}`);
    }

    process.stdout.write('\n');
    process.stdout.write(`${jiraResult.consoleRendered}\n`);

    if (jiraResult.query.output.format === 'markdown') {
      try {
        const savedPath = await this.saveMarkdownResult(jiraResult);
        process.stdout.write(`Markdown saved: ${savedPath}\n`);
      } catch (error) {
        process.stdout.write(`Markdown save failed: ${this.formatErrorMessage(error)}\n`);
      }
    }
  }

  private async runCommentFlow(readline: ReturnType<typeof createInterface>): Promise<void> {
    const comment = await this.promptForComment(readline);

    process.stdout.write('\n');
    process.stdout.write('Comment submission preview:\n');
    process.stdout.write(`Type: ${comment.commentType}\n`);
    process.stdout.write(`Issue: [${comment.issueKey}] ${comment.issueSummary}\n`);
    process.stdout.write(`Selection method: ${comment.issueSelectionMethod}\n`);
    process.stdout.write('Body:\n');
    process.stdout.write(`${comment.finalBody}\n`);

    const confirmed = await this.askYesNoQuestion(readline, 'Submit comment? [y/N]: ');

    if (!confirmed) {
      process.stdout.write('Comment submission cancelled.\n');
      return;
    }

    try {
      const result = await this.cliApiClient.createComment({
        issueKey: comment.issueKey,
        body: comment.finalBody,
      });

      process.stdout.write(
        `Comment created successfully: [${result.issueKey}] commentId=${result.commentId}\n`,
      );
    } catch (error) {
      process.stdout.write(`Comment submission failed: ${this.formatErrorMessage(error)}\n`);
    }
  }

  private async promptForTopLevelAction(
    readline: ReturnType<typeof createInterface>,
  ): Promise<CliTopLevelAction> {
    process.stdout.write('첫 작업을 선택하세요:\n');
    process.stdout.write('1. 조회\n');
    process.stdout.write('2. 댓글 입력\n');

    while (true) {
      const answer = (await readline.question('선택 [1-2, default: 1]: ')).trim();

      if (answer === '' || answer === '1' || answer === '조회') {
        return 'query';
      }

      if (answer === '2' || answer === '댓글 입력') {
        return 'comment';
      }

      process.stdout.write('1 또는 2를 입력해주세요.\n');
    }
  }

  private async promptForComment(
    readline: ReturnType<typeof createInterface>,
  ): Promise<CliCollectedComment> {
    const commentType = await this.promptForCommentType(readline);
    const issueSelectionMethod = await this.promptForIssueSelectionMethod(readline);
    const issue =
      issueSelectionMethod === 'search_title'
        ? await this.promptForIssueByTitle(readline)
        : await this.promptForIssueByKey(readline);
    const rawBody = await this.askRequiredQuestion(readline, '댓글 내용: ');
    const finalBody = this.buildCommentBody(commentType, rawBody);

    return {
      commentType,
      issueSelectionMethod,
      issueKey: issue.key,
      issueSummary: issue.summary,
      rawBody,
      finalBody,
    };
  }

  private async promptForCommentType(
    readline: ReturnType<typeof createInterface>,
  ): Promise<CliCommentType> {
    process.stdout.write('댓글 유형을 선택하세요:\n');
    process.stdout.write('1. 기본\n');
    process.stdout.write('2. 주간이슈\n');

    while (true) {
      const answer = (await readline.question('유형 [1-2, default: 1]: ')).trim();

      if (answer === '' || answer === '1' || answer === '기본') {
        return 'basic';
      }

      if (answer === '2' || answer === '주간이슈') {
        return 'weekly_issue';
      }

      process.stdout.write('1 또는 2를 입력해주세요.\n');
    }
  }

  private async promptForIssueSelectionMethod(
    readline: ReturnType<typeof createInterface>,
  ): Promise<CliIssueSelectionMethod> {
    process.stdout.write('이슈 선택 방식을 고르세요:\n');
    process.stdout.write('1. 이슈명 검색\n');
    process.stdout.write('2. 이슈 키 직접 입력\n');

    while (true) {
      const answer = (await readline.question('방식 [1-2, default: 1]: ')).trim();

      if (answer === '' || answer === '1') {
        return 'search_title';
      }

      if (answer === '2') {
        return 'direct_key';
      }

      process.stdout.write('1 또는 2를 입력해주세요.\n');
    }
  }

  private async promptForIssueByTitle(
    readline: ReturnType<typeof createInterface>,
  ): Promise<{ key: string; summary: string }> {
    while (true) {
      const titleQuery = await this.askRequiredQuestion(readline, '이슈명 검색어: ');

      try {
        const candidates = await this.cliApiClient.searchIssuesByTitle(titleQuery);

        if (candidates.length === 0) {
          process.stdout.write(
            `"${titleQuery}"와 일치하는 이슈가 없습니다. 다른 검색어를 입력해주세요.\n`,
          );
          continue;
        }

        if (candidates.length === 1) {
          process.stdout.write(
            `이슈 자동 선택: [${candidates[0].key}] ${candidates[0].summary}\n`,
          );

          return {
            key: candidates[0].key,
            summary: candidates[0].summary,
          };
        }

        process.stdout.write(`검색 결과 ${candidates.length}건:\n`);

        candidates.forEach((candidate, index) => {
          process.stdout.write(
            `${index + 1}. [${candidate.key}] ${candidate.summary} (${candidate.status})\n`,
          );
        });

        while (true) {
          const answer = (await readline.question(`이슈 선택 [1-${candidates.length}]: `)).trim();
          const index = Number.parseInt(answer, 10) - 1;

          if (!Number.isNaN(index) && index >= 0 && index < candidates.length) {
            return {
              key: candidates[index].key,
              summary: candidates[index].summary,
            };
          }

          process.stdout.write(`1부터 ${candidates.length} 사이의 숫자를 입력해주세요.\n`);
        }
      } catch (error) {
        process.stdout.write(`이슈 검색 실패: ${this.formatErrorMessage(error)}\n`);
      }
    }
  }

  private async promptForIssueByKey(
    readline: ReturnType<typeof createInterface>,
  ): Promise<{ key: string; summary: string }> {
    while (true) {
      const issueKey = (await this.askRequiredQuestion(readline, '이슈 키: ')).toUpperCase();

      try {
        const issue = await this.cliApiClient.getIssueByKey(issueKey);
        process.stdout.write(`이슈 확인: [${issue.key}] ${issue.summary}\n`);

        return {
          key: issue.key,
          summary: issue.summary,
        };
      } catch (error) {
        process.stdout.write(`이슈 확인 실패: ${this.formatErrorMessage(error)}\n`);
      }
    }
  }

  private buildCommentBody(commentType: CliCommentType, rawBody: string): string {
    if (commentType === 'weekly_issue') {
      return `[주간 이슈]\n${rawBody}`;
    }

    return rawBody;
  }

  private async promptForQuery(
    readline: ReturnType<typeof createInterface>,
  ): Promise<CliCollectedQuery> {
    const mode = await this.promptForMode(readline);
    const assigneeMode = mode === 'assignee' ? await this.promptForAssigneeMode(readline) : undefined;
    const assignee =
      (mode === 'assignee' && assigneeMode !== 'all') || mode === 'assignee_project'
        ? await this.askRequiredQuestion(readline, 'Assignee: ')
        : undefined;
    const projectKey =
      mode === 'project' || mode === 'assignee_project'
        ? await this.promptForProjectKey(readline)
        : undefined;
    const { period, startDate, endDate } =
      mode === 'assignee' && assigneeMode === 'all'
        ? { period: 'this_week' }
        : await this.promptForPeriod(readline);
    const shouldSaveMarkdown = await this.askYesNoQuestion(
      readline,
      'Save result as Markdown? [y/N]: ',
    );

    return {
      mode,
      assigneeMode,
      assignee,
      projectKey,
      period,
      startDate,
      endDate,
      outputFormat: shouldSaveMarkdown ? 'markdown' : 'console',
    };
  }

  private async promptForMode(
    readline: ReturnType<typeof createInterface>,
  ): Promise<QueryMode> {
    process.stdout.write('Select query mode:\n');
    process.stdout.write('1. assignee\n');
    process.stdout.write('2. project\n');
    process.stdout.write('3. assignee_project\n');

    while (true) {
      const answer = (await readline.question('Mode [1-3]: ')).trim();

      if (answer === '1' || answer === 'assignee') {
        return 'assignee';
      }

      if (answer === '2' || answer === 'project') {
        return 'project';
      }

      if (answer === '3' || answer === 'assignee_project') {
        return 'assignee_project';
      }

      process.stdout.write('Please choose 1, 2, 3, assignee, project, or assignee_project.\n');
    }
  }

  private async promptForAssigneeMode(
    readline: ReturnType<typeof createInterface>,
  ): Promise<AssigneeMode> {
    process.stdout.write('Assignee query type:\n');
    process.stdout.write('1. personal\n');
    process.stdout.write('2. all\n');

    while (true) {
      const answer = (await readline.question('Type [1-2]: ')).trim().toLowerCase();

      if (answer === '1' || answer === 'personal') {
        return 'personal';
      }

      if (answer === '2' || answer === 'all') {
        return 'all';
      }

      process.stdout.write('Please choose 1, 2, personal, or all.\n');
    }
  }

  private async promptForProjectKey(
    readline: ReturnType<typeof createInterface>,
  ): Promise<string> {
    process.stdout.write('Project input method:\n');
    process.stdout.write('1. Project key 직접 입력\n');
    process.stdout.write('2. 프로젝트 이름으로 검색\n');

    while (true) {
      const answer = (await readline.question('Method [1-2]: ')).trim();

      if (answer === '1') {
        const key = await this.askRequiredQuestion(readline, 'Project key: ');
        const confirmed = await this.confirmProjectKey(key);

        if (confirmed) {
          return key;
        }

        continue;
      }

      if (answer === '2') {
        const key = await this.promptForProjectByName(readline);

        if (key) {
          return key;
        }

        process.stdout.write('프로젝트를 선택하지 못했습니다. 다시 선택해주세요.\n');
        continue;
      }

      process.stdout.write('Please choose 1 or 2.\n');
    }
  }

  private async confirmProjectKey(key: string): Promise<boolean> {
    let candidates: Array<{ key: string; name: string }>;

    try {
      candidates = await this.cliApiClient.lookupProjects(key);
    } catch {
      process.stdout.write(
        '프로젝트 키 유효성 확인 실패: 서버와 연결할 수 없습니다. 키를 그대로 사용합니다.\n',
      );
      return true;
    }

    const matched = candidates.find((c) => c.key.toUpperCase() === key.toUpperCase());

    if (matched) {
      process.stdout.write(`프로젝트 확인: [${matched.key}] ${matched.name}\n`);
      return true;
    }

    process.stdout.write(
      `프로젝트 키 "${key}"를 찾을 수 없습니다.\n` +
        `키가 정확한지 확인하거나, [2]번 이름 검색을 사용해주세요.\n`,
    );
    return false;
  }

  private async promptForProjectByName(
    readline: ReturnType<typeof createInterface>,
  ): Promise<string | null> {
    const nameQuery = (await readline.question('프로젝트 이름 (일부 입력): ')).trim();

    if (!nameQuery) {
      process.stdout.write('검색어를 입력해주세요.\n');
      return null;
    }

    let candidates: Array<{ key: string; name: string }>;

    try {
      candidates = await this.cliApiClient.lookupProjects(nameQuery);
    } catch (error) {
      process.stdout.write(`프로젝트 검색 실패: ${this.formatErrorMessage(error)}\n`);
      return null;
    }

    if (candidates.length === 0) {
      process.stdout.write(
        `"${nameQuery}"와 일치하는 프로젝트가 없습니다. 다른 검색어를 사용하거나 project key를 직접 입력해주세요.\n`,
      );
      return null;
    }

    if (candidates.length === 1) {
      process.stdout.write(`프로젝트 자동 선택: [${candidates[0].key}] ${candidates[0].name}\n`);
      return candidates[0].key;
    }

    process.stdout.write(`검색 결과 ${candidates.length}건:\n`);

    candidates.forEach((c, i) => {
      process.stdout.write(`${i + 1}. [${c.key}] ${c.name}\n`);
    });

    while (true) {
      const answer = (await readline.question(`프로젝트 선택 [1-${candidates.length}]: `)).trim();
      const index = parseInt(answer, 10) - 1;

      if (!isNaN(index) && index >= 0 && index < candidates.length) {
        return candidates[index].key;
      }

      process.stdout.write(`1부터 ${candidates.length} 사이의 숫자를 입력해주세요.\n`);
    }
  }

  private async promptForPeriod(
    readline: ReturnType<typeof createInterface>,
  ): Promise<{ period: string; startDate?: string; endDate?: string }> {
    process.stdout.write('Select period:\n');

    VALID_PERIODS.forEach((p, i) => {
      process.stdout.write(`${i + 1}. ${PERIOD_LABELS[p] ?? p}\n`);
    });

    let period: string = 'this_week';

    while (true) {
      const answer = (await readline.question('Period [1-5, default: 1]: ')).trim();

      if (answer === '') {
        period = 'this_week';
        break;
      }

      const index = parseInt(answer, 10) - 1;

      if (!isNaN(index) && index >= 0 && index < VALID_PERIODS.length) {
        period = VALID_PERIODS[index];
        break;
      }

      process.stdout.write(`1부터 ${VALID_PERIODS.length} 사이의 숫자를 입력해주세요.\n`);
    }

    if (period !== 'custom_range') {
      return { period };
    }

    while (true) {
      const startDate = await this.askDateQuestion(readline, 'Start date (YYYY-MM-DD): ');
      const endDate = await this.askDateQuestion(readline, 'End date (YYYY-MM-DD): ');

      if (startDate > endDate) {
        process.stdout.write(
          `오류: 시작일(${startDate})이 종료일(${endDate})보다 늦습니다. 날짜를 다시 입력해주세요.\n`,
        );
        continue;
      }

      return { period, startDate, endDate };
    }
  }

  private async askDateQuestion(
    readline: ReturnType<typeof createInterface>,
    prompt: string,
  ): Promise<string> {
    const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

    while (true) {
      const answer = (await readline.question(prompt)).trim();

      if (DATE_PATTERN.test(answer)) {
        return answer;
      }

      process.stdout.write('날짜는 YYYY-MM-DD 형식으로 입력해주세요. (예: 2025-01-01)\n');
    }
  }

  private async askRequiredQuestion(
    readline: ReturnType<typeof createInterface>,
    prompt: string,
  ): Promise<string> {
    while (true) {
      const answer = (await readline.question(prompt)).trim();

      if (answer.length > 0) {
        return answer;
      }

      process.stdout.write('This field is required.\n');
    }
  }

  private async askYesNoQuestion(
    readline: ReturnType<typeof createInterface>,
    prompt: string,
  ): Promise<boolean> {
    while (true) {
      const answer = (await readline.question(prompt)).trim().toLowerCase();

      if (answer === '' || answer === 'n' || answer === 'no') {
        return false;
      }

      if (answer === 'y' || answer === 'yes') {
        return true;
      }

      process.stdout.write('Please answer y, yes, n, no, or press Enter for no.\n');
    }
  }

  private async saveMarkdownResult(jiraResult: JiraSearchApiResponse): Promise<string> {
    const outputDirectory = join(process.cwd(), 'output');
    const fileName = `jira-result-${jiraResult.query.mode}-${this.createTimestamp()}.md`;
    const filePath = join(outputDirectory, fileName);

    await mkdir(outputDirectory, { recursive: true });
    await writeFile(filePath, jiraResult.markdownRendered, 'utf8');

    return filePath;
  }

  private createTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    const hours = `${now.getHours()}`.padStart(2, '0');
    const minutes = `${now.getMinutes()}`.padStart(2, '0');
    const seconds = `${now.getSeconds()}`.padStart(2, '0');

    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
  }

  private formatErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    return 'Unknown Jira error.';
  }
}
