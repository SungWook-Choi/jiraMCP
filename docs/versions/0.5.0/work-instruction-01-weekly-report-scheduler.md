# 작업 지시서: v0.5.0 1번 주간보고 스케줄러 추가

## 문서 목적

이 문서는 `qwen-jira-mcp@0.5.0` 작업 항목인 주간보고용 Jira 주간 업무 조회 스케줄러의 구현 범위를 고정하기 위한 작업 지시서다.

상위 기준 문서는 `docs/versions/0.5.0/work-instruction.md`다.

## 작업 배경

현재 주간 업무 조회는 사용자가 직접 CLI를 실행해 Markdown 저장 여부를 선택하는 흐름이다.

하지만 주간보고 용도에서는 같은 작업을 매주 반복 실행해야 하므로, 사용자가 수동으로 명령을 실행하지 않아도 `qwen-jira-server`가 살아 있는 동안 자동으로 주간 결과가 생성되어야 한다.

또한 주간 업무 여부는 Jira의 `updated` 값이 아니라 실제 변경 이력이 담긴 `changelog`를 기준으로 판정해야 한다. 이 기준은 `docs/versions/0.2.0/upgrade-function-v2.4.md`에서 정리한 작업 이력 판정 방향을 그대로 따른다.

## 목표

1. `qwen-jira-server` 실행 중 주간보고 스케줄러가 계속 동작한다.
2. 사용자는 `qwen-jira-config`에서 주간보고 실행 요일을 지정할 수 있다.
3. 사용자는 `qwen-jira-config`에서 주간보고 실행 시간을 시(hour) 단위로 지정할 수 있다.
4. 지정된 요일과 시간대에 해당 주 Jira 주간 업무 조회가 자동 실행된다.
5. 자동 실행 결과는 `resultOutputDir/weekly-report` 경로에 Markdown 파일로 저장된다.
6. 자동 조회 담당자는 현재 로그인한 Jira API Token 소유자 본인으로 고정한다.
7. 결과 본문은 각 줄마다 `[프로젝트명] jira 이슈명` 형식만 출력한다.
8. 주간 업무 판정은 `updated`가 아니라 `changelog` 기준으로 처리한다.

## 포함 범위

이번 작업 범위는 아래를 포함한다.

1. `qwen-jira-config` 질문 항목에 주간보고 실행 요일 추가
2. `qwen-jira-config` 질문 항목에 주간보고 실행 시간 추가
3. 사용자 설정 파일에 `weeklyReportWeekday`, `weeklyReportHour` 저장
4. 서버 실행 중 스케줄러 등록 및 유지
5. 지정된 요일과 시간대 판정 로직
6. 같은 주 중복 실행 방지 로직
7. 현재 API Token 소유자 조회 로직
8. 기존 주간 조회 코어와 스케줄러 연결
9. `changelog` 기준 주간 업무 판정 재사용 또는 연결
10. Markdown 자동 출력
11. 스케줄 실행 로그와 실패 로그 기록
12. 관련 README 또는 버전 문서 보강

## 세부 규칙

