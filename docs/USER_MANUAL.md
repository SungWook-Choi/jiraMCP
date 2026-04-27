# qwen-jira-mcp 사용자 메뉴얼

## 목차

1. [소개](#1-소개)
2. [설치](#2-설치)
3. [환경 설정](#3-환경-설정)
4. [빠른 시작](#4-빠른-시작)
5. [서버 관리 (`qwen-jira-server`)](#5-서버-관리-qwen-jira-server)
6. [사용자 설정 (`qwen-jira-config`)](#6-사용자-설정-qwen-jira-config)
7. [Jira CLI (`qwen-jira`)](#7-jira-cli-qwen-jira)
   - [이슈 조회](#71-이슈-조회)
   - [댓글 입력](#72-댓글-입력)
8. [MCP 서버 (`qwen-jira-mcp`)](#8-mcp-서버-qwen-jira-mcp)
9. [로컬 API 서버 엔드포인트](#9-로컬-api-서버-엔드포인트)
10. [트러블슈팅](#10-트러블슈팅)

---

## 1. 소개

`qwen-jira-mcp`는 Jira 이슈를 터미널에서 조회하고 댓글을 작성하기 위한 CLI 도구입니다.  
세 가지 진입점을 제공합니다:

| 명령어 | 설명 |
|---|---|
| `qwen-jira-server` | 로컬 API 서버 실행/관리 |
| `qwen-jira-config` | 사용자 설정 관리 |
| `qwen-jira` | Jira 조회 및 댓글 입력 CLI |
| `qwen-jira-mcp` | MCP 서버 (scaffold, 미구현) |

**사용 흐름:**  
`qwen-jira-server` (서버 시작) → `qwen-jira-config` (최초 1회 설정) → `qwen-jira` (반복 사용)

---

## 2. 설치

Node.js 20 이상이 필요합니다.

```bash
npm install -g qwen-jira-mcp
```

설치 후 아래 명령어가 전역으로 등록됩니다:
- `qwen-jira`
- `qwen-jira-server`
- `qwen-jira-config`
- `qwen-jira-mcp`

---

## 3. 환경 설정

### 3-1. Jira API 토큰 발급

1. Atlassian 계정 → **Account Settings** → **Security** → **API tokens** 이동
2. **Create API token** 클릭 후 복사

### 3-2. 환경변수 등록

**방법 A — 시스템 환경변수 (권장)**

OS의 환경변수 설정에 아래 항목을 등록합니다.

| 환경변수 | 필수 | 설명 | 예시 |
|---|---|---|---|
| `JIRA_BASE_URL` | ✅ | Jira 인스턴스 주소 | `https://yourcompany.atlassian.net` |
| `JIRA_EMAIL` | ✅ | Atlassian 계정 이메일 | `you@yourcompany.com` |
| `JIRA_API_TOKEN` | ✅ | Atlassian API 토큰 | `ATATT3...` |
| `JIRA_PROJECT_KEY` | | 기본 프로젝트 키 | `ABC` |
| `JIRA_DEFAULT_PERIOD` | | 기본 조회 기간 | `this_week` |
| `PORT` | | 서버 포트 (기본: 3000) | `3000` |
| `QWEN_JIRA_API_BASE_URL` | | CLI가 호출할 서버 주소 | `http://127.0.0.1:3000` |

**방법 B — `.env` 파일**

서버를 실행할 디렉토리에 `.env` 파일을 생성합니다.  
전역 설치 시 서버를 실행하는 현재 디렉토리를 기준으로 로드됩니다.

```env
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@yourcompany.com
JIRA_API_TOKEN=your_api_token_here
JIRA_PROJECT_KEY=ABC
JIRA_DEFAULT_PERIOD=this_week
PORT=3000
```

---

## 4. 빠른 시작

```bash
# 1. 서버 시작
qwen-jira-server

# 2. 최초 1회 사용자 설정 (선택사항)
qwen-jira-config

# 3. CLI 실행
qwen-jira

# 4. (필요 시) 서버 상태 확인
qwen-jira-server status

# 5. (필요 시) 서버 종료
qwen-jira-server stop
```

---

## 5. 서버 관리 (`qwen-jira-server`)

`qwen-jira` CLI를 사용하기 전에 반드시 서버를 먼저 실행해야 합니다.

### 명령어

```bash
qwen-jira-server          # 서버 시작 (백그라운드)
qwen-jira-server status   # 서버 실행 상태 확인
qwen-jira-server stop     # 서버 종료
```

### 포트 결정 우선순위

서버 포트는 아래 순서로 결정됩니다:

1. `PORT` 환경변수
2. 사용자 설정 파일의 `serverPort`
3. 기본값 `3000`

### 런타임 파일

서버 실행 시 현재 디렉토리 기준 `.qwen-jira/` 폴더에 아래 파일이 생성됩니다:

| 파일 | 설명 |
|---|---|
| `.qwen-jira/server.log` | 서버 로그 |
| `.qwen-jira/server.pid` | 프로세스 ID (상태 확인/종료에 사용) |

---

## 6. 사용자 설정 (`qwen-jira-config`)

설정 파일 위치: `~/.qwen-jira-mcp/config.json`

```bash
qwen-jira-config
```

대화형으로 아래 세 가지 항목을 설정합니다:

| 설정 키 | 기본값 | 설명 |
|---|---|---|
| `serverPort` | `3000` | 로컬 서버 포트 |
| `assigneeAllInclude` | `[]` | 전체 조회 시 포함할 담당자 목록 |
| `resultOutputDir` | `./output` | Markdown 결과 저장 폴더 |

### 설정 예시

```json
{
  "serverPort": 3000,
  "assigneeAllInclude": ["홍길동", "김철수", "이영희"],
  "resultOutputDir": "./jira-results"
}
```

### `assigneeAllInclude` 설정이 필요한 경우

`qwen-jira` CLI에서 **담당자 기준 조회 → 전체 포함 (all)** 을 사용할 때  
조회 대상 담당자 목록을 미리 등록해 두어야 합니다.  
목록이 비어 있으면 전체 조회 실행 시 오류가 발생합니다.

---

## 7. Jira CLI (`qwen-jira`)

서버가 실행 중인 상태에서 `qwen-jira`를 실행합니다.

```bash
qwen-jira
```

시작 화면에서 두 가지 작업 중 하나를 선택합니다:

```
첫 작업을 선택하세요:
1. 조회
2. 댓글 입력
선택 [1-2, 기본값: 1]:
```

---

### 7-1. 이슈 조회

**조회 방식 선택**

```
1. 담당자 기준 조회 (assignee)
2. 프로젝트 기준 조회 (project)
3. 담당자+프로젝트 조회 (assignee_project)
```

#### 담당자 기준 조회 (assignee)

담당자만 조건으로 이슈를 조회합니다. 선택 후 조회 범위를 추가로 선택합니다:

```
1. 내 담당자만 (personal)  — 담당자 이름을 직접 입력
2. 전체 포함 (all)         — 설정된 assigneeAllInclude 목록 전체 조회
```

- `personal`: 담당자 이름 입력 → 기간 선택 → 결과 출력
- `all`: 설정 파일의 `assigneeAllInclude` 목록 기준으로 자동 조회 (기간: `this_week` 고정, `해야 할 일` / `To Do` / `완료` / `Done` 상태 제외)

#### 프로젝트 기준 조회 (project)

프로젝트 키 기준으로 이슈를 조회합니다. 프로젝트 입력 방법:

```
1. 프로젝트 키 직접 입력  — 예: ABC
2. 프로젝트 이름으로 검색 — 일부 이름을 입력하면 검색 결과에서 선택
```

#### 담당자+프로젝트 조회 (assignee_project)

담당자 이름과 프로젝트 키를 함께 지정하여 조회합니다.

---

**조회 기간 선택**

```
1. 이번 주 (this_week)
2. 지난 주 (last_week)
3. 오늘 (today)
4. 어제 (yesterday)
5. 직접 기간 입력 (custom_range)
```

`custom_range` 선택 시 시작일과 종료일을 `YYYY-MM-DD` 형식으로 입력합니다.

---

**결과 출력 형식**

```
결과를 Markdown으로 저장할까요? [y/N]:
```

- `N` (기본): 터미널에 출력
- `Y`: `resultOutputDir` 경로에 `jira-result-<mode>-<timestamp>.md` 파일로 저장

---

### 7-2. 댓글 입력

Jira 이슈에 댓글을 작성합니다.

**댓글 유형 선택**

```
1. 기본 (basic)       — 입력 내용 그대로 전송
2. 주간이슈 (weekly_issue) — 본문 앞에 "[주간 이슈]\n" 자동 추가
```

**이슈 선택 방식**

```
1. 이슈명 검색    — 제목 일부를 입력해서 검색 후 목록에서 선택
2. 이슈 키 직접 입력 — 예: ABC-123
```

**이슈명 검색 동작:**
- 검색 결과가 1건이면 자동 선택
- 2건 이상이면 목록을 출력하고 번호로 선택
- 검색 결과가 없으면 다시 입력 요청

**댓글 제출:**

댓글 내용 입력 후 미리보기가 표시되며, `y`를 입력해야 실제로 전송됩니다.

```
댓글 제출 미리보기:
유형: 기본 (basic)
이슈: [ABC-123] 이슈 제목
선택 방식: 이슈 키 직접 입력 (direct_key)
본문:
(작성한 댓글 내용)

댓글을 제출할까요? [y/N]:
```

---

## 8. MCP 서버 (`qwen-jira-mcp`)

> **주의:** 현재 scaffold 상태이며 실제 Jira 조회 기능은 미구현입니다.  
> 실행 시 서버 descriptor만 반환되고 데이터 조회는 동작하지 않습니다.

```bash
qwen-jira-mcp
```

실제 MCP Jira 조회 기능은 후속 구현 완료 후 사용 가능합니다.

---

## 9. 로컬 API 서버 엔드포인트

`qwen-jira` CLI가 내부적으로 호출하는 REST API입니다.  
기본 주소: `http://127.0.0.1:3000`

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/health` | 서버 및 Jira 연결 상태 확인 |
| `POST` | `/jira/search` | 이슈 목록 조회 |
| `GET` | `/jira/issues?query=<검색어>` | 이슈 제목으로 검색 |
| `GET` | `/jira/issues/:issueKey` | 이슈 키로 단건 조회 |
| `GET` | `/jira/projects?query=<검색어>` | 프로젝트 검색 |
| `POST` | `/jira/comments` | 댓글 작성 |

---

## 10. 트러블슈팅

### 서버에 연결할 수 없습니다

```
로컬 서버에 연결할 수 없습니다.
```

- `qwen-jira-server`를 먼저 실행했는지 확인합니다.
- `qwen-jira-server status`로 서버 상태를 확인합니다.
- 포트 충돌이 있는 경우 `qwen-jira-config`에서 `serverPort`를 변경합니다.

### Jira 환경변수가 부족합니다

```
로컬 서버의 Jira 환경변수가 부족합니다: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
```

- `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` 세 환경변수가 모두 설정되어 있는지 확인합니다.
- 시스템 환경변수 또는 서버 실행 디렉토리의 `.env` 파일을 확인합니다.
- 환경변수 변경 후에는 서버를 재시작합니다: `qwen-jira-server stop && qwen-jira-server`

### `all` 조회 시 오류

```
assigneeAllInclude 목록이 비어 있습니다. qwen-jira-config로 먼저 설정해주세요.
```

- `qwen-jira-config`를 실행하여 `assigneeAllInclude` 항목에 담당자 목록을 등록합니다.
- 담당자 이름은 쉼표로 구분하여 입력합니다. 예: `홍길동, 김철수, 이영희`

### Markdown 저장 실패

```
Markdown 저장 실패: ...
```

- `resultOutputDir` 경로의 쓰기 권한을 확인합니다.
- 절대 경로를 사용하는 경우 경로가 올바른지 확인합니다.
- `qwen-jira-config`에서 다른 경로로 변경해 봅니다.

### 서버가 종료되지 않습니다

```
qwen-jira-server stop
```

명령이 동작하지 않으면 `.qwen-jira/server.pid` 파일의 PID를 확인하여 수동으로 종료합니다.
