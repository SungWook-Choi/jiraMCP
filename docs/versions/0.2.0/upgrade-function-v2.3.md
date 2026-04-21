# 작업 지시서: 기간 조회 기준 정밀화 2차

## 문서 목적

이 문서는 기간 기반 Jira 조회 결과의 정확도를 높이기 위한 2차 작업 지시서다.

현재 조회 기준은 일부 기간에서 `updated` 또는 `status changed` 기준을 사용하고 있다. 그러나 실사용 과정에서 아래 문제가 확인되었다.

1. `updated` 기준은 실제 작업하지 않은 오래된 이슈도 다시 조회될 수 있다.
2. `status changed` 기준만 사용하면 신규 등록 이슈가 누락될 가능성을 완전히 배제하기 어렵다.
3. 사용자는 조회 조건 선택 단계를 더 늘리길 원하지 않는다.

이번 작업은 사용자 입력 구조는 그대로 유지하면서, 기간별 내부 조회 기준만 더 정교하게 조정하는 것을 목표로 한다.

## 작업명

`기간 조회 기준 정밀화 2차 - created + status changed 조합 적용`

## 목표

이번 작업의 목표는 다음과 같다.

1. 사용자 입력 단계는 추가하지 않는다.
2. `today`, `yesterday`, `this_week`, `last_week` 조회 정확도를 높인다.
3. 신규 등록 이슈와 실제 상태 변경 이슈를 모두 조회 가능하게 만든다.
4. 오래된 이슈가 단순 `updated` 변경으로 다시 섞이는 문제를 줄인다.
5. `custom_range`는 우선 기존 동작을 유지한다.

## 작업 범위

이번 작업에서는 아래 항목만 구현 대상으로 본다.

### 1. 사용자 입력 구조 유지

기존 사용자 입력 흐름은 그대로 유지한다.

1. 조회 모드 선택
2. assignee 또는 project 입력
3. 기간 선택
4. Markdown 저장 여부 선택

이번 작업에서는 새로운 옵션, 질문, 고급 필터 선택 단계를 추가하지 않는다.

### 2. 기간별 내부 조회 기준 재정의

다음 기간값은 내부 JQL 기준을 아래 방향으로 조정한다.

1. `today`
- `created today OR status changed today` 성격의 조건으로 처리한다.

2. `yesterday`
- `created yesterday OR status changed yesterday` 성격의 조건으로 처리한다.

3. `this_week`
- `created during this week OR status changed during this week` 성격의 조건으로 처리한다.

4. `last_week`
- `created during last week OR status changed during last week` 성격의 조건으로 처리한다.

### 3. custom_range 유지

`custom_range`는 이번 단계에서 기존 기준을 유지한다.

1. 날짜 범위 직접 입력 기능은 유지한다.
2. `custom_range`는 우선 `updated` 기반 범위 조회를 유지한다.
3. 이번 작업에서는 `custom_range`를 `created + status changed` 기준으로 바꾸지 않는다.

## 설계 원칙

이번 작업은 아래 원칙을 따른다.

1. 사용자 입력 단계는 늘리지 않는다.
2. Query Schema 변경은 최소화한다.
3. 조회 품질 개선은 CLI가 아니라 JQL 생성기 내부에서 처리한다.
4. 기존 `assignee`, `project`, `assignee_project` 세 모드는 유지한다.
5. Markdown 및 console 출력 구조는 유지한다.
6. 대규모 구조 개편 없이 현재 구조 안에서 해결한다.

## 비범위

아래 항목은 이번 작업 범위에서 제외한다.

1. 새로운 CLI 선택 옵션 추가
2. 조회 기준 직접 선택 기능 추가
3. changelog 기반 정밀 후처리 도입
4. Web UI 변경
5. MCP 조회 기준 확장
6. 다중 고급 필터 추가
7. 자연어 기반 조회 정책 추가

## 권장 구현 방향

구현은 아래 순서를 우선 참고한다.

1. 현재 기간별 JQL 생성 로직을 점검한다.
2. `today`, `yesterday`, `this_week`, `last_week`의 내부 조건을 재설계한다.
3. Jira JQL에서 `created`와 `status changed`를 조합한 조건을 구성한다.
4. `custom_range`는 기존 `updated` 기반 동작을 유지한다.
5. 결과가 실제 업무 흐름에 더 가깝게 개선되었는지 비교 검증한다.

## 검증 항목

완료 전 아래 항목을 검증해야 한다.

1. 사용자 입력 단계가 늘어나지 않는다.
2. `today` 조회 시 오늘 신규 생성 이슈가 포함된다.
3. `today` 조회 시 오늘 실제 상태가 변경된 이슈가 포함된다.
4. `yesterday` 조회 시 어제 신규 생성 또는 상태 변경 이슈가 포함된다.
5. `this_week`, `last_week` 조회 시 신규 생성 이슈와 상태 변경 이슈가 모두 포함된다.
6. 몇 주 전 완료된 이슈가 단순 `updated` 변경 때문에 다시 섞이는 비율이 줄어든다.
7. `custom_range` 기존 동작이 깨지지 않는다.
8. `assignee`, `project`, `assignee_project` 세 모드가 모두 동작한다.
9. `npm run typecheck`가 통과한다.
10. `npm run build`가 통과한다.
11. 가능하면 실제 Jira 데이터 기준으로 변경 전후 결과를 비교한다.

## 주의사항

이번 작업은 기간 조회 정확도를 높이기 위한 2차 보정이다.

`created + status changed` 조합은 신규 등록 이슈와 실제 상태 변경 이슈를 함께 포착하는 데 유리하다. 하지만 설명 수정, 댓글 추가, 본문 수정처럼 상태 변화 없이 수행한 작업은 여전히 누락될 수 있다.

이번 단계에서는 사용자 피로를 늘리지 않고, 주간/일간 업무 취합 정확도를 높이는 것을 우선한다. 더 정밀한 작업 이력 추적은 후속 단계에서 changelog 기반 개선으로 검토한다.

## 완료 보고 형식

완료 보고에는 아래 항목을 반드시 포함한다.

1. 변경 파일
2. 수행 내용
3. 검증 결과
4. 기간별 변경 전후 조회 기준 차이
5. 작업지시서 범위 준수 여부
6. 남은 제한사항
