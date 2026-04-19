# Knowledge

이 폴더는 이 프로젝트에서 실제로 사용하는 최소 규칙만 보관한다.

## Encoding Rule

- 모든 문서와 코드는 반드시 `UTF-8`로 읽는다.
- 모든 문서와 코드는 반드시 `UTF-8`로 저장한다.
- 한글이 포함된 파일도 인코딩을 추측하거나 다른 방식으로 변환하지 않는다.

## 사용 순서

1. 루트의 `AGENTS.md`를 먼저 읽는다.
2. 역할에 따라 아래 문서를 읽는다.
3. 구현 작업은 작업지시서 범위 안에서만 진행한다.

## 문서 목록

- `rules/main-agent.md`
- `rules/sub-agent.md`
- `rules/nestjs.md`
- `rules/react.md`

## 현재 원칙

- `main-agent`는 메인 리뷰어 역할만 수행한다.
- `sub-agent`는 NestJS 설계 및 구현 담당 역할을 수행한다.
- 실제 작업은 `sub-agent`가 하고, `main-agent`는 검수와 재작업 지시를 담당한다.
- 검수는 `AGENTS.md`와 `docs/work-instruction.md`를 기준으로 진행한다.
