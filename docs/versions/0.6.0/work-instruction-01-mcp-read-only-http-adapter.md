# 작업 지시서: v0.6.0 1번 조회 전용 MCP HTTP 어댑터

## 문서 목적

이 문서는 `qwen-jira-mcp@0.6.0` 작업 항목인 조회 전용 MCP 서버 구현 범위를 고정하기 위한 작업 지시서다.

상위 기준 문서는 `docs/versions/0.6.0/work-instruction.md`다.

## 작업 배경

현재 프로젝트는 `NestJS Server`를 중심으로 CLI가 로컬 HTTP API를 호출하는 구조로 정리되어 있다.

반면 MCP 쪽은 아직 scaffold 수준이며, 외부 LLM 클라이언트가 실제로 Jira 조회 기능을 호출할 수 있는 tool 정의와 실행 경로가 준비되지 않았다.

이번 작업은 MCP가 Jira API를 직접 호출하지 않고, 현재 실행 중인 로컬 서버 API를 호출하는 얇은 어댑터가 되도록 고정한다.

또한 이번 단계에서는 조회 기능만 열고, Jira 데이터를 변경하는 쓰기 기능은 열지 않는다.

## 목표

1. MCP 서버가 실제 tool 목록과 입력 계약을 가진 실행 가능한 상태가 된다.
2. LLM 클라이언트는 MCP tool 설명과 입력 스키마를 통해 Jira 조회 기능을 사용할 수 있다.
3. MCP는 로컬 `NestJS Server`의 HTTP API를 호출하여 Jira 조회 결과를 받아온다.
4. CLI와 MCP는 가능한 한 같은 서버 API 계약과 base URL 해석 규칙을 공유한다.
5. 이번 단계 MCP는 `read-only` 조회 기능만 제공한다.

## 포함 범위

이번 작업 범위는 아래를 포함한다.

1. MCP 서버 실행 흐름 정리
2. MCP server descriptor 보강
3. 조회 전용 tool 정의 추가
4. tool 설명에 사용 목적, 허용 입력, 대표 예시 포함
5. MCP에서 사용할 로컬 서버 HTTP client 추가 또는 기존 CLI client 공용화
6. 서버 base URL 결정 규칙 연결
7. 서버 연결 실패, 잘못된 URL, 서버 오류 응답 처리
8. 조회 결과를 LLM이 바로 사용할 수 있는 응답 형식으로 정리
9. 관련 문서 또는 사용 예시 보강

## 세부 규칙

1. MCP는 Jira REST API를 직접 호출하지 않는다.
2. MCP는 현재 실행 중인 로컬 `NestJS Server`의 HTTP API만 호출한다.
3. 이번 단계 MCP tool은 모두 `read-only`여야 한다.
4. Jira 댓글 등록, 이슈 생성, 이슈 수정 tool은 이번 단계에 추가하지 않는다.
5. 조회 대상 기능은 기존 서버 API가 이미 지원하는 범위 안으로 제한한다.
6. base URL 우선순위는 기존 CLI와 동일해야 한다.
7. base URL 우선순위는 `QWEN_JIRA_API_BASE_URL`, `LOCAL_SERVER_API_BASE_URL`, 사용자 설정 파일의 `serverPort`, 기본값 순서로 유지한다.
8. 서버가 꺼져 있으면 MCP는 “서버를 먼저 시작하라”는 행동 지침을 포함해 오류를 반환해야 한다.
9. LLM이 잘못 호출하지 않도록 tool 설명에는 허용값과 금지 조합을 명시한다.
10. 대표 예시는 각 tool당 최소 1개 이상 포함한다.
11. 예시는 설명 보조 수단이며, 실제 검증 기준은 tool 입력 스키마와 서버 API 검증 로직이다.
12. MCP 도입만을 위해 서버 코어, Jira 조회 규칙, Query 정규화 규칙을 중복 구현하지 않는다.

## 구현 대상 tool

이번 단계에서 아래 tool만 구현 대상으로 본다.

1. `health_status`
2. `jira_search`
3. `jira_issue_get`
4. `jira_project_lookup`

## tool별 요구사항

### 1. `health_status`

1. 로컬 서버의 `GET /health`를 호출한다.
2. Jira 환경변수 설정 여부와 누락 항목을 반환한다.
3. LLM이 다음 행동을 판단할 수 있도록 `jiraConfigured`, `missingEnv`를 포함한다.

### 2. `jira_search`

1. 로컬 서버의 `POST /jira/search`를 호출한다.
2. 입력은 기존 서버 요청 형식을 따른다.
3. 최소 입력 필드는 `mode`이며, 필요 시 `assigneeMode`, `assignee`, `projectKey`, `period`, `startDate`, `endDate`, `outputFormat`을 받는다.
4. `mode` 허용값은 `assignee`, `project`, `assignee_project`다.
5. `assigneeMode` 허용값은 `personal`, `all`이다.
6. `mode=assignee`이고 `assigneeMode=all`일 때는 `assignee`를 요구하지 않는다.
7. `mode=project`일 때는 `projectKey`가 필요하다.
8. `mode=assignee_project`일 때는 `assignee`와 `projectKey`가 모두 필요하다.
9. 반환값에는 최소한 `query`, `request`, `total`, `issues`를 포함한다.
10. 가능하면 `rendered` 또는 LLM 친화 요약 필드를 함께 반환한다.

