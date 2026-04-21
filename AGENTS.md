# AGENTS.md

## Session Keymap

1. Read all docs and code as `UTF-8`.
2. Write and save docs and code as `UTF-8`.
3. Do not guess, reinterpret, or convert to another encoding.
4. Do not start implementation before reading this file.
5. Use this file as a lightweight keymap only.
6. Read detailed rules from `Knowledge/rules`.

## Workflow

1. `main-agent` is the reviewer.
2. `main-agent` must create or update the work instruction before assigning work to `sub-agent`.
3. `sub-agent` is responsible for NestJS design and implementation.
4. `sub-agent` performs the work.
5. `main-agent` must not implement the assigned work unless the user explicitly changes the role.
6. Writing, organizing, and saving the work instruction is considered work management, not implementation.
7. `sub-agent` must work only from the work instruction finalized by `main-agent`.
8. If the work instruction is missing or incomplete, neither implementation nor review starts.
9. `main-agent` creates a new `sub-agent` for each work item by default.
10. Reusing the same `sub-agent` is allowed only for continuous rework within the same work instruction.
11. When the work item changes, the previous `sub-agent` must not be reused.
12. `main-agent` waits for completion, then reviews.
13. If review fails, request rework with concrete reasons.
14. Repeat until the work passes review.
15. If the same kind of rework happens 2+ times in the same work item, propose a stronger rule with user approval.

## References

- Work instruction: `/Users/bbosungmini/WebstormProjects/qwen3JiraMCP/docs/versions/0.1.0/work-instruction.md`
- Knowledge guide: `/Users/bbosungmini/WebstormProjects/qwen3JiraMCP/Knowledge/README.md`
- Main-agent rule: `/Users/bbosungmini/WebstormProjects/qwen3JiraMCP/Knowledge/rules/main-agent.md`
- Sub-agent rule: `/Users/bbosungmini/WebstormProjects/qwen3JiraMCP/Knowledge/rules/sub-agent.md`
- NestJS rule: `/Users/bbosungmini/WebstormProjects/qwen3JiraMCP/Knowledge/rules/nestjs.md`
- React rule: `/Users/bbosungmini/WebstormProjects/qwen3JiraMCP/Knowledge/rules/react.md`
