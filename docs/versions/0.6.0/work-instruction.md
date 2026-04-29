# 작업 지시서: v0.6.0 MCP 서버 HTTP 어댑터 추가

## 문서 목적

이 문서는 `qwen-jira-mcp@0.6.0` 범위에서 MCP 서버 기능을 실제 사용 가능한 수준으로 확장하기 위한 기준 문서다.

현재 프로젝트에는 `McpModule`과 `mcp-entry`가 있으나, 실제 Jira 조회 기능을 외부 LLM 클라이언트가 호출할 수 있는 MCP tool 세트는 아직 준비되지 않았다.

이번 단계에서는 MCP 서버가 Jira API를 직접 다루지 않고, 현재 실행 중인 로컬 `NestJS Server`의 HTTP API를 호출하는 얇은 어댑터로 동작하도록 방향을 고정한다.

이번 단계의 MCP는 `read-only 조회 기능`만 우선 공개하고, Jira 데이터를 변경하는 쓰기 기능은 후속 범위로 미룬다.

## 버전 범위

이번 `0.6.0` 범위에서는 아래 한 가지 작업 항목을 다룬다.

1. MCP 서버의 로컬 서버 HTTP 어댑터화 및 최소 tool 세트 추가

## 인코딩 고정

1. 작업지시서, 코드, 문서는 모두 `UTF-8`로 읽는다.
2. 작업지시서, 코드, 문서는 모두 `UTF-8`로 저장한다.
3. 한글이 깨져 보이면 추측 복원하지 않고 원본을 `UTF-8`로 다시 연다.
4. 비`UTF-8` 저장, BOM 변동, 깨진 한글의 임의 복원은 즉시 검수 실패 사유다.

## 운영 원칙

이번 단계에서 아래 원칙을 고정한다.

1. MCP 서버는 Jira REST API를 직접 호출하지 않는다.
2. MCP 서버는 현재 동작 중인 로컬 `NestJS Server`의 HTTP API를 호출한다.
3. CLI와 MCP는 가능한 한 같은 서버 API 계약을 재사용한다.
4. Jira 인증, Query 정규화, JQL 생성, Jira 조회, 결과 정리는 서버 코어의 책임으로 유지한다.
5. MCP는 서버 API를 LLM 친화적인 tool 인터페이스로 노출하는 어댑터 역할만 맡는다.
6. 서버가 실행 중이지 않거나 연결할 수 없으면 MCP는 원인을 포함한 명확한 오류를 반환한다.
7. 최초 구현에서는 tool 수를 최소 범위로 제한하고, 주간보고 알림이나 외부 메신저 연동은 포함하지 않는다.
8. 최초 구현의 MCP tool은 모두 `read-only`여야 하며, Jira 댓글 등록, 이슈 생성, 이슈 수정 기능은 열지 않는다.

## 구조 방향

이번 단계의 권장 흐름은 아래와 같다.

1. `LLM Client -> MCP Server`
2. `MCP Server -> localhost HTTP -> NestJS Server`
3. `NestJS Server -> Jira API`

이번 단계에서는 `MCP -> Server 직접 코어 호출`보다 `MCP -> localhost HTTP`를 우선한다.

이유는 아래와 같다.

1. 현재 CLI가 이미 로컬 서버 API 호출 구조를 사용한다.
2. 호출 경로를 CLI와 MCP 사이에서 일치시킬 수 있다.
3. 서버 API를 단일 실행 경계로 유지할 수 있다.
4. 이후 Web UI 또는 다른 클라이언트가 추가되어도 같은 서버를 재사용할 수 있다.

## 범위

이번 단계 구현 범위는 아래와 같다.

1. MCP 엔트리포인트를 실제 MCP 서버 실행 흐름으로 확장
2. 로컬 서버 호출 전용 API client 추가 또는 기존 CLI용 API client 공용화
3. 조회 전용 최소 MCP tool 세트 정의
4. tool 입력값을 기존 서버 API 요청 형식으로 매핑
5. 서버 응답을 MCP tool 결과 형식으로 정리
6. 서버 미실행, 연결 실패, 잘못된 base URL에 대한 오류 메시지 정리
7. README 또는 사용 문서에 MCP 사용 방법 추가

