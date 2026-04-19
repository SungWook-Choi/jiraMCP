import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseLine(line: string): [string, string] | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const separatorIndex = trimmed.indexOf('=');

  if (separatorIndex < 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  const rawValue = trimmed.slice(separatorIndex + 1).trim();
  const unquoted = rawValue.replace(/^['"]|['"]$/g, '');

  return [key, unquoted];
}

export function loadEnvFile(filePath = '.env'): void {
  const resolvedPath = resolve(process.cwd(), filePath);

  if (!existsSync(resolvedPath)) {
    return;
  }

  const content = readFileSync(resolvedPath, 'utf8');

  for (const line of content.split(/\r?\n/u)) {
    const entry = parseLine(line);

    if (!entry) {
      continue;
    }

    const [key, value] = entry;

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
