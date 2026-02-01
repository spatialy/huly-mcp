# HULY MCP SERVER - IMPLEMENTATION TASKS

## PROJECT CONTEXT

Building an MCP server exposing Huly issue tracking to AI assistants. Effect-based architecture wrapping @hcengineering/api-client. Must be type-safe, composable, with proper error handling.

**Key Constraints**:
- Effect patterns throughout (consult effect-solutions before implementing)
- No `any` types in src/
- Schema-based validation (@effect/schema)
- Tagged error hierarchy
- Service/Layer dependency injection
- Reference Huly examples in `.reference/huly-examples/platform-api/examples/`

**Success**: 5 MCP tools (list, get, create, update, add_label) functional with type safety and proper error handling.

---

## TASK 1: TYPE-SAFE ERROR FOUNDATION

**Problem**: Need tagged error types that compose in Effect and map cleanly to MCP error codes.

**Context**:
- MCP uses error codes: -32602 (invalid params), -32603 (internal)
- Effect errors use Schema.TaggedError for pattern matching
- PRD defines hierarchy: HulyError → HulyConnectionError, HulyAuthError, IssueNotFoundError, ProjectNotFoundError, InvalidStatusError

**What Success Looks Like**:
- Error classes constructed with relevant data (e.g., IssueNotFoundError has identifier + project)
- Can pattern match on error type in Effect code
- Clear mapping to MCP error codes exists
- Errors carry enough context for helpful messages

**Integration Points**:
- Domain operations will throw these
- MCP layer will catch and transform to MCP error format
- Connection layer will throw HulyConnectionError/HulyAuthError

**Reference**: PRD lines 353-391 for error hierarchy

---

## TASK 2: CONFIGURATION WITH VALIDATION

**Problem**: Load connection params from env vars / config file with validation and sensible defaults.

**Context**:
- Need: url, email, password, workspace, connectionTimeout
- Credentials only from env vars (security)
- Non-sensitive config can come from .hulyrc.json
- Effect Schema provides validation + type extraction
- Config feeds HulyClient service

**What Success Looks Like**:
- Invalid config (missing url, negative timeout) rejected at startup
- Type-safe access to config values
- Env vars override file config
- Clear error messages for config issues
- Default connectionTimeout if not provided

**Integration Points**:
- HulyClient Layer requires this as dependency
- Main entry point loads config early

**Reference**: PRD lines 298-310 for schema structure, lines 499-527 for config sources

---

## TASK 3: HULY CLIENT SERVICE

**Problem**: Authenticated connection to Huly platform exposed as Effect service with lifecycle management.

**Context**:
- Wraps @hcengineering/api-client's connect()
- Connection is expensive - should be lazy and cached
- Need graceful shutdown (close on SIGTERM/SIGINT)
- Connection can fail (network, auth) - need retry policies
- Service provides: findAll, findOne, createDoc, updateDoc, addCollection, uploadMarkup, fetchMarkup

**What Success Looks Like**:
- First operation triggers connection, subsequent reuse it
- Connection failures become HulyConnectionError
- Auth failures become HulyAuthError
- Server shutdown closes connection cleanly
- Reconnection on connection loss
- Other services access via Context.Tag

**Integration Points**:
- Domain operations depend on this service
- Main entry point provides this Layer
- Config service is dependency

**Reference**:
- PRD lines 87-91 for service responsibilities
- `.reference/huly-examples/platform-api/examples/issue-list.ts:1-20` for connection pattern
- Consult `effect-solutions show services-and-layers`

---

## TASK 4: DOMAIN TYPE SCHEMAS

**Problem**: Type-safe representations of Huly domain objects (issues, projects, people) with validation.

**Context**:
- Issues have: identifier, title, description (markdown), status, priority, assignee, modifiedOn
- Priority is enum-like: urgent, high, medium, low
- Need both full Issue and IssueSummary (for list operations)
- Schemas enable parsing API responses and validating tool inputs
- Effect Schema provides type extraction: `Schema.Schema.Type<typeof IssueSchema>`

**What Success Looks Like**:
- Can parse Huly API responses into typed objects
- Can validate MCP tool parameters
- Types catch invalid data at boundaries
- JSON Schema generation works (for MCP tool definitions)

**Integration Points**:
- Domain operations return these types
- MCP tools use these for parameter validation
- Transform layer between Huly API and MCP responses

**Reference**:
- PRD lines 299-351 for schema examples
- `.reference/huly-examples/` for real Huly data shapes

---

## TASK 5: LIST ISSUES OPERATION

**Problem**: Query issues with filters, return summaries sorted by modification date.

**Context**:
- Filters: project (required), status (open/done/canceled/specific), assignee (email or name), milestone, limit (max 200)
- Status filter needs interpretation: "open" = not done/canceled, "done" = project's done statuses
- Assignee needs person lookup (by email or name)
- Return IssueSummary (lighter than full Issue)
- Depends on HulyClient service

