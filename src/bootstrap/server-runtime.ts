import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const RUNTIME_DIR_NAME = '.qwen-jira';
const SERVER_STATE_FILE_NAME = 'server-state.json';
const SERVER_LOG_FILE_NAME = 'server.log';

export interface ServerRuntimePaths {
  runtimeDir: string;
  statePath: string;
  logPath: string;
}

export interface ServerRuntimeState {
  pid: number;
  status: 'starting' | 'running';
  startedAt: string;
  cwd: string;
  logPath: string;
  host?: string;
  port?: number;
}

export function getServerRuntimePaths(baseDir = process.cwd()): ServerRuntimePaths {
  const runtimeDir = resolve(baseDir, RUNTIME_DIR_NAME);

  return {
    runtimeDir,
    statePath: resolve(runtimeDir, SERVER_STATE_FILE_NAME),
    logPath: resolve(runtimeDir, SERVER_LOG_FILE_NAME),
  };
}

export function getServerRuntimePathsFromEnv(): ServerRuntimePaths | null {
  const runtimeDir = process.env.QWEN_JIRA_SERVER_RUNTIME_DIR?.trim();
  const statePath = process.env.QWEN_JIRA_SERVER_STATE_PATH?.trim();
  const logPath = process.env.QWEN_JIRA_SERVER_LOG_PATH?.trim();

  if (!runtimeDir || !statePath || !logPath) {
    return null;
  }

  return {
    runtimeDir,
    statePath,
    logPath,
  };
}

export function ensureServerRuntimeDir(paths: ServerRuntimePaths): void {
  mkdirSync(paths.runtimeDir, { recursive: true });
}

export function readServerRuntimeState(paths: ServerRuntimePaths): ServerRuntimeState | null {
  if (!existsSync(paths.statePath)) {
    return null;
  }

  try {
    const content = readFileSync(paths.statePath, 'utf8');
    return JSON.parse(content) as ServerRuntimeState;
  } catch {
    return null;
  }
}

export function writeServerRuntimeState(
  paths: ServerRuntimePaths,
  state: ServerRuntimeState,
): void {
  ensureServerRuntimeDir(paths);
  writeFileSync(paths.statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function clearServerRuntimeState(
  paths: ServerRuntimePaths,
  expectedPid?: number,
): boolean {
  const currentState = readServerRuntimeState(paths);

  if (
    expectedPid !== undefined &&
    currentState !== null &&
    currentState.pid !== expectedPid
  ) {
    return false;
  }

  if (!existsSync(paths.statePath)) {
    return false;
  }

  unlinkSync(paths.statePath);
  return true;
}

export function appendServerRuntimeLog(paths: ServerRuntimePaths, message: string): void {
  ensureServerRuntimeDir(paths);
  appendFileSync(paths.logPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === 'EPERM') {
      return true;
    }

    if (process.platform === 'win32') {
      return isWindowsProcessAlive(pid);
    }

    return false;
  }
}

export function formatServerAddress(host?: string, port?: number): string | null {
  if (!host || !port) {
    return null;
  }

  return `http://${host}:${port}`;
}

function isWindowsProcessAlive(pid: number): boolean {
  try {
    const output = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id`,
      ],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      },
    );

    return output.trim() === String(pid);
  } catch {
    return false;
  }
}