## 세부 작업지시서

### 1. 조회 전용 MCP HTTP 어댑터

세부 구현 지시서는 `docs/versions/0.6.0/work-instruction-01-mcp-read-only-http-adapter.md`를 따른다.

## 최소 tool 세트

첫 단계에서 아래 tool만 구현 대상으로 본다.

1. `health_status`
2. `jira_search`
3. `jira_issue_get`
4. `jira_project_lookup`

필요 시 후속 단계에서 아래를 추가할 수 있다.

1. `jira_comment_create`
2. `weekly_report_generate`
3. `config_status`

이번 단계에서는 `jira_comment_create`를 구현하지 않는다.

## 서버 API 연동 기준

MCP는 기존 서버의 아래 API 경로를 우선 사용한다.

1. `GET /health`
2. `POST /jira/search`
3. `GET /jira/issues?query=...`
4. `GET /jira/issues/:issueKey`
5. `GET /jira/projects?query=...`

이번 단계에서는 위 경로를 우선 재사용하고, MCP 도입만을 위해 별도 Jira 전용 코어 로직을 중복 구현하지 않는다.

## 설정 방향

이번 단계에서 MCP는 아래 우선순위로 서버 base URL을 결정한다.

1. `QWEN_JIRA_API_BASE_URL`
2. `LOCAL_SERVER_API_BASE_URL`
3. 사용자 설정 파일의 `serverPort` 기준 기본 URL

설정 해석 방식은 기존 CLI 동작과 가능한 한 동일해야 한다.

## 제외 범위

이번 문서에서는 아래 항목을 다루지 않는다.

1. MCP가 Jira REST API를 직접 호출하는 구조
2. MCP 전용 Query 정규화 로직 추가
3. Jira 댓글 등록, 이슈 생성, 이슈 수정 등 쓰기 기능
4. Slack, Email, 카카오톡 등 알림 기능
5. Web UI
6. 다중 서버 discovery
7. 인증 프록시, 원격 배포, SaaS 운영 구조
8. MCP 도입만을 위한 대규모 리팩토링

## 산출물

1. `0.6.0` 기준 작업지시서 1건
2. 실행 가능한 MCP 엔트리포인트
3. 조회 전용 최소 MCP tool 세트
4. 서버 HTTP 연동용 client 또는 공용 client 정리
5. MCP 사용 문서 또는 README 반영

## 검증 기준

아래 조건을 만족하면 이번 단계 완료로 본다.

1. MCP가 더 이상 scaffold descriptor만 출력하지 않는다.
2. `health_status` tool이 로컬 서버 상태를 반환한다.
3. `jira_search` tool이 기존 서버의 Jira 조회 결과를 받아 반환한다.
4. `jira_issue_get` tool이 이슈 키 기준 상세 확인을 수행한다.
5. `jira_project_lookup` tool이 프로젝트 검색 결과를 반환한다.
6. 서버가 꺼져 있으면 MCP가 연결 실패 원인을 명확히 반환한다.
7. CLI와 MCP가 같은 서버 API 계약을 재사용한다는 점이 코드나 문서에서 확인된다.
8. Jira 데이터를 변경하는 MCP tool은 이번 단계 결과물에 포함되지 않는다.
9. 작업 완료 보고에 인코딩 검증 결과가 포함된다.

## 구현 메모

구현 시 아래 방향을 권장한다.

1. 기존 `CliApiClient`를 그대로 복제하기보다 공용화 가능성을 먼저 검토한다.
2. MCP tool 이름은 짧고 의미가 명확해야 한다.
3. MCP 응답에는 LLM이 바로 활용할 수 있는 요약 정보와 원본 필드를 함께 담는 방향을 우선 검토한다.
4. 예외 메시지는 사용자 행동 지침을 포함해야 한다.

## 후속 단계

이번 단계 완료 후 아래를 검토할 수 있다.

1. `jira_comment_create` tool 추가
2. 주간보고 생성 tool 추가
3. 원격 MCP 사용 시 서버 주소 직접 지정 옵션
4. 필요 시 서버 API와 MCP 응답 스키마의 문서화 강화
