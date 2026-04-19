export interface JiraSettings {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey?: string;
  defaultPeriod: string;
}

export const REQUIRED_JIRA_ENV_KEYS = [
  'JIRA_BASE_URL',
  'JIRA_EMAIL',
  'JIRA_API_TOKEN',
] as const;

export function getMissingJiraEnv(env: NodeJS.ProcessEnv): string[] {
  return REQUIRED_JIRA_ENV_KEYS.filter((key) => {
    const value = env[key];
    return value === undefined || value.trim() === '';
  });
}
