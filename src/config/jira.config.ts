import { registerAs } from '@nestjs/config';

import { JiraSettings } from './jira-settings.js';

export const jiraConfig = registerAs(
  'jira',
  (): JiraSettings => ({
    baseUrl: process.env.JIRA_BASE_URL ?? '',
    email: process.env.JIRA_EMAIL ?? '',
    apiToken: process.env.JIRA_API_TOKEN ?? '',
    projectKey: process.env.JIRA_PROJECT_KEY,
    defaultPeriod: process.env.JIRA_DEFAULT_PERIOD ?? 'this_week',
  }),
);
