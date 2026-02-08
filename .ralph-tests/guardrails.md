# Guardrails

Learned patterns from failures. Read before each file.

## General Rules

- Read entire test file first
- Mark all active test cases
- Skip disabled tests
- Be idempotent
- Don't modify test logic

---

## Project-Specific Learnings

- Tests use `it.effect()` from `@effect/vitest` - treat same as `it()`
- Some tests are in `src/` directory (co-located), not just `test/`
