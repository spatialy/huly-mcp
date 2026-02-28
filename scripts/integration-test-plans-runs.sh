#!/bin/bash
set -euo pipefail

# Integration test for Test Plans & Test Runs (Phase 2)
# Requires: source .env.local before running

export MCP_AUTO_EXIT=true

INIT='{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
PASS=0
FAIL=0

call_tool() {
  local name="$1"
  local args="$2"
  local id="${3:-2}"
  local result
  result=$({ printf '%s\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"%s","arguments":%s},"id":%s}\n' "$INIT" "$name" "$args" "$id"; sleep 8; } | node dist/index.cjs 2>/dev/null | grep "\"id\":$id")
  echo "$result"
}

extract() {
  local json="$1"
  local field="$2"
  echo "$json" | jq -r ".result.content[0].text | fromjson | $field"
}

check() {
  local label="$1"
  local result="$2"
  local field="$3"
  local expected="$4"
  local actual
  actual=$(extract "$result" "$field")
  if [ "$actual" = "$expected" ]; then
    echo "  PASS: $label ($field=$actual)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label (expected $field=$expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

check_not_empty() {
  local label="$1"
  local result="$2"
  local field="$3"
  local actual
  actual=$(extract "$result" "$field")
  if [ -n "$actual" ] && [ "$actual" != "null" ]; then
    echo "  PASS: $label ($field=$actual)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label ($field is empty or null)"
    FAIL=$((FAIL + 1))
  fi
}

check_no_error() {
  local label="$1"
  local result="$2"
  if echo "$result" | jq -e '.result.content[0]' >/dev/null 2>&1; then
    local is_error
    is_error=$(echo "$result" | jq -r '.result.isError // false')
    if [ "$is_error" = "true" ]; then
      echo "  FAIL: $label (isError=true)"
      echo "    $(echo "$result" | jq -r '.result.content[0].text' | head -1)"
      FAIL=$((FAIL + 1))
      return 1
    else
      echo "  PASS: $label"
      PASS=$((PASS + 1))
      return 0
    fi
  else
    echo "  FAIL: $label (no response)"
    FAIL=$((FAIL + 1))
    return 1
  fi
}

echo "=== Phase 2 Integration Tests: Test Plans & Test Runs ==="
echo ""

# --- Setup: create suite + test cases ---
echo "--- Setup: Creating suite and test cases ---"

echo "0. create_test_suite"
R=$(call_tool "create_test_suite" '{"project":"QA","name":"Login Tests"}')
check_no_error "create_test_suite (Login Tests)" "$R"

R=$(call_tool "create_test_case" '{"project":"QA","suite":"Login Tests","name":"Valid login","type":"functional","priority":"high","status":"approved"}')
if check_no_error "create_test_case (Valid login)" "$R"; then
  TC1_ID=$(extract "$R" ".id")
  echo "    TC1=$TC1_ID"
fi

R=$(call_tool "create_test_case" '{"project":"QA","suite":"Login Tests","name":"Invalid password","type":"security","priority":"medium","status":"draft"}')
if check_no_error "create_test_case (Invalid password)" "$R"; then
  TC2_ID=$(extract "$R" ".id")
  echo "    TC2=$TC2_ID"
fi

echo ""

# --- Test Plan CRUD ---
echo "--- Test Plan Tools ---"

echo "1. create_test_plan"
R=$(call_tool "create_test_plan" '{"project":"QA","name":"Sprint 1 Regression","description":"Regression tests for sprint 1"}')
check_no_error "create_test_plan" "$R"
PLAN_ID=$(extract "$R" ".id")
check "plan name" "$R" ".name" "Sprint 1 Regression"
echo "    PLAN_ID=$PLAN_ID"

echo "2. list_test_plans"
R=$(call_tool "list_test_plans" '{"project":"QA"}')
check_no_error "list_test_plans" "$R"
PLAN_COUNT=$(extract "$R" ".plans | length")
echo "    plans count=$PLAN_COUNT"

echo "3. get_test_plan"
R=$(call_tool "get_test_plan" '{"project":"QA","plan":"Sprint 1 Regression"}')
check_no_error "get_test_plan" "$R"
check "plan name" "$R" ".name" "Sprint 1 Regression"

echo "4. update_test_plan"
R=$(call_tool "update_test_plan" '{"project":"QA","plan":"Sprint 1 Regression","name":"Sprint 1 Full Regression"}')
check_no_error "update_test_plan" "$R"
check "updated" "$R" ".updated" "true"

echo "5. add_test_plan_item (TC1)"
R=$(call_tool "add_test_plan_item" "{\"project\":\"QA\",\"plan\":\"Sprint 1 Full Regression\",\"testCase\":\"$TC1_ID\"}")
check_no_error "add_test_plan_item (TC1)" "$R"
ITEM1_ID=$(extract "$R" ".id")
echo "    ITEM1_ID=$ITEM1_ID"

echo "6. add_test_plan_item (TC2)"
R=$(call_tool "add_test_plan_item" "{\"project\":\"QA\",\"plan\":\"Sprint 1 Full Regression\",\"testCase\":\"$TC2_ID\"}")
check_no_error "add_test_plan_item (TC2)" "$R"
ITEM2_ID=$(extract "$R" ".id")
echo "    ITEM2_ID=$ITEM2_ID"

echo "7. get_test_plan (verify items)"
R=$(call_tool "get_test_plan" '{"project":"QA","plan":"Sprint 1 Full Regression"}')
check_no_error "get_test_plan (with items)" "$R"
ITEM_COUNT=$(extract "$R" ".items | length")
echo "    items count=$ITEM_COUNT"

echo "8. remove_test_plan_item"
R=$(call_tool "remove_test_plan_item" "{\"project\":\"QA\",\"plan\":\"Sprint 1 Full Regression\",\"item\":\"$ITEM2_ID\"}")
check_no_error "remove_test_plan_item" "$R"
check "removed" "$R" ".removed" "true"

echo ""

# --- Test Run CRUD ---
echo "--- Test Run Tools ---"

echo "9. create_test_run"
R=$(call_tool "create_test_run" '{"project":"QA","name":"Manual Run 1","description":"Manual test execution"}')
check_no_error "create_test_run" "$R"
RUN_ID=$(extract "$R" ".id")
check "run name" "$R" ".name" "Manual Run 1"
echo "    RUN_ID=$RUN_ID"

echo "10. list_test_runs"
R=$(call_tool "list_test_runs" '{"project":"QA"}')
check_no_error "list_test_runs" "$R"

echo "11. get_test_run"
R=$(call_tool "get_test_run" '{"project":"QA","run":"Manual Run 1"}')
check_no_error "get_test_run" "$R"
check "run name" "$R" ".name" "Manual Run 1"

echo "12. update_test_run"
R=$(call_tool "update_test_run" '{"project":"QA","run":"Manual Run 1","name":"Manual Run v1"}')
check_no_error "update_test_run" "$R"
check "updated" "$R" ".updated" "true"

echo ""

# --- Test Result CRUD ---
echo "--- Test Result Tools ---"

echo "13. create_test_result"
R=$(call_tool "create_test_result" "{\"project\":\"QA\",\"run\":\"Manual Run v1\",\"testCase\":\"$TC1_ID\",\"status\":\"passed\"}")
check_no_error "create_test_result" "$R"
RESULT_ID=$(extract "$R" ".id")
echo "    RESULT_ID=$RESULT_ID"

echo "14. list_test_results"
R=$(call_tool "list_test_results" '{"project":"QA","run":"Manual Run v1"}')
check_no_error "list_test_results" "$R"

echo "15. get_test_result (by ID)"
R=$(call_tool "get_test_result" "{\"project\":\"QA\",\"run\":\"Manual Run v1\",\"result\":\"$RESULT_ID\"}")
check_no_error "get_test_result" "$R"
check "result status" "$R" ".status" "passed"

echo "16. update_test_result"
R=$(call_tool "update_test_result" "{\"project\":\"QA\",\"run\":\"Manual Run v1\",\"result\":\"$RESULT_ID\",\"status\":\"failed\"}")
check_no_error "update_test_result" "$R"
check "updated" "$R" ".updated" "true"

echo ""

# --- Compound: run_test_plan ---
echo "--- Compound Tool ---"

echo "17. run_test_plan"
R=$(call_tool "run_test_plan" '{"project":"QA","plan":"Sprint 1 Full Regression","name":"Auto Run from Plan"}')
check_no_error "run_test_plan" "$R"
AUTO_RUN_ID=$(extract "$R" ".runId")
RESULT_COUNT=$(extract "$R" ".resultCount")
echo "    runId=$AUTO_RUN_ID, resultCount=$RESULT_COUNT"

echo "18. list_test_results (auto run)"
R=$(call_tool "list_test_results" '{"project":"QA","run":"Auto Run from Plan"}')
check_no_error "list_test_results (auto run)" "$R"
AUTO_RESULTS=$(extract "$R" ".results | length")
echo "    results in auto run=$AUTO_RESULTS"

echo ""

# --- Cleanup ---
echo "--- Cleanup ---"

echo "Deleting auto run..."
R=$(call_tool "delete_test_run" '{"project":"QA","run":"Auto Run from Plan"}')
check_no_error "delete auto run" "$R"

echo "Deleting manual run..."
R=$(call_tool "delete_test_run" '{"project":"QA","run":"Manual Run v1"}')
check_no_error "delete manual run" "$R"

echo "Deleting test plan..."
R=$(call_tool "delete_test_plan" '{"project":"QA","plan":"Sprint 1 Full Regression"}')
check_no_error "delete test plan" "$R"

echo "Deleting test cases..."
R=$(call_tool "delete_test_case" "{\"project\":\"QA\",\"testCase\":\"$TC1_ID\"}")
check_no_error "delete TC1" "$R"

R=$(call_tool "delete_test_case" "{\"project\":\"QA\",\"testCase\":\"$TC2_ID\"}")
check_no_error "delete TC2" "$R"

echo "Deleting test suite..."
R=$(call_tool "delete_test_suite" '{"project":"QA","suite":"Login Tests"}')
check_no_error "delete suite" "$R"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
