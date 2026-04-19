import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { QueryMode } from '../query/query.schema.js';
import { CliApiClient, JiraSearchApiResponse } from './cli-api.client.js';
import { CliCollectedQuery } from './cli.types.js';

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

    const query = await this.promptForQuery();
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

  private async promptForQuery(): Promise<CliCollectedQuery> {
    const readline = createInterface({ input, output });

    try {
      const mode = await this.promptForMode(readline);
      const assignee =
        mode === 'assignee' || mode === 'assignee_project'
          ? await this.askRequiredQuestion(readline, 'Assignee: ')
          : undefined;
      const projectKey =
        mode === 'project' || mode === 'assignee_project'
          ? await this.askRequiredQuestion(readline, 'Project key: ')
          : undefined;
      const periodInput = await readline.question('Period (default: this_week): ');
      const shouldSaveMarkdown = await this.askYesNoQuestion(
        readline,
        'Save result as Markdown? [y/N]: ',
      );

      return {
        mode,
        assignee,
        projectKey,
        period: periodInput,
        outputFormat: shouldSaveMarkdown ? 'markdown' : 'console',
      };
    } finally {
      readline.close();
    }
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