1. 스케줄러는 `qwen-jira-server` 프로세스 안에서 동작한다.
2. 별도 `qwen-jira-scheduler` 명령은 이번 범위에 추가하지 않는다.
3. 실행 요일은 `qwen-jira-config`에서 설정한 `weeklyReportWeekday` 값을 사용한다.
4. 실행 시간은 `qwen-jira-config`에서 설정한 `weeklyReportHour` 값을 사용한다.
5. `weeklyReportWeekday` 허용값은 `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`로 고정한다.
6. `weeklyReportHour` 형식은 24시간제 정수 시각으로 고정하며 허용 범위는 `0`부터 `23`까지다.
7. 시간 해석 기준은 서버 로컬 시간대가 아니라 사용자 운영 기준 시간대인 `Asia/Seoul`로 고정한다.
8. `weeklyReportWeekday` 또는 `weeklyReportHour` 값이 없으면 스케줄러는 자동 실행을 하지 않고, 서버 로그에 비활성 상태를 남긴다.
9. 서버가 실행 중인 동안 스케줄러는 최소 1분 단위로 현재 시각과 이번 주 실행 여부를 점검한다.
10. 현재 시각의 요일이 설정값과 같고 현재 시간이 설정한 시(hour) 안에 들어오며 이번 주에 아직 자동 생성하지 않았으면 그 주에 한 번만 실행한다.
11. 분과 초는 실행 조건에 사용하지 않는다.
12. 같은 프로세스 실행 중에는 같은 보고 주기에 1회만 실행한다.
13. 서버 재시작 후 현재 시각이 `weeklyReportWeekday`, `weeklyReportHour` 조건을 만족하지 않으면 실행하지 않는다.
14. 서버 재시작 후 현재 시각이 같은 보고 주기의 지정 요일 및 지정 시간대 조건을 만족하면 다시 실행할 수 있으며, 이 경우 결과 파일은 같은 주 기준 파일에 overwrite 한다.
15. 주간 조회 범위는 일반적인 `this_week`를 사용하지 않고, 주간보고 실행 기준 경계 시각 사이의 최근 7일 보고 구간을 사용한다.
16. 조회 대상 담당자는 현재 인증에 사용한 Jira API Token 소유자 본인으로만 고정한다.
17. 담당자 식별은 Jira `myself` API 응답으로 고정하고, 해당 응답의 `accountId`를 조회 기준으로 사용한다.
18. displayName, email, 이름 문자열 비교, 다른 사용자 검색 API는 스케줄러 담당자 판정에 사용하지 않는다.
19. `assigneeAllInclude`는 이 스케줄러 조회 대상 결정에 사용하지 않는다.
20. 현재 보고 구간의 종료 경계는 `weeklyReportWeekday`, `weeklyReportHour`, `Asia/Seoul` 기준 현재 실행 주기의 기준 시각으로 잡는다.
21. 시작 경계는 종료 경계에서 정확히 7일 전 시각으로 잡는다.
22. 보고 구간 판정은 `start <= changedAt < end`의 반개구간으로 처리한다.
23. 예를 들어 `monday`, `13`이면 조회 범위는 전주 월요일 `13:00:00` 이상 이번 주 월요일 `13:00:00` 미만이다.
24. 주간 업무 판정은 `docs/versions/0.2.0/upgrade-function-v2.4.md`의 기준을 따라 `changelog` 기반으로 처리한다.
25. `updated` 값만으로 작업 여부를 판정하지 않는다.
26. 결과 파일은 사용자 설정 `resultOutputDir` 경로의 하위 폴더 `weekly-report` 아래에 저장한다.
27. 결과 파일 확장자는 `.md`로 고정한다.
28. 결과 파일 본문은 각 줄마다 `[프로젝트명] jira 이슈명` 형식만 기록한다.
29. 결과 파일에는 설명 문단, 헤더, 통계, 메타 정보, 주간 이슈 본문, 부가 요약을 넣지 않는다.
30. 같은 이슈가 여러 작업 이력으로 잡혀도 결과 줄은 이슈 단위로 중복 없이 한 번만 기록한다.
31. 프로젝트명은 조회 결과에서 확인 가능한 프로젝트 표시명을 사용한다.
32. 결과가 없는 주에도 Markdown 파일은 생성하되 본문은 빈 파일로 둔다.
33. 같은 주에 재실행되면 기존 파일에 append 하지 않고 전체 파일 내용을 새 결과로 overwrite 한다.
34. `resultOutputDir` 또는 그 하위 `weekly-report` 폴더가 없으면 자동 생성한다.
35. 자동 실행 실패 시 서버 프로세스 전체를 종료하지 않고 오류를 로그로 남긴다.
36. 기존 사용자의 수동 `qwen-jira` 조회 흐름은 이번 작업으로 깨지면 안 된다.

## 출력 형식 기준

출력 파일 본문은 아래 형식만 허용한다.

```text
[프로젝트A] 로그인 오류 수정
[프로젝트B] 결재 라인 예외 처리
[프로젝트B] Jira API 응답 파싱 수정
```

아래 항목은 출력에 포함하지 않는다.

1. `# 주간보고`
2. `-` bullet
3. 설명 문단
4. 상태 요약
5. 담당자명
6. 이슈 설명 또는 댓글 내용

## 파일명 기준

결과 파일명은 주간보고 자동 생성 파일임을 구분할 수 있어야 하며, 같은 주 결과가 덮어쓰기 또는 중복 생성으로 혼란을 만들지 않도록 실행일이 아니라 주 식별 정보를 포함해야 한다.

이번 작업에서는 아래 형식으로 고정한다.

`jira-weekly-report-YYYY-Www.md`

여기서 `YYYY-Www`는 `Asia/Seoul` 기준 보고 구간 종료 경계가 속한 ISO week 식별값을 사용한다.

예:

- `jira-weekly-report-2026-W18.md`

같은 주에 재실행되면 위 파일을 새 결과로 overwrite 한다.

## 변경 대상 기준

예상 변경 대상은 아래 범위 안으로 제한한다.

