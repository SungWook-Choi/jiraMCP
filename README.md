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
PORT=3000                     # optional, server port override
QWEN_JIRA_API_BASE_URL=http://127.0.0.1:3000 # optional, explicit CLI server URL override
```

- `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` 은 필수입니다.
- `JIRA_PROJECT_KEY`: 기본 조회 프로젝트 키 (생략 가능)
- `JIRA_DEFAULT_PERIOD`: 기본 조회 기간 (생략 시 `this_week`)
- `PORT`: `qwen-jira-server` 실행 포트 우선순위에서 가장 먼저 사용됩니다.
- `QWEN_JIRA_API_BASE_URL`: CLI가 호출하는 로컬 서버 주소를 직접 지정합니다. 생략하면 `LOCAL_SERVER_API_BASE_URL`, 사용자 설정 파일의 `serverPort`, 기본값 `http://127.0.0.1:3000` 순서로 결정됩니다.

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

서버는 `PORT` 환경변수, 사용자 설정 파일의 `serverPort`, 기본값 `3000` 순서로 포트를 정합니다. 실행 후 상태 파일과 시작 로그는 실제 선택된 포트를 반영합니다.

### 2. CLI 실행

서버가 실행 중인 상태에서 같은 터미널 또는 별도 터미널에서 CLI를 실행합니다.

```bash
qwen-jira
```

### 3. 설정 CLI 실행

사용자 설정 파일은 직접 편집하지 않고 `qwen-jira-config`로 관리합니다.

```bash
qwen-jira-config
```

설정 파일 경로는 `<사용자 홈>/.qwen-jira-mcp/config.json` 입니다.
설정 파일 키는 `serverPort`, `assigneeAllInclude`, `resultOutputDir`, `weeklyReportWeekday`, `weeklyReportHour` 를 사용합니다.
`weeklyReportWeekday`는 `monday`부터 `sunday`까지의 선택형 입력이고, `weeklyReportHour`는 `0`부터 `23`까지의 정수입니다.

### 4. MCP 실행

> **주의:** 현재 MCP 서버는 scaffold 상태이며, 실제 Jira 조회 기능은 미구현입니다.
> `qwen-jira-mcp`를 실행하면 서버 descriptor만 반환하고 실제 데이터 조회는 동작하지 않습니다.
> 실제 MCP Jira 조회 기능은 후속 구현 작업이 완료된 뒤에 사용할 수 있습니다.

```bash
qwen-jira-mcp
```

## Typical Flow

```bash
qwen-jira-server
qwen-jira-config
qwen-jira
qwen-jira-server status
qwen-jira-server stop
```

CLI는 기본적으로 사용자 설정 파일의 `serverPort`를 읽어 `http://127.0.0.1:<serverPort>` 로 요청합니다. 설정 파일이 없으면 `http://127.0.0.1:3000` 을 사용합니다. `QWEN_JIRA_API_BASE_URL` 또는 `LOCAL_SERVER_API_BASE_URL` 환경변수가 있으면 그 값을 가장 먼저 사용합니다.

CLI 첫 진입에서는 `조회` 또는 `댓글 입력`을 선택합니다.

- `조회`: `담당자 기준 조회 (assignee)`, `프로젝트 기준 조회 (project)`, `담당자+프로젝트 조회 (assignee_project)` 중 하나를 선택합니다.
- `댓글 입력`: `기본 (basic)` 또는 `주간이슈 (weekly_issue)`를 고른 뒤, `이슈명 검색 (search_title)` 또는 `이슈 키 직접 입력 (direct_key)`으로 대상을 선택하고 댓글을 전송합니다.
- `주간이슈`: 제출 본문 앞에 `[주간 이슈]` 와 줄바꿈이 자동으로 추가됩니다.
- 댓글 전송 전 최종 확인 단계가 있습니다.

`담당자 기준 조회 (assignee)`를 선택하면 CLI가 `내 담당자만 (personal)` / `전체 포함 (all)` 을 한 번 더 묻습니다.

- `personal`: 기존과 동일하게 담당자 입력 후 기간을 선택합니다.
- `all`: 사용자 설정 파일의 `assigneeAllInclude` 목록만 대상으로 조회합니다.
- `all` 조회에서 설정이 없거나 목록이 비어 있으면 `qwen-jira-config`로 먼저 설정하라는 오류를 반환합니다.
- `all` 조회에서는 상태 `해야 할 일`, `To Do`, `완료`, `Done` 이 JQL에서 제외됩니다.

Markdown으로 결과를 저장하면 사용자 설정 파일의 `resultOutputDir` 값을 사용합니다. 설정이 없으면 기존 기본값인 `./output` 으로 저장하고, 필요한 폴더는 자동 생성합니다.

`qwen-jira-server`가 실행 중이면 설정된 `weeklyReportWeekday`와 `weeklyReportHour` 기준으로 주간보고가 자동 생성됩니다. 자동 생성 파일은 `resultOutputDir/weekly-report/jira-weekly-report-YYYY-Www.md` 형식으로 저장되며, 같은 주에는 덮어씁니다.

주간보고는 Jira `myself` API의 `accountId`를 기준으로 현재 로그인한 토큰 소유자 본인 이슈만 조회하고, `updated` 값이 아니라 `changelog` 기준의 최근 7일 반개구간으로 판정합니다.

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
