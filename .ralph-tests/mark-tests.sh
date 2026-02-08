#!/usr/bin/env bash
# Phase 1: Mark all test cases with // test-revizorro: scheduled
# Uses node for reliable multi-line parsing instead of sed/awk
set -euo pipefail

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

TEST_LIST=".ralph-tests/test-files.txt"

if [ ! -f "$TEST_LIST" ]; then
    log "ERROR: $TEST_LIST not found. Run setup.sh first."
    exit 1
fi

log "Starting Phase 1: marking test cases..."

node -e '
const fs = require("fs");
const testFiles = fs.readFileSync(".ralph-tests/test-files.txt", "utf-8").trim().split("\n");
let totalMarked = 0;

for (const file of testFiles) {
  const content = fs.readFileSync(file, "utf-8");
  const lines = content.split("\n");
  const result = [];
  let fileMarked = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Match it(, it.effect(, test( but NOT .skip( or .todo(
    const isTestCase = /^(it|it\.effect|test)\s*\(/.test(trimmed)
      || /^(it|it\.effect|test)\s*\.each/.test(trimmed);
    const isDisabled = /\.(skip|todo)\s*\(/.test(trimmed);

    if (isTestCase && !isDisabled) {
      // Check if previous line already has marker
      const prevLine = result.length > 0 ? result[result.length - 1].trimStart() : "";
      if (!prevLine.includes("test-revizorro:")) {
        // Get indentation from the test line
        const indent = line.match(/^(\s*)/)[1];
        result.push(indent + "// test-revizorro: scheduled");
        fileMarked++;
      }
    }

    result.push(line);
  }

  if (fileMarked > 0) {
    fs.writeFileSync(file, result.join("\n"));
    console.log("MARKED: " + fileMarked + " tests in " + file);
    totalMarked += fileMarked;
  }
}

console.log("\nTotal: " + totalMarked + " test cases marked across " + testFiles.length + " files");
'

log "Phase 1 marking complete"
