# Known Problems & Context for Resolution

## 1. Ugly Type Casts in shared.ts

**Location**: `src/huly/operations/shared.ts:78`

**The Cast**:
```typescript
core.class.Status as Ref<Class<Doc>> as Ref<Class<Status>>
```

**Why It Exists**:
- `core.class.Status` is typed as a string constant in Huly SDK
- `client.findAll<Status>()` expects `Ref<Class<Status>>`
- TypeScript can't infer the correct type narrowing
- Double cast is needed to satisfy type checker

**Context for Resolution**:
1. Check `@hcengineering/core` package for proper exported class references
2. Look for alternative ways to reference Status class
3. Possible approaches:
   - Use string literal: `"core:class:Status"` directly
   - Check if Huly SDK exports typed class references
   - File issue with Huly SDK for better type definitions

**Non-blocking**: Code works correctly at runtime, just ugly types.

---

## 2. IssueStatus Query Failure - FIXED

**Status**: RESOLVED via findProjectWithStatuses approach

**Original Problem**: `client.findAll(tracker.class.IssueStatus, {})` failed with:
```
TypeError: Cannot read properties of null (reading '#<Object>')
```

**Root Cause**: IssueStatus documents may have corrupted data on some workspaces, or Huly SDK has deserialization bug.

**Solution Implemented**:
- Use `findProjectWithStatuses()` helper in `shared.ts`
- Fetch Project with `lookup: { type: task.class.ProjectType }`
- ProjectType.statuses contains ProjectStatus array with status refs
- Batch query Status documents via `core.class.Status` with `$in` filter
- Pre-compute `isDone` and `isCanceled` flags based on category

**Changed Operations**:
- `listIssues` - uses findProjectWithStatuses
- `getIssue` - uses findProjectWithStatuses
- `createIssue` - conditionally uses findProjectWithStatuses if status param provided
- `updateIssue` - conditionally uses findProjectWithStatuses if status param provided

**Benefits**:
- Avoids querying IssueStatus class directly
- Matches pattern from official huly-examples
- More efficient (single project lookup with statuses vs separate queries)

---

## 3. Testing Without Blocking

**Status**: RESOLVED

**Problem**: MCP stdio server blocks indefinitely for testing

**Solution**: `MCP_AUTO_EXIT=true` environment variable

**Implementation**:
- `src/index.ts`: Added `getAutoExit` config
- `src/mcp/server.ts`: Conditionally listen for stdin `end`/`close` events
- When `autoExit=true`, server exits when stdin closes
- When `autoExit=false` (default), server runs indefinitely (normal MCP behavior)

**Usage**:
```bash
printf '...' | MCP_AUTO_EXIT=true node dist/index.cjs
```

**Documentation**: See `INTEGRATION_TESTING.md` for full guide

---

## 4. Manual Test Results (2026-02-04)

**Workspace**: internalai @ huly.app.monadical.io

### Working ✅
- `list_projects` - 3 projects
- `list_teamspaces` / `list_documents` / `get_document` / `create_document` / `update_document` / `delete_document`
- `list_persons` / `list_employees` - with emails (N+1 fix working)
- `list_milestones` / `get_milestone` / `create_milestone` / `delete_milestone`
- `list_channels` / `get_channel` (members resolved correctly)
- `list_direct_messages` / `list_channel_messages`
- `list_events` / `list_work_slots`
- `create_issue` (with or without status)
- `add_issue_label` / `delete_issue`
- **`list_issues`** ✅ FIXED
- **`get_issue`** ✅ FIXED
- **`update_issue`** ✅ FIXED

### Notes
- `create_milestone` requires `targetDate` as Unix timestamp (milliseconds)
- All issue operations now work after IssueStatus fix

---

## 5. Potential Future Improvements

### A. Simplify Status Type Cast
**Where**: `src/huly/operations/shared.ts:78`
**Action**: Research Huly SDK for cleaner Status class reference

### B. Add Integration Tests
**Where**: Currently manual only
**Action**: Add automated integration test suite that runs against test workspace

### C. Error Messages
**Where**: Various operations
**Action**: Review error messages for clarity, ensure they provide actionable info

### D. Performance Monitoring
**Where**: N/A currently
**Action**: Add optional performance logging for slow operations

---

## 6. Type Safety Notes

Per `CLAUDE.md` type cast policy:
- Type casts (`as T`) are considered a "sin"
- Must be clearly justified with comments
- Document evidence/API docs supporting the cast

**Current justified cast**: `shared.ts:78` - documented above, needed due to Huly SDK type limitations.
