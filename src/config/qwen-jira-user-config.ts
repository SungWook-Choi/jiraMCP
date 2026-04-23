import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

export interface QwenJiraUserConfig {
  serverPort: number;
  assigneeAllInclude: string[];
  resultOutputDir: string;
}

export const DEFAULT_QWEN_JIRA_USER_CONFIG: QwenJiraUserConfig = {
  serverPort: 3000,
  assigneeAllInclude: [],
  resultOutputDir: './output',
};

export function getQwenJiraUserConfigPath(baseDir = homedir()): string {
  return resolve(baseDir, '.qwen-jira-mcp', 'config.json');
}

export function normalizeQwenJiraUserConfig(
  input: Partial<QwenJiraUserConfig> | null | undefined,
): QwenJiraUserConfig {
  return {
    serverPort: normalizePositivePort(input?.serverPort),
    assigneeAllInclude: normalizeAssigneeAllInclude(input?.assigneeAllInclude),
    resultOutputDir: normalizeOutputDir(input?.resultOutputDir),
  };
}

export function resolveQwenJiraServerPort(
  envPort?: string,
  config?: QwenJiraUserConfig | null,
): number {
  const normalizedEnvPort = parsePositivePort(envPort);

  if (normalizedEnvPort !== null) {
    return normalizedEnvPort;
  }

  if (config !== null && config !== undefined) {
    return config.serverPort;
  }

  return DEFAULT_QWEN_JIRA_USER_CONFIG.serverPort;
}

export function resolveQwenJiraLocalServerBaseUrl(
  config?: QwenJiraUserConfig | null,
): string {
  const port = resolveQwenJiraServerPort(undefined, config);

  return `http://127.0.0.1:${port}`;
}

export function resolveQwenJiraResultOutputDir(
  config?: QwenJiraUserConfig | null,
  baseDir = process.cwd(),
): string {
  const configuredDir = config?.resultOutputDir?.trim();
  const outputDir =
    configuredDir !== undefined && configuredDir.length > 0
      ? configuredDir
      : DEFAULT_QWEN_JIRA_USER_CONFIG.resultOutputDir;

  return resolve(baseDir, outputDir);
}

export function resolveQwenJiraAssigneeAllInclude(
  config?: QwenJiraUserConfig | null,
): string[] {
  return [...(config?.assigneeAllInclude ?? [])];
}

export async function readQwenJiraUserConfig(
  configPath = getQwenJiraUserConfigPath(),
): Promise<QwenJiraUserConfig | null> {
  try {
    const content = await readFile(configPath, 'utf8');
    const parsed = JSON.parse(content) as Partial<QwenJiraUserConfig>;

    return normalizeQwenJiraUserConfig(parsed);
  } catch (error) {
    if (isFileMissingError(error)) {
      return null;
    }

    throw new Error(`Failed to read config file at ${configPath}: ${formatErrorMessage(error)}`);
  }
}

export async function writeQwenJiraUserConfig(
  config: QwenJiraUserConfig,
  configPath = getQwenJiraUserConfigPath(),
): Promise<void> {
  const normalized = normalizeQwenJiraUserConfig(config);
  const directory = resolve(configPath, '..');

  await mkdir(directory, { recursive: true });
  await writeFile(configPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
}

function normalizePositivePort(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.NaN;

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_QWEN_JIRA_USER_CONFIG.serverPort;
}

function parsePositivePort(value?: string): number | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return null;
}

function normalizeAssigneeAllInclude(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_QWEN_JIRA_USER_CONFIG.assigneeAllInclude];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function normalizeOutputDir(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';

  return normalized.length > 0 ? normalized : DEFAULT_QWEN_JIRA_USER_CONFIG.resultOutputDir;
}

function isFileMissingError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