1. `src/server-entry.ts`
2. `src/config` 또는 사용자 설정 로더
3. `src/cli` 또는 `src/config-cli`
4. `src/query`
5. `src/jira`
6. Markdown 출력 관련 모듈
7. 필요 시 스케줄러 전용 서비스 또는 모듈
8. `README.md` 또는 `docs/USER_MANUAL.md`

명시 지시가 없으면 Web 기능, MCP 확장, 대규모 모듈 재구성은 금지한다.

## 제외 범위

아래 항목은 이번 작업 범위에서 제외한다.

1. 여러 실행 시각 동시 설정
2. 여러 요일 동시 설정
3. 수동 재실행 버튼 또는 관리자 화면
4. Slack, Email, Teams 등 외부 발송
5. 다중 서버 인스턴스 간 분산 락
6. 주간보고 결과 후처리 편집 기능
7. Markdown 외 추가 출력 포맷
8. 주간보고 외 다른 자동 보고서

## 산출물

이번 작업에서 최소한 아래 결과가 있어야 한다.

1. 주간보고 스케줄러 코드
2. `qwen-jira-config`의 실행 요일/시간 설정 반영
3. 현재 API Token 소유자 담당자 식별 반영
4. 자동 생성 Markdown 출력 기능
5. 같은 주 중복 실행 방지 기능
6. 스케줄러 사용 방식이 반영된 문서

## 완료 기준

아래 조건을 만족하면 이번 작업을 완료로 본다.

1. `qwen-jira-server` 실행 중 스케줄러가 등록되어 동작한다.
2. `qwen-jira-config`로 저장한 `weeklyReportWeekday`, `weeklyReportHour` 값이 자동 실행 기준으로 반영된다.
3. 설정 요일의 설정 시간대에 해당 주 자동 생성이 한 번만 수행된다.
4. 조회 대상 담당자가 현재 로그인한 Jira API Token 소유자 본인으로 결정된다.
5. 생성 결과가 `resultOutputDir/weekly-report`에 주 기준 파일명으로 저장된다.
6. 결과 파일 본문이 각 줄마다 `[프로젝트명] jira 이슈명` 형식만 포함한다.
7. 주간 업무 판정이 `updated`만이 아니라 `changelog` 기준으로 처리된다.
8. 같은 주 재실행 시 기존 주간보고 파일이 append가 아니라 overwrite 된다.
9. 수동 CLI 조회 흐름은 기존처럼 계속 사용할 수 있다.
10. 자동 실행 실패 시 서버가 비정상 종료되지 않는다.

## 검증 기준

최소한 아래 항목을 검증해야 한다.

1. `qwen-jira-config`에서 주간보고 실행 요일을 저장할 수 있는지 확인
2. `qwen-jira-config`에서 주간보고 실행 시간을 시(hour) 단위로 저장할 수 있는지 확인
3. 설정 파일에 `weeklyReportWeekday`, `weeklyReportHour`가 UTF-8 JSON으로 저장되는지 확인
4. 서버 기동 후 스케줄러 등록 로그 또는 동등한 확인 수단 점검
5. 설정 요일/시간대에 테스트용 실행이 실제로 한 번 수행되는지 확인
6. 현재 로그인한 Jira API Token 소유자 식별이 올바르게 되는지 확인
7. 다른 담당자 이슈가 아니라 토큰 소유자 본인 담당 이슈만 조회되는지 확인
8. 같은 주에 재실행되면 새 파일 추가가 아니라 기존 주 파일 overwrite가 되는지 확인
9. 생성 파일이 `resultOutputDir/weekly-report`에 저장되는지 확인
10. 파일명이 실행일이 아니라 주 기준 식별값으로 생성되는지 확인
11. 출력 본문이 `[프로젝트명] jira 이슈명` 줄 형식만 가지는지 확인
12. `changelog` 기준 변경 이력이 있는 이슈가 결과에 포함되는지 확인
13. `updated` 값은 바뀌었지만 작업 인정 대상 `changelog`가 없는 이슈가 제외되는지 가능하면 확인
14. 결과가 없는 주에 빈 Markdown 파일이 생성되는지 확인
15. `npm run typecheck`가 통과하는지 확인
16. `npm run build`가 통과하는지 확인

## 보고 형식

완료 보고에는 아래를 반드시 포함한다.

1. 변경 파일 목록
2. 스케줄 등록 방식 설명
3. `weeklyReportWeekday`, `weeklyReportHour` 저장 및 반영 방식
4. 현재 API Token 소유자 담당자 식별 방식
5. 같은 주 재실행 및 overwrite 방식
6. `weekly-report` 하위 폴더 경로와 주 기준 파일명 규칙
7. `changelog` 기준 작업 판정 반영 방식
8. 검증 결과
9. 작업지시서 범위 준수 여부
10. 남은 제한사항
