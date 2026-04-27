# External API Rule

## Purpose

- Prevent repeated rework caused by outdated endpoint assumptions.
- Force latest official contract verification before implementation and before review pass.

## Scope

- Third-party APIs
- Product REST APIs
- SDK or library APIs that are known to change over time

## Main-Agent Duties

1. Verify the latest official documentation before assigning implementation work.
2. Record the verified contract in the work instruction.
3. Include:
   - endpoint
   - HTTP method
   - request shape
   - pagination rule
   - authentication rule
   - deprecation or migration notes
   - verification date
4. If logs mention deprecation, removal, migration, or a changelog link, pause rework and verify again from the official source.
5. Do not pass review unless runtime evidence matches the verified contract, or the environment limitation is explicitly documented.

## Sub-Agent Duties

1. Implement only from the verified contract written in the work instruction.
2. Do not change endpoint family, pagination strategy, or payload shape from memory or inference.
3. If logs contradict the work instruction or show API removal or migration guidance, stop guess-based edits and return the mismatch to `main-agent`.
4. Final completion report must state:
   - implemented endpoint and method
   - implemented pagination rule
   - runtime verification completed or not completed
   - remaining risk

## Mandatory Checklist

1. Read latest official documentation.
2. Check whether the endpoint is active, deprecated, or removed.
3. Confirm request body or query parameter shape.
4. Confirm pagination contract.
5. Confirm auth and permission expectations.
6. Confirm example response fields used by the code.
7. Re-check when runtime logs contradict assumptions.
8. Preserve proof in the work instruction or review note.

## Runtime Verification Minimum

1. Confirm the target process calls the intended endpoint.
2. Confirm the request no longer fails with contract-level errors.
3. Confirm the expected artifact, response, or file is produced.
4. If full runtime verification is blocked by environment, document exactly what was blocked.
