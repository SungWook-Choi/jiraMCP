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
2. `sub-agent` is responsible for NestJS design and implementation.
3. `sub-agent` performs the work.
4. `main-agent` must not implement the assigned work unless the user explicitly changes the role.
5. `main-agent` waits for completion, then reviews.
6. If review fails, request rework with concrete reasons.
7. Repeat until the work passes review.
8. If the same kind of rework happens 2+ times in the same work item, propose a stronger rule with user approval.

## References

- Work instruction: `/Users/bbosungmini/WebstormProjects/qwen3JiraMCP/docs/work-instruction.md`
- Knowledge guide: `/Users/bbosungmini/WebstormProjects/qwen3JiraMCP/Knowledge/README.md`
- Main-agent rule: `/Users/bbosungmini/WebstormProjects/qwen3JiraMCP/Knowledge/rules/main-agent.md`
- Sub-agent rule: `/Users/bbosungmini/WebstormProjects/qwen3JiraMCP/Knowledge/rules/sub-agent.md`
- NestJS rule: `/Users/bbosungmini/WebstormProjects/qwen3JiraMCP/Knowledge/rules/nestjs.md`
- React rule: `/Users/bbosungmini/WebstormProjects/qwen3JiraMCP/Knowledge/rules/react.md`
