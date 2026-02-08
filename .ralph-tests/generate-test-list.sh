#!/usr/bin/env bash
set -euo pipefail

OUTPUT_FILE=".ralph-tests/test-files.txt"
mkdir -p .ralph-tests

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2; }

log "Detected: Vitest (TypeScript)"
log "Generating test file list..."

# Find all .test.ts files in both test/ and src/ directories
find test src -name "*.test.ts" -type f 2>/dev/null | sort -u > "$OUTPUT_FILE"

COUNT=$(wc -l < "$OUTPUT_FILE" | tr -d ' ')
log "Found $COUNT test files"
log "Written to: $OUTPUT_FILE"
