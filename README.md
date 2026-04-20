# qwen-jira-mcp

NestJS + TypeScript 기반의 Jira 조회 도구입니다. CLI, 로컬 API 서버, MCP 세 가지 진입점을 제공합니다.

## Installation

```bash
npm install -g qwen-jira-mcp
```

## Environment Setup

환경변수를 시스템에 직접 등록하는 방법을 권장합니다. 또는 `qwen-jira-server`를 실행하는 디렉토리에 `.env` 파일을 생성할 수 있습니다. 서버 프로세스는 실행 위치(`process.cwd()`)를 기준으로 `.env`를 로드하므로, 전역 설치(`npm install -g`) 후에는 "프로젝트 루트"가 아닌 **서버를 실행하는 디렉토리**에 `.env`가 있어야 합니다.

```env
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@yourcompany.com
JIRA_API_TOKEN=your_api_token_here
JIRA_PROJECT_KEY=ABC          # optional
JIRA_DEFAULT_PERIOD=this_week # optional
QWEN_JIRA_API_BASE_URL=http://127.0.0.1:3000 # optional, default value
```

- `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` 은 필수입니다.
- `JIRA_PROJECT_KEY`: 기본 조회 프로젝트 키 (생략 가능)
- `JIRA_DEFAULT_PERIOD`: 기본 조회 기간 (생략 시 `this_week`)
- `QWEN_JIRA_API_BASE_URL`: CLI가 호출하는 로컬 서버 주소 (생략 시 `http://127.0.0.1:3000`)

## Usage

### 1. 서버 실행

CLI 실행 전에 반드시 로컬 서버를 먼저 시작합니다.

```bash
qwen-jira-server
```

서버가 `http://127.0.0.1:3000` 에서 대기합니다.

### 2. CLI 실행

서버가 실행 중인 상태에서 별도 터미널에서 CLI를 실행합니다.

```bash
qwen-jira
```

### 3. MCP 실행

> **주의:** 현재 MCP 서버는 scaffold 상태이며, 실제 Jira 조회 기능은 미구현입니다.
> `qwen-jira-mcp`를 실행하면 서버 descriptor만 반환하고 실제 데이터 조회는 동작하지 않습니다.
> 실제 MCP Jira 조회 기능은 `follow-up-tasks.md` 3번 항목(MCP 실제 조회 기능 연결)이 완료된 후 사용할 수 있습니다.

```bash
qwen-jira-mcp
```

## Typical Flow

```
# 터미널 1
qwen-jira-server

# 터미널 2 (서버 기동 확인 후)
qwen-jira
```

CLI는 기본적으로 `http://127.0.0.1:3000` 의 로컬 서버에 요청합니다. 서버 주소를 변경하려면 `QWEN_JIRA_API_BASE_URL` 환경변수를 설정합니다.

## Structure

```text
src/
  api/
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
  server-entry.ts
```

## Query Schema

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

## Development Commands

```bash
npm run start:api
npm run start:server
npm run start:cli
npm run start:mcp
```

Development watch mode:

```bash
npm run start:dev:api
npm run start:dev:cli
npm run start:dev:mcp
```
