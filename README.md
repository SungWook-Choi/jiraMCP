# qwen3JiraMCP

NestJS + TypeScript scaffold for the MVP described in [docs/work-instruction.md](/Users/bbosungmini/WebstormProjects/qwen3JiraMCP/docs/work-instruction.md).

## npm Distribution Direction

The current npm packaging direction is a single package:

- Package name: `qwen-jira-mcp`
- Primary CLI command: `qwen-jira`
- Companion commands: `qwen-jira-server`, `qwen-jira-mcp`

This keeps the current server-centered MVP structure intact while exposing separate user-facing commands for the CLI, local API server, and MCP entry flow.

## Scope of This Scaffold

This scaffold sets up the shared application structure for:

- Jira-backed core services
- CLI entry flow
- MCP entry flow

This repository intentionally does not implement:

- Web UI
- Local LLM integration
- Broad natural-language parsing

## Structure

```text
src/
  app.module.ts
  bootstrap/
    app-context.ts
  cli/
    cli.module.ts
    cli.service.ts
  config/
    env-loader.ts
    jira.config.ts
    jira-settings.ts
  jira/
    jira.module.ts
    jira.service.ts
  mcp/
    mcp.module.ts
    mcp.service.ts
  query/
    query.module.ts
    query.schema.ts
    query.service.ts
  summary/
    summary.module.ts
    summary.service.ts
  cli-entry.ts
  mcp-entry.ts
```

## Environment

Copy `.env.example` and provide the Jira settings through the current execution environment.

Required variables:

- `JIRA_BASE_URL`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

Optional variables:

- `JIRA_PROJECT_KEY`
- `JIRA_DEFAULT_PERIOD`
- `QWEN_JIRA_API_BASE_URL`

## Entry Paths

- `src/cli-entry.ts`: CLI-oriented Nest application context bootstrap
- `src/mcp-entry.ts`: MCP-oriented Nest application context bootstrap
- `src/server-entry.ts`: local API server bootstrap

Both entry paths reuse the same `AppModule` so future CLI and MCP features can share the same core logic.

The current CLI flow keeps console output as the default and can optionally save the same result as Markdown under the project-local `output/` directory.
The CLI now calls the local server API and defaults to `http://127.0.0.1:3000` unless `QWEN_JIRA_API_BASE_URL` is set.

## Query Schema Direction

The initial shared schema placeholder is defined in [src/query/query.schema.ts](/Users/bbosungmini/WebstormProjects/qwen3JiraMCP/src/query/query.schema.ts) and follows the MVP direction from the work instruction:

```ts
{
  mode: 'assignee' | 'project' | 'assignee_project',
  assignees: string[],
  projectKeys: string[],
  period: 'this_week' | string,
  output: {
    format: 'console' | 'markdown',
  },
}
```

## npm Install And Run

Local package verification before npm publish:

```bash
npm install
npm run build
npm link
```

After linking the local package, the following commands are available from your shell:

```bash
qwen-jira-server
qwen-jira
qwen-jira-mcp
```

The current MVP flow is server-centered:

1. Start `qwen-jira-server`
2. Run `qwen-jira` in another shell
3. Keep using environment variables for Jira connection and `QWEN_JIRA_API_BASE_URL` when the CLI should call a non-default server

Planned install shape for a future npm release:

```bash
npm install -g qwen-jira-mcp
qwen-jira-server
qwen-jira
```

## Development Commands

Repository-local development commands remain available:

```bash
npm run start:api
npm run start:server
npm run start:cli
npm run start:mcp
```

Development entry points:

```bash
npm run start:dev:api
npm run start:dev:cli
npm run start:dev:mcp
```
