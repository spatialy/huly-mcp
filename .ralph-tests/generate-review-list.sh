#!/usr/bin/env bash
set -euo pipefail

OUTPUT_FILE=".ralph-tests/review-list.txt"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2; }

log "Extracting test case positions..."

# Search both test/ and src/ for scheduled markers
> "$OUTPUT_FILE"
for dir in test src; do
    if [ -d "$dir" ]; then
        grep -rl "test-revizorro: scheduled" "$dir" 2>/dev/null | while read -r file; do
            grep -n "test-revizorro: scheduled" "$file" | cut -d: -f1 | while read -r line; do
                echo "$file:$line"
            done
        done >> "$OUTPUT_FILE"
    fi
done

COUNT=$(wc -l < "$OUTPUT_FILE" | tr -d ' ')
log "Found $COUNT test cases to review"
log "Written to: $OUTPUT_FILE"
