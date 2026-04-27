# Work Instruction Addendum: Weekly Report Output Template

## Purpose

This addendum overrides the markdown output template section of the weekly report scheduler work item.

Base instruction:
- `docs/versions/0.5.0/work-instruction-01-weekly-report-scheduler.md`

## Required Output Format

Weekly report markdown body must follow this format.

```md
## 2026-W18 주간보고

1. [프로젝트명] jira 이슈명
2. [프로젝트명] jira 이슈명
3. [프로젝트명] jira 이슈명
```

## Rules

1. A title line is required.
2. Title format is `## {cycleKey} 주간보고`.
3. Each issue row must use a numeric ordered list item.
4. Each item body format is `[프로젝트명] jira 이슈명`.
5. Do not use `-` bullet rows for issues.
6. Do not add description paragraphs or extra summary sections.
7. If there are no issues, keep the title and leave the item list empty.
8. Existing file naming, overwrite, assignee, and changelog rules remain unchanged.

## Completion Criteria Addendum

1. Generated markdown starts with the required title.
2. Every issue row is rendered as an ordered list item.
3. The previous plain line-only template is removed.
