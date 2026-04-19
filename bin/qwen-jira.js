#!/usr/bin/env node

const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

const entryPath = resolve(__dirname, '../dist/cli-entry.js');

if (!existsSync(entryPath)) {
  process.stderr.write('Build output not found. Run `npm run build` before using this package locally.\n');
  process.exit(1);
}

require(entryPath);
