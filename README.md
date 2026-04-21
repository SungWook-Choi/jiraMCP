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

CLI 실행 전에 반드시 로컬 서버를 먼저 시작합니다. `qwen-jira-server`는 기본적으로 현재 디렉토리 기준 백그라운드로 실행되며, 런타임 파일은 `.qwen-jira/` 아래에 기록됩니다.

```bash
qwen-jira-server
```

기본 로그 파일: `.qwen-jira/server.log`

서버 상태 확인 및 종료:

```bash
qwen-jira-server status
qwen-jira-server stop
```

서버가 정상 기동되면 `http://127.0.0.1:3000` 에서 대기합니다.

### 2. CLI 실행

서버가 실행 중인 상태에서 같은 터미널 또는 별도 터미널에서 CLI를 실행합니다.

```bash
qwen-jira
```

### 3. MCP 실행

> **주의:** 현재 MCP 서버는 scaffold 상태이며, 실제 Jira 조회 기능은 미구현입니다.
> `qwen-jira-mcp`를 실행하면 서버 descriptor만 반환하고 실제 데이터 조회는 동작하지 않습니다.
> 실제 MCP Jira 조회 기능은 후속 구현 작업이 완료된 뒤에 사용할 수 있습니다.

```bash
qwen-jira-mcp
```

## Typical Flow

```bash
qwen-jira-server
qwen-jira
qwen-jira-server status
qwen-jira-server stop
```

CLI는 기본적으로 `http://127.0.0.1:3000` 의 로컬 서버에 요청합니다. 서버 주소를 변경하려면 `QWEN_JIRA_API_BASE_URL` 환경변수를 설정합니다.

CLI 첫 진입에서는 `조회` 또는 `댓글 입력`을 선택합니다.

- `조회`: 기존 Jira 조회 흐름을 그대로 사용합니다.
- `댓글 입력`: `기본` 또는 `주간이슈`를 고른 뒤, `이슈명 검색` 또는 `이슈 키 직접 입력`으로 대상을 선택하고 댓글을 전송합니다.
- `주간이슈`: 제출 본문 앞에 `[주간 이슈]` 와 줄바꿈이 자동으로 추가됩니다.
- 댓글 전송 전 최종 확인 단계가 있습니다.

`assignee` 조회를 선택하면 CLI가 `personal` / `all` 을 한 번 더 묻습니다.

- `personal`: 기존과 동일하게 담당자 입력 후 기간을 선택합니다.
- `all`: 담당자 입력과 기간 선택을 건너뛰고 즉시 `this_week` 기준으로 조회합니다.
- `all` 조회에서는 상태 `해야 할 일`, `To Do`, `완료`, `Done` 이 JQL에서 제외됩니다.

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
  assigneeMode: 'personal' | 'all',
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