### 3. `jira_issue_get`

1. 로컬 서버의 `GET /jira/issues/:issueKey`를 호출한다.
2. 입력은 `issueKey` 하나로 고정한다.
3. 빈 값이나 공백 문자열은 허용하지 않는다.
4. 결과에는 최소 `key`, `summary`, `status`, `projectKey`, `projectName`이 포함되어야 한다.

### 4. `jira_project_lookup`

1. 로컬 서버의 `GET /jira/projects?query=...`를 호출한다.
2. 입력은 `query` 문자열 하나로 고정한다.
3. 빈 값이나 공백 문자열은 허용하지 않는다.
4. 결과는 프로젝트 후보 목록을 그대로 반환한다.

## 응답 방향

응답은 아래 원칙을 따른다.

1. 원본 서버 응답 필드를 우선 보존한다.
2. LLM이 바로 사용하기 쉬운 요약 필드는 추가할 수 있다.
3. 서버 응답을 과도하게 가공해 정보 손실을 만들지 않는다.
4. 오류 응답은 상태 설명보다 해결 행동이 분명해야 한다.

## 변경 대상 기준

예상 변경 대상은 아래 범위 안으로 제한한다.

1. `src/mcp-entry.ts`
2. `src/mcp/`
3. 필요 시 공용 로컬 서버 API client 모듈
4. 필요 시 `src/cli/cli-api.client.ts` 또는 공용화 대상 파일
5. MCP 사용 문서 또는 `README.md`

명시 지시가 없으면 아래는 금지한다.

1. Jira 조회 코어 대규모 리팩토링
2. CLI UX 흐름 변경
3. 서버 API 계약 임의 변경
4. Web UI 추가
5. 알림 기능 추가

## 제외 범위

아래 항목은 이번 작업 범위에서 제외한다.

1. `jira_comment_create`
2. Jira 이슈 생성
3. Jira 이슈 수정
4. Slack, Email, 카카오톡 알림
5. 원격 서버 자동 탐색
6. 사용자별 권한 분리
7. MCP 외 별도 에이전트 전용 DSL 추가

## 산출물

이번 작업에서 최소한 아래 결과가 있어야 한다.

1. 실행 가능한 조회 전용 MCP 서버
2. 조회 전용 tool 4개
3. 서버 HTTP 호출용 client 또는 공용화 정리
4. tool 설명과 입력 예시
5. 사용 문서 또는 예시 반영

## 완료 기준

아래 조건을 만족하면 이번 작업을 완료로 본다.

1. MCP가 scaffold descriptor 출력만 하지 않고 실제 조회 tool을 제공한다.
2. `health_status`가 로컬 서버 상태를 반환한다.
3. `jira_search`가 기존 서버 조회 결과를 반환한다.
4. `jira_issue_get`이 이슈 키 기준 조회를 수행한다.
5. `jira_project_lookup`이 프로젝트 검색 결과를 반환한다.
6. base URL 해석 규칙이 CLI와 일치한다.
7. 서버 미실행 시 명확한 연결 실패 오류를 반환한다.
8. 쓰기 기능 tool은 결과물에 포함되지 않는다.
9. 문서나 코드에서 이번 단계 MCP가 `read-only`라는 점이 분명하다.
10. `npm run typecheck`가 통과한다.
11. `npm run build`가 통과한다.

## 검증 기준

최소한 아래 항목을 검증해야 한다.

1. MCP 실행 시 tool 목록이 기대한 4개로 노출되는지 확인
2. 각 tool 설명에 용도와 대표 입력 예시가 포함되는지 확인
3. `health_status` 호출 시 서버 상태가 정상 반환되는지 확인
4. `jira_search` 호출 시 대표 조회 케이스가 정상 동작하는지 확인
5. `jira_issue_get` 호출 시 유효한 이슈 키가 정상 조회되는지 확인
6. `jira_project_lookup` 호출 시 프로젝트 검색이 정상 동작하는지 확인
7. 서버가 내려간 상태에서 연결 실패 오류가 명확한지 확인
8. `QWEN_JIRA_API_BASE_URL` 또는 사용자 설정 포트 반영이 기대대로 동작하는지 확인
9. 쓰기 기능 tool이 노출되지 않는지 확인
10. `npm run typecheck` 통과 여부 확인
11. `npm run build` 통과 여부 확인

## 보고 형식

완료 보고에는 아래를 반드시 포함한다.

1. 변경 파일 목록
2. MCP 실행 방식 설명
3. tool 목록과 각 tool 역할
4. 서버 HTTP 호출 방식 설명
5. base URL 해석 규칙 설명
6. 조회 전용 제한 준수 여부
7. 검증 결과
8. 작업지시서 범위 준수 여부
9. 남은 제한사항
10. 인코딩 검증 결과