**What Success Looks Like**:
- Correct issues returned for filter combinations
- Status filter logic handles "open"/"done"/"canceled" and specific status names
- Assignee resolution works for email and name
- Results sorted modifiedOn descending
- Limit enforced
- ProjectNotFoundError if project doesn't exist
- InvalidStatusError if status name invalid

**Integration Points**:
- MCP tool list_issues calls this
- Requires HulyClient from Context
- Uses domain schemas for types

**Reference**:
- PRD lines 238-247 for tool spec
- `.reference/huly-examples/platform-api/examples/issue-list.ts` for query pattern
- PRD lines 148-162 for findAll pattern

---

## TASK 6: GET ISSUE OPERATION

**Problem**: Retrieve full issue details including rendered markdown description.

**Context**:
- Input: project + identifier (can be "HULY-123" or just 123)
- Need to lookup assignee, milestone (populate relations)
- Description is stored as markup ID - must fetch markdown via fetchMarkup
- Single issue or IssueNotFoundError

**What Success Looks Like**:
- Both "HULY-123" and 123 identifiers work
- Description returned as readable markdown
- Assignee/milestone data included (not just IDs)
- IssueNotFoundError with helpful message if not found

**Integration Points**:
- MCP tool get_issue calls this
- Uses fetchMarkup from HulyClient
- Returns full Issue schema

**Reference**:
- PRD lines 249-255 for tool spec
- PRD lines 225-234 for fetchMarkup pattern
- `.reference/huly-examples/platform-api/examples/issue-*.ts` for lookup pattern

---

## TASK 7: CREATE ISSUE OPERATION

**Problem**: Create new issue with markdown description and metadata, return identifier.

**Context**:
- Inputs: project, title, description (markdown), priority, assignee (email/name), status, milestone
- Description must be uploaded via uploadMarkup before creating issue
- Need to generate issue ID upfront
- Assignee resolution (email or name → person ref)
- Status resolution (default or specific → status ref)
- Priority mapping (lowercase string → IssuePriority enum)
- Rank calculation (append to end via makeRank)

**What Success Looks Like**:
- Issue created with all provided metadata
- Markdown description preserved
- Returns issue identifier (e.g., "HULY-123")
- Assignee email or name both work
- Default status used if not specified
- ProjectNotFoundError, InvalidStatusError, PersonNotFoundError as appropriate

**Integration Points**:
- MCP tool create_issue calls this
- Uses uploadMarkup, createDoc from HulyClient
- Uses @hcengineering/rank's makeRank

**Reference**:
- PRD lines 257-268 for tool spec
- PRD lines 165-192 for create pattern
- `.reference/huly-examples/platform-api/examples/issue-create.ts` for full example

---

## TASK 8: UPDATE ISSUE OPERATION

**Problem**: Modify existing issue fields (partial updates).

**Context**:
- Find issue by identifier (string or numeric)
- Update only provided fields (title, description, status, priority, assignee, milestone)
- Description updates need uploadMarkup
- Null values mean unassign/remove
- Status/assignee/milestone need resolution (name → ref)

**What Success Looks Like**:
- Only specified fields change
- Markdown description updates work
- Can unassign (assignee: null) or remove milestone
- IssueNotFoundError if issue doesn't exist
- InvalidStatusError if new status invalid

**Integration Points**:
- MCP tool update_issue calls this
- Uses uploadMarkup, updateDoc from HulyClient
- Combines get (find issue) + update

**Reference**:
- PRD lines 270-282 for tool spec
- PRD lines 194-206 for update pattern
- `.reference/huly-examples/platform-api/examples/issue-update.ts`

---

## TASK 9: ADD LABEL OPERATION

**Problem**: Attach tag/label to issue, creating tag if needed.

**Context**:
- Tags are project-scoped
- Need to find or create TagElement in project
- Attach via addCollection (creates TagReference)
- Color code 0-9

**What Success Looks Like**:
- Label attached to issue
- Tag created in project if doesn't exist
- Idempotent (adding same label twice is fine)
- IssueNotFoundError if issue doesn't exist

**Integration Points**:
- MCP tool add_issue_label calls this
- Uses addCollection from HulyClient
- Needs @hcengineering/tags types

**Reference**:
- PRD lines 284-292 for tool spec
- PRD lines 208-222 for label pattern
- `.reference/huly-examples/platform-api/examples/issue-labels.ts`

---

## TASK 10: MCP SERVER INFRASTRUCTURE

**Problem**: MCP server that registers tools and handles requests via stdio/HTTP transport.

