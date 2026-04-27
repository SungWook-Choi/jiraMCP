import { Injectable } from '@nestjs/common';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import {
  DEFAULT_QWEN_JIRA_USER_CONFIG,
  getQwenJiraUserConfigPath,
  QwenJiraUserConfig,
  readQwenJiraUserConfig,
  WEEKLY_REPORT_WEEKDAYS,
  WeeklyReportWeekday,
  writeQwenJiraUserConfig,
} from '../config/qwen-jira-user-config.js';

@Injectable()
export class ConfigCliService {
  async run(): Promise<void> {
    const configPath = getQwenJiraUserConfigPath();
    const currentConfig =
      (await readQwenJiraUserConfig(configPath)) ?? DEFAULT_QWEN_JIRA_USER_CONFIG;
    const readline = createInterface({ input, output });

    try {
      process.stdout.write('qwen-jira-config\n');
      process.stdout.write(`설정 파일: ${configPath}\n`);

      const nextConfig: QwenJiraUserConfig = {
        serverPort: await this.promptForPort(readline, currentConfig.serverPort),
        assigneeAllInclude: await this.promptForAssigneeAllInclude(
          readline,
          currentConfig.assigneeAllInclude,
        ),
        resultOutputDir: await this.promptForOutputDir(
          readline,
          currentConfig.resultOutputDir,
        ),
        weeklyReportWeekday: await this.promptForWeeklyReportWeekday(
          readline,
          currentConfig.weeklyReportWeekday,
        ),
        weeklyReportHour: await this.promptForWeeklyReportHour(
          readline,
          currentConfig.weeklyReportHour,
        ),
      };

      process.stdout.write('\n');
      process.stdout.write('설정 미리보기:\n');
      process.stdout.write(`- serverPort: ${nextConfig.serverPort}\n`);
      process.stdout.write(
        `- assigneeAllInclude: ${
          nextConfig.assigneeAllInclude.length > 0
            ? nextConfig.assigneeAllInclude.join(', ')
            : '(없음)'
        }\n`,
      );
      process.stdout.write(`- resultOutputDir: ${nextConfig.resultOutputDir}\n`);
      process.stdout.write(
        `- weeklyReportWeekday: ${nextConfig.weeklyReportWeekday ?? '(없음)'}\n`,
      );
      process.stdout.write(
        `- weeklyReportHour: ${
          nextConfig.weeklyReportHour !== undefined ? nextConfig.weeklyReportHour : '(없음)'
        }\n`,
      );

      const confirmed = await this.askYesNoQuestion(readline, '저장하시겠습니까? (Y/N): ');

      if (!confirmed) {
        process.stdout.write('설정 저장을 취소했습니다.\n');
        return;
      }

      await writeQwenJiraUserConfig(nextConfig, configPath);
      process.stdout.write(`설정을 저장했습니다: ${configPath}\n`);
    } finally {
      readline.close();
    }
  }

  private async promptForPort(
    readline: ReturnType<typeof createInterface>,
    currentValue: number,
  ): Promise<number> {
    const shouldEdit = await this.askYesNoQuestion(
      readline,
      `포트를 수정하시겠습니까? (Y/N) [현재: ${currentValue}]: `,
    );

    if (!shouldEdit) {
      return currentValue;
    }

    while (true) {
      const answer = await this.askRequiredQuestion(readline, '포트를 입력하세요: ');
      const parsed = Number.parseInt(answer, 10);

      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }

      process.stdout.write('유효한 양의 정수를 입력해주세요.\n');
    }
  }

  private async promptForAssigneeAllInclude(
    readline: ReturnType<typeof createInterface>,
    currentValue: string[],
  ): Promise<string[]> {
    const currentLabel = currentValue.length > 0 ? currentValue.join(', ') : '(없음)';
    const shouldEdit = await this.askYesNoQuestion(
      readline,
      `전체 조회에 포함할 담당자를 수정하시겠습니까? (Y/N) [현재: ${currentLabel}]: `,
    );

    if (!shouldEdit) {
      return currentValue;
    }

    const answer = await this.askRequiredQuestion(
      readline,
      '쉼표로 구분해서 입력하세요: ',
    );

    return answer
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private async promptForOutputDir(
    readline: ReturnType<typeof createInterface>,
    currentValue: string,
  ): Promise<string> {
    const shouldEdit = await this.askYesNoQuestion(
      readline,
      `결과 출력 폴더를 수정하시겠습니까? (Y/N) [현재: ${currentValue}]: `,
    );

    if (!shouldEdit) {
      return currentValue;
    }

    while (true) {
      const answer = (await readline.question('결과 출력 폴더를 입력하세요: ')).trim();

      if (answer.length > 0) {
        return answer;
      }

      process.stdout.write('출력 폴더 경로는 비워둘 수 없습니다.\n');
    }
  }

  private async promptForWeeklyReportWeekday(
    readline: ReturnType<typeof createInterface>,
    currentValue?: WeeklyReportWeekday,
  ): Promise<WeeklyReportWeekday | undefined> {
    const currentLabel = currentValue ?? '(없음)';
    const shouldEdit = await this.askYesNoQuestion(
      readline,
      `주간보고 실행 요일을 수정하시겠습니까? (Y/N) [현재: ${currentLabel}]: `,
    );

    if (!shouldEdit) {
      return currentValue;
    }

    process.stdout.write('요일을 선택하세요:\n');

    WEEKLY_REPORT_WEEKDAYS.forEach((weekday, index) => {
      process.stdout.write(`${index + 1}. ${weekday}\n`);
    });

    while (true) {
      const answer = (await readline.question(`요일 [1-${WEEKLY_REPORT_WEEKDAYS.length}]: `)).trim();
      const parsed = Number.parseInt(answer, 10);

      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= WEEKLY_REPORT_WEEKDAYS.length) {
        return WEEKLY_REPORT_WEEKDAYS[parsed - 1];
      }

      process.stdout.write(
        `1부터 ${WEEKLY_REPORT_WEEKDAYS.length} 사이의 숫자를 입력해주세요.\n`,
      );
    }
  }

  private async promptForWeeklyReportHour(
    readline: ReturnType<typeof createInterface>,
    currentValue?: number,
  ): Promise<number | undefined> {
    const currentLabel = currentValue !== undefined ? String(currentValue) : '(없음)';
    const shouldEdit = await this.askYesNoQuestion(
      readline,
      `주간보고 실행 시간을 수정하시겠습니까? (Y/N) [현재: ${currentLabel}]: `,
    );

    if (!shouldEdit) {
      return currentValue;
    }

    while (true) {
      const answer = (await readline.question('실행 시간을 입력하세요 (0-23): ')).trim();
      const parsed = Number.parseInt(answer, 10);

      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 23) {
        return parsed;
      }

      process.stdout.write('0부터 23 사이의 정수를 입력해주세요.\n');
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

      process.stdout.write('값을 입력해주세요.\n');
    }
  }

  private async askYesNoQuestion(
    readline: ReturnType<typeof createInterface>,
    prompt: string,
  ): Promise<boolean> {
    while (true) {
      const answer = (await readline.question(prompt)).trim().toLowerCase();

      if (answer === '' || answer === 'n' || answer === 'no' || answer === '아니오') {
        return false;
      }

      if (answer === 'y' || answer === 'yes' || answer === '예') {
        return true;
      }

      process.stdout.write('Y 또는 N으로 입력해주세요.\n');
    }
  }
}
