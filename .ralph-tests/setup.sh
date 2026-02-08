#!/usr/bin/env bash
set -euo pipefail

log() { echo "[SETUP] $1"; }

log "Initializing test-revizorro..."

chmod +x .ralph-tests/*.sh

log "Generating test file list..."
./.ralph-tests/generate-test-list.sh

mkdir -p .ralph-tests
cat > .ralph-tests/state.json <<'EOF'
{
  "current_index": 0,
  "failure_count": 0,
  "processed": []
}
EOF

cat > .ralph-tests/guardrails.md <<'EOF'
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
EOF

touch .ralph-tests/errors.log

log "Setup complete"
log ""
log "Next steps:"
log "  1. Review: .ralph-tests/test-files.txt"
log "  2. Run Phase 1: ./.ralph-tests/mark-tests.sh"
