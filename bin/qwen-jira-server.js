#!/usr/bin/env node

const { spawn, spawnSync } = require('node:child_process');
const { closeSync, openSync } = require('node:fs');
const http = require('node:http');
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

const entryPath = resolve(__dirname, '../dist/server-entry.js');
const runtimeHelperPath = resolve(__dirname, '../dist/bootstrap/server-runtime.js');

if (!existsSync(entryPath)) {
  process.stderr.write('Build output not found. Run `npm run build` before using this package locally.\n');
  process.exit(1);
}

if (!existsSync(runtimeHelperPath)) {
  process.stderr.write('Runtime helper not found. Run `npm run build` before using this package locally.\n');
  process.exit(1);
}

const {
  appendServerRuntimeLog,
  clearServerRuntimeState,
  formatServerAddress,
  getServerRuntimePaths,
  ensureServerRuntimeDir,
  isProcessAlive,
  readServerRuntimeState,
  writeServerRuntimeState,
} = require(runtimeHelperPath);

const command = process.argv[2] ?? 'start';

void main(command);

async function main(currentCommand) {
  const runtimePaths = getServerRuntimePaths(process.cwd());

  switch (currentCommand) {
    case 'start':
      await startServer(runtimePaths);
      return;
    case 'status':
      await showStatus(runtimePaths);
      return;
    case 'stop':
      await stopServer(runtimePaths);
      return;
    default:
      process.stderr.write('Usage: qwen-jira-server [status|stop]\n');
      process.exitCode = 1;
  }
}

async function startServer(runtimePaths) {
  ensureServerRuntimeDir(runtimePaths);

  const currentState = readServerRuntimeState(runtimePaths);

  if (currentState !== null) {
    const currentStatus = await getRecordedServerStatus(currentState);

    if (currentStatus === 'running') {
      process.stdout.write(`qwen-jira server is already running (PID ${currentState.pid}).\n`);
      return;
    }

    if (currentStatus === 'starting') {
      process.stdout.write(`qwen-jira server is already starting (PID ${currentState.pid}).\n`);
      return;
    }

    clearServerRuntimeState(runtimePaths, currentState.pid);
  }

  const host = parseHost(process.env.HOST);
  const port = parsePort(process.env.PORT);
  const stdoutFd = openSync(runtimePaths.logPath, 'a');
  const stderrFd = openSync(runtimePaths.logPath, 'a');

  try {
    const child = spawn(process.execPath, [entryPath], {
      cwd: process.cwd(),
      detached: true,
      stdio: ['ignore', stdoutFd, stderrFd],
      windowsHide: true,
      env: {
        ...process.env,
        QWEN_JIRA_SERVER_RUNTIME_DIR: runtimePaths.runtimeDir,
        QWEN_JIRA_SERVER_STATE_PATH: runtimePaths.statePath,
        QWEN_JIRA_SERVER_LOG_PATH: runtimePaths.logPath,
      },
    });

    writeServerRuntimeState(runtimePaths, {
      pid: child.pid,
      status: 'starting',
      startedAt: new Date().toISOString(),
      cwd: process.cwd(),
      logPath: runtimePaths.logPath,
      host,
      port,
    });

    child.unref();
    process.stdout.write(
      `qwen-jira server starting in background (PID ${child.pid}). Log: ${runtimePaths.logPath}\n`,
    );
  } finally {
    closeSync(stdoutFd);
    closeSync(stderrFd);
  }
}

async function showStatus(runtimePaths) {
  const currentState = readServerRuntimeState(runtimePaths);

  if (currentState === null) {
    process.stdout.write('qwen-jira server is not running.\n');
    return;
  }

  const address = formatServerAddress(currentState.host, currentState.port);
  const currentStatus = await getRecordedServerStatus(currentState);

  if (currentStatus === 'running') {
    process.stdout.write(
      `qwen-jira server is running (PID ${currentState.pid}) at ${address}. Log: ${currentState.logPath}\n`,
    );
    return;
  }

  if (currentStatus === 'starting') {
    process.stdout.write(
      `qwen-jira server is starting (PID ${currentState.pid}). Log: ${currentState.logPath}\n`,
    );
    return;
  }

  clearServerRuntimeState(runtimePaths, currentState.pid);
  process.stdout.write('qwen-jira server is not running. Cleared stale state.\n');
}

async function stopServer(runtimePaths) {
  const currentState = readServerRuntimeState(runtimePaths);

  if (currentState === null) {
    process.stdout.write('qwen-jira server is not running.\n');
    return;
  }

  const currentStatus = await getRecordedServerStatus(currentState);

  if (currentStatus === 'stale') {
    clearServerRuntimeState(runtimePaths, currentState.pid);
    process.stdout.write('qwen-jira server is not running. Cleared stale state.\n');
    return;
  }

  try {
    appendServerRuntimeLog(runtimePaths, `Stop requested for PID ${currentState.pid}.`);

    if (process.platform === 'win32') {
      const stopResult = spawnSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `Stop-Process -Id ${currentState.pid} -Force -ErrorAction SilentlyContinue`,
        ],
        {
          stdio: 'ignore',
          windowsHide: true,
        },
      );
    } else {
      process.kill(currentState.pid);
    }
  } catch (error) {
    if (error && error.code === 'ESRCH') {
      clearServerRuntimeState(runtimePaths, currentState.pid);
      process.stdout.write('qwen-jira server is not running. Cleared stale state.\n');
      return;
    }

    throw error;
  }

  const stopped = await waitForServerStop(currentState, 5000);

  if (stopped) {
    appendServerRuntimeLog(runtimePaths, `Server stopped (PID ${currentState.pid}).`);
    clearServerRuntimeState(runtimePaths, currentState.pid);
    process.stdout.write(`qwen-jira server stopped (PID ${currentState.pid}).\n`);
    return;
  }

  appendServerRuntimeLog(runtimePaths, `Stop pending for PID ${currentState.pid}.`);
  process.stdout.write(
    `Stop requested for qwen-jira server (PID ${currentState.pid}). Check status again.\n`,
  );
}

async function waitForServerStop(state, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (!(await isServerResponsive(state))) {
      return true;
    }

    await delay(200);
  }

  return !(await isServerResponsive(state));
}

function delay(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function isStartingStateFresh(state) {
  const startedAt = Date.parse(state.startedAt);

  if (Number.isNaN(startedAt)) {
    return false;
  }

  return Date.now() - startedAt < 10000;
}

async function getRecordedServerStatus(state) {
  if (await isServerResponsive(state)) {
    return 'running';
  }

  if (isProcessAlive(state.pid)) {
    return 'starting';
  }

  return 'stale';
}

function isServerResponsive(state) {
  if (!state.host || !state.port) {
    return Promise.resolve(false);
  }

  return new Promise((resolvePromise) => {
    const request = http.get(
      {
        host: state.host,
        port: state.port,
        path: '/health',
        timeout: 1000,
      },
      (response) => {
        response.resume();
        resolvePromise((response.statusCode ?? 500) < 500);
      },
    );

    request.on('timeout', () => {
      request.destroy();
      resolvePromise(false);
    });

    request.on('error', () => {
      resolvePromise(false);
    });
  });
}

function parsePort(value) {
  const parsed = Number.parseInt(value ?? '3000', 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 3000;
  }

  return parsed;
}

function parseHost(value) {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : '127.0.0.1';
}
