#!/usr/bin/env bash
# Phase 2: Parallel test review with agent pool
set -euo pipefail

POOL_SIZE=${POOL_SIZE:-4}
REVIEW_LIST="${REVIEW_LIST:-.ralph-tests/review-list.txt}"
CLAUDE_CLI="${CLAUDE_CLI:-claude}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

build_review_prompt() {
    local test_file=$1
    local test_line=$2
    local test_index=$3
    local total_tests=$4

    cat <<EOF
# TEST REVIEW - test-revizorro Phase 2 - [${test_index}/${total_tests}]

You are a fresh agent session. Your ONLY job: review ONE test case for AI antipatterns.

## Test Location
File: \`$test_file\`
Line: $test_line (marker comment line)

## Your Mission

Analyze this ONE test case for AI-generated quality issues.

## Steps

1. **Read test file**, find test case at line $test_line
   - The marker \`// test-revizorro: scheduled\` is at line $test_line
   - The actual test (it/test/it.effect) is on the NEXT line

2. **Read related application code**
   - Find what's being tested (imports, functions, classes)
   - Read source files to understand expected behavior

3. **Analyze for AI antipatterns**:

   **Fake Pass Indicators**:
   - Expectations changed to match wrong output (toBe(actualWrong) instead of toBe(expectedCorrect))
   - Mock setup returns convenient values that make test pass without testing real behavior
   - Assertions removed or weakened (expect anything, accept all results)
   - Test verifies implementation details, not behavior

   **Useless Mock Indicators**:
   - Mock returns hardcoded value unrelated to test scenario
   - Mock bypasses all logic being tested
   - Mock setup more complex than real implementation
   - Every external dependency mocked (nothing actually tested)

   **No Real Testing**:
   - Test only checks types/syntax (expect(result).toBeDefined())
   - Test passes with any value (expect(result).toBeTruthy())
   - No assertions or only trivial ones
   - Test duplicates another test exactly

4. **Make decision and update marker**:

   **If test is GOOD** (tests real behavior, proper assertions, realistic mocks):
   Change \`// test-revizorro: scheduled\` to \`// test-revizorro: approved\`

   **If test is SUSPECT** (has antipatterns):
   Change \`// test-revizorro: scheduled\` to:
   \`// test-revizorro: suspect | [Brief explanation: what's wrong and why]\`

## Critical Rules

- Review ONLY the one test at specified line
- Read application code to understand expected behavior
- Change ONLY the marker comment (scheduled -> approved/suspect)
- Don't modify test logic
- Keep explanations brief (one line)
- Always include reasoning in suspect marker

## On Completion

Output: "REVIEWED: $test_file:$test_line - [approved|suspect]"
EOF
}

# Read review list
if [ ! -f "$REVIEW_LIST" ]; then
    log "ERROR: $REVIEW_LIST not found. Run setup-phase2.sh first."
    exit 1
fi

reviews=()
while IFS= read -r line; do
    reviews+=("$line")
done < "$REVIEW_LIST"
total=${#reviews[@]}

log "Starting review pool (size: $POOL_SIZE)"
log "Total test cases: $total"

declare -a pids

for ((idx=0; idx<total; idx++)); do
    review_item="${reviews[$idx]}"
    test_file=$(echo "$review_item" | cut -d: -f1)
    test_line=$(echo "$review_item" | cut -d: -f2)

    # Wait if pool is full
    while true; do
        running=0
        if [ ${#pids[@]} -gt 0 ]; then
            for pid in "${pids[@]}"; do
                if kill -0 "$pid" 2>/dev/null; then
                    running=$((running + 1))
                fi
            done
        fi
        if [ $running -lt $POOL_SIZE ]; then
            break
        fi
        sleep 0.5
    done

    log "[$((idx + 1))/$total] Spawning: $test_file:$test_line"

    (
        prompt=$(build_review_prompt "$test_file" "$test_line" $((idx + 1)) $total)
        output_file="/tmp/revizorro_review_$idx.log"
        echo "$prompt" | $CLAUDE_CLI -p --model haiku --permission-mode acceptEdits > "$output_file" 2>&1
        exit_code=$?

        if [ $exit_code -eq 0 ]; then
            log "Completed: $test_file:$test_line"
        else
            log "Failed: $test_file:$test_line (exit: $exit_code)"
        fi
    ) &

    pids+=($!)
done

log "Waiting for all jobs to complete..."
wait

log "All reviews complete"

# Summary
approved=$(grep -r "test-revizorro: approved" test/ src/ 2>/dev/null | wc -l | tr -d ' ')
suspect=$(grep -r "test-revizorro: suspect" test/ src/ 2>/dev/null | wc -l | tr -d ' ')
scheduled=$(grep -r "test-revizorro: scheduled" test/ src/ 2>/dev/null | wc -l | tr -d ' ')

log ""
log "=== SUMMARY ==="
log "Approved: $approved"
log "Suspect: $suspect"
log "Remaining scheduled: $scheduled"