**Context**:
- Use @modelcontextprotocol/sdk
- Server exposes 5 tools with JSON Schema definitions
- ListToolsRequestSchema → return tool definitions
- CallToolRequestSchema → route to appropriate handler
- Transport options: stdio (default), HTTP (optional)
- Graceful shutdown

**What Success Looks Like**:
- Server starts and accepts MCP requests
- Tool definitions include correct JSON Schema (from Effect schemas)
- Tool calls route to domain operations
- Stdio transport works (can connect MCP client)
- HTTP transport works if MCP_TRANSPORT=http
- Clean shutdown on signals

**Integration Points**:
- Wraps domain operations (tasks 5-9)
- Provides HulyClient Layer to operations
- Entry point initializes this

**Reference**:
- PRD lines 599-624 for MCP server setup
- PRD lines 236-292 for tool definitions
- PRD lines 336-342 for JSON Schema generation

---

## TASK 11: ERROR MAPPING TO MCP

**Problem**: Transform Effect errors into MCP protocol error responses.

**Context**:
- MCP error codes: -32600, -32601, -32602 (invalid params), -32603 (internal)
- Effect errors are tagged - can pattern match
- Need helpful messages for users/AI
- Security: don't leak sensitive info in errors

**What Success Looks Like**:
- ParseError, InvalidStatusError → -32602 with clear message
- IssueNotFoundError, ProjectNotFoundError → -32602 with "Issue X not found in project Y"
- HulyConnectionError, HulyAuthError → -32603 with sanitized message
- Unknown errors → -32603 with generic message
- No stack traces or sensitive data leaked

**Integration Points**:
- MCP server CallToolRequestSchema handler uses this
- Wraps domain operation execution

**Reference**: PRD lines 393-401 for error mapping

---

## TASK 12: MAIN ENTRY POINT

**Problem**: CLI that loads config, builds Layer stack, starts server.

**Context**:
- Parse config (env vars + .hulyrc.json)
- Build Effect Layer stack: Config → HulyClient → Server
- Start transport (stdio or HTTP based on env)
- Handle signals (SIGTERM/SIGINT) for graceful shutdown
- Effect runtime setup

**What Success Looks Like**:
- `npm start` runs server
- Config errors reported clearly
- Connection happens on first request (lazy)
- Server runs indefinitely until signal
- Clean shutdown closes Huly connection
- MCP client can connect and call tools

**Integration Points**:
- Top-level orchestrator
- Provides all layers to server
- Entry point in package.json

**Reference**:
- PRD lines 99-127 for architecture
- Consult `effect-solutions show project-setup cli`

---

## TASK 13: VERIFICATION

**Problem**: Confirm all 5 tools work end-to-end with real MCP client.

**Context**:
- Can't claim done without actual testing
- Need MCP client (Claude Desktop or similar)
- Must test: list, get, create, update, add_label
- Test error cases (invalid params, not found)
- Test workspace switching
- Verify markdown preservation

**What Success Looks Like**:
- Connect MCP client to server
- list_issues returns issues from real Huly instance
- get_issue shows markdown description
- create_issue creates issue (verify in Huly UI)
- update_issue modifies issue
- add_issue_label adds label
- Invalid params return -32602 errors
- Missing issues return not found errors

**Blockers**:
- Need test Huly instance (or use huly.app)
- Need MCP client setup

---

## UNRESOLVED QUESTIONS

Before starting:
1. Do we have access to test Huly instance? Or should we use huly.app?
2. What MCP client should we use for verification? (Claude Desktop, custom)
3. Should integration tests mock HulyClient or hit real Huly instance?
4. Package name for npm? Entry point name for CLI?
5. Should we support MCP resources (read-only) or just tools?

---

## DEPENDENCY RELATIONSHIPS

**Foundation** (can start immediately):
- Task 1 (Errors)
- Task 2 (Config)
- Task 4 (Schemas)

**Client Layer** (needs foundation):
- Task 3 (HulyClient) - needs Tasks 1, 2

**Domain Operations** (needs client + schemas):
- Task 5 (List) - needs Tasks 3, 4
- Task 6 (Get) - needs Tasks 3, 4
- Task 7 (Create) - needs Tasks 3, 4
- Task 8 (Update) - needs Tasks 3, 4, 6
- Task 9 (Label) - needs Tasks 3, 4

**Server Layer** (needs operations):
- Task 10 (MCP Server) - needs Tasks 1, 4, 5-9
- Task 11 (Error Mapping) - needs Tasks 1, 10

**Final Integration**:
- Task 12 (Entry Point) - needs Tasks 2, 3, 10, 11
- Task 13 (Verification) - needs Task 12

**Can work in parallel**:
- Tasks 1, 2, 4 (foundation)
- Tasks 5, 6, 7, 9 (domain ops after foundation)
- Tasks 10, 11 (server layer)
