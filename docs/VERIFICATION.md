# Huly MCP Server Verification

This document describes how to verify the Huly MCP server works correctly with a real MCP client and Huly instance.

## Prerequisites

1. **Huly Account**: A Huly instance (huly.app or self-hosted) with:
   - Valid credentials (email/password)
   - At least one workspace
   - At least one project with some issues

2. **Node.js**: Version 22+ (for `--experimental-strip-types`)

3. **MCP Client**: One of:
   - Claude Desktop (recommended)
   - MCP Inspector
   - The verification script (included)

## Environment Setup

Set the following environment variables:

```bash
export HULY_URL=https://huly.app
export HULY_EMAIL=your-email@example.com
export HULY_PASSWORD=your-password
export HULY_WORKSPACE=your-workspace-id
```

Optional:
```bash
export HULY_CONNECTION_TIMEOUT=30000  # Connection timeout in ms (default: 30000)
export HULY_PROJECT=YOUR_PROJECT_ID   # For verification script
```

## Verification Methods

### Method 1: Automated Verification Script

The included script tests all 5 MCP tools:

```bash
# Install dependencies
npm install

# Run verification (set HULY_PROJECT to your project identifier)
export HULY_PROJECT=HULY
npx tsx scripts/verify-mcp.ts
```

The script will:
1. Connect to the MCP server
2. Test all 5 tools (list_issues, get_issue, create_issue, update_issue, add_issue_label)
3. Test error cases (invalid params, not found errors)
4. Report pass/fail for each test

**Note**: The script creates a test issue during verification. You may want to delete it afterward.

### Method 2: Claude Desktop

1. **Configure Claude Desktop**

   Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

   ```json
   {
     "mcpServers": {
       "huly": {
         "command": "node",
         "args": ["--experimental-strip-types", "/path/to/hulymcp/src/index.ts"],
         "env": {
           "HULY_URL": "https://huly.app",
           "HULY_EMAIL": "your-email@example.com",
           "HULY_PASSWORD": "your-password",
           "HULY_WORKSPACE": "your-workspace-id"
         }
       }
     }
   }
   ```

2. **Restart Claude Desktop**

3. **Test the tools**

   In Claude Desktop, try:
   - "List issues in project HULY"
   - "Get issue HULY-1"
   - "Create a new issue in project HULY with title 'Test from Claude'"
   - "Update issue HULY-1 to set priority to high"
   - "Add label 'test' to issue HULY-1"

### Method 3: MCP Inspector

1. **Start the server**
   ```bash
   npm start
   ```

2. **Use MCP Inspector**
   ```bash
   npx @anthropic-ai/mcp-inspector
   ```

3. **Connect to the server** via stdio and test tools interactively.

## Expected Tool Behaviors

### list_issues

**Input**:
```json
{
  "project": "HULY",
  "status": "open",
  "limit": 10
}
```

**Output**: Array of issue summaries
```json
[
  {
    "identifier": "HULY-123",
    "title": "Issue title",
    "status": "In Progress",
    "priority": "high",
    "assignee": "John Doe",
    "modifiedOn": 1706540800000
  }
]
```

### get_issue

**Input**:
```json
{
  "project": "HULY",
  "identifier": "HULY-123"
}
```

**Output**: Full issue with markdown description
```json
{
  "identifier": "HULY-123",
  "title": "Issue title",
  "description": "# Description\n\nMarkdown content...",
  "status": "In Progress",
  "priority": "high",
  "assignee": "John Doe",
  "project": "HULY",
  "modifiedOn": 1706540800000,
  "createdOn": 1706500000000
}
```

### create_issue

**Input**:
```json
{
  "project": "HULY",
  "title": "New issue",
  "description": "# Description\n\nMarkdown supported",
  "priority": "medium"
}
```

**Output**:
```json
{
  "identifier": "HULY-124"
}
```

### update_issue

**Input**:
```json
{
  "project": "HULY",
  "identifier": "HULY-123",
  "title": "Updated title",
  "priority": "high"
}
```

**Output**:
```json
{
  "identifier": "HULY-123",
  "updated": true
}
```

### add_issue_label

**Input**:
```json
{
  "project": "HULY",
  "identifier": "HULY-123",
  "label": "bug",
  "color": 1
}
```

**Output**:
```json
{
  "identifier": "HULY-123",
  "labelAdded": true
}
```

## Error Cases

The server returns proper MCP error responses:

### Invalid Parameters (-32602)

When required parameters are missing or invalid:
```json
{
  "isError": true,
  "content": [{"type": "text", "text": "Invalid parameters for list_issues: Required field is missing"}]
}
```

### Not Found (-32602)

When a resource doesn't exist:
```json
{
  "isError": true,
  "content": [{"type": "text", "text": "Project 'INVALID' not found"}]
}
```

```json
{
  "isError": true,
  "content": [{"type": "text", "text": "Issue '9999' not found in project 'HULY'"}]
}
```

### Internal Error (-32603)

Connection or authentication failures:
```json
{
  "isError": true,
  "content": [{"type": "text", "text": "An error occurred while processing the request"}]
}
```

## Verification Checklist

Use this checklist to verify the server works correctly:

### Happy Path Tests

- [ ] `list_issues` returns issues from real Huly instance
- [ ] `list_issues` with status filter returns filtered results
- [ ] `list_issues` with assignee filter works
- [ ] `get_issue` shows markdown description
- [ ] `get_issue` with numeric ID (123) works
- [ ] `get_issue` with full ID (HULY-123) works
- [ ] `create_issue` creates issue (verify in Huly UI)
- [ ] `create_issue` preserves markdown formatting
- [ ] `update_issue` modifies issue fields
- [ ] `update_issue` can update description with markdown
- [ ] `add_issue_label` adds label to issue
- [ ] `add_issue_label` is idempotent (adding same label twice is no-op)

### Error Case Tests

- [ ] Invalid project returns -32602 error
- [ ] Invalid issue ID returns -32602 error
- [ ] Missing required params returns -32602 error
- [ ] Invalid status name returns error
- [ ] Invalid assignee returns error

### Integration Tests

- [ ] Workspace switching works (if configured)
- [ ] Connection stays alive for multiple requests
- [ ] Graceful shutdown on SIGTERM/SIGINT

## Troubleshooting

### Connection Errors

1. Verify HULY_URL is correct
2. Check network connectivity
3. Increase HULY_CONNECTION_TIMEOUT if needed

### Authentication Errors

1. Verify HULY_EMAIL and HULY_PASSWORD are correct
2. Check the account is not locked
3. Verify workspace access

### Tool Errors

1. Check the project identifier exists
2. Verify issue identifiers are correct
3. Check status names match exactly (case-insensitive)

### Debug Mode

For more detailed logging, check stderr output when running the server.

## Known Limitations

1. **TypeScript Type Checking**: The Huly client packages include TypeScript source files that don't compile with strict settings. This causes `npm run typecheck` to show errors from node_modules. Source code (`src/`) has no type errors.

2. **HTTP Transport**: Only stdio transport is implemented. HTTP transport is not yet available.

3. **Workspace Switching**: Per-request workspace switching is not yet implemented. Use the default workspace from HULY_WORKSPACE.
