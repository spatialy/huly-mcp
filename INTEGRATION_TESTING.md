# Integration Testing Guide

## Prerequisites

```bash
pnpm build
```

## Environment Variables

```bash
export HULY_URL=https://your-huly-instance.com/
export HULY_EMAIL=your-email@example.com
export HULY_PASSWORD=your-password
export HULY_WORKSPACE=your-workspace
export MCP_AUTO_EXIT=true  # For testing - exits when stdin closes
```

## Quick Smoke Test

```bash
printf '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_projects","arguments":{}},"id":2}
' | MCP_AUTO_EXIT=true node dist/index.cjs 2>&1 | grep '"id":2'
```

Expected: JSON with `"projects": [...]`

**Note**: `MCP_AUTO_EXIT=true` makes the server exit when stdin closes (for testing only).

## Full Test Suite

Run all operations in one batch:

```bash
printf '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_projects","arguments":{}},"id":2}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_issues","arguments":{"project":"YOUR_PROJECT","limit":2}},"id":3}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_teamspaces","arguments":{}},"id":4}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_persons","arguments":{"limit":3}},"id":5}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_channels","arguments":{}},"id":6}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_milestones","arguments":{"project":"YOUR_PROJECT"}},"id":7}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_events","arguments":{"limit":3}},"id":8}
' | MCP_AUTO_EXIT=true node dist/index.cjs 2>&1 | grep -E '"id":[2-8]'
```

## Individual Operation Tests

### Projects & Issues

```bash
# List projects
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_projects","arguments":{}},"id":2}\n' | node dist/index.cjs

# List issues (replace PROJECT with actual identifier)
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_issues","arguments":{"project":"PROJECT","limit":5}},"id":2}\n' | node dist/index.cjs

# Create issue
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"create_issue","arguments":{"project":"PROJECT","title":"Test Issue"}},"id":2}\n' | node dist/index.cjs

# Get issue
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_issue","arguments":{"project":"PROJECT","identifier":"1"}},"id":2}\n' | node dist/index.cjs

# Delete issue
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"delete_issue","arguments":{"project":"PROJECT","identifier":"123"}},"id":2}\n' | node dist/index.cjs
```

### Documents

```bash
# List teamspaces
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_teamspaces","arguments":{}},"id":2}\n' | node dist/index.cjs

# List documents
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_documents","arguments":{"teamspace":"TEAMSPACE_NAME"}},"id":2}\n' | node dist/index.cjs

# Create document
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"create_document","arguments":{"teamspace":"TEAMSPACE_NAME","title":"Test Doc","content":"# Hello"}},"id":2}\n' | node dist/index.cjs
```

### Contacts

```bash
# List persons (tests N+1 batch fix)
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_persons","arguments":{"limit":5}},"id":2}\n' | node dist/index.cjs

# List employees
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_employees","arguments":{"limit":5}},"id":2}\n' | node dist/index.cjs
```

### Channels

```bash
# List channels
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_channels","arguments":{}},"id":2}\n' | node dist/index.cjs

# Get channel (tests member name resolution)
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_channel","arguments":{"channel":"general"}},"id":2}\n' | node dist/index.cjs

# List messages
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_channel_messages","arguments":{"channel":"general","limit":5}},"id":2}\n' | node dist/index.cjs
```

### Milestones

```bash
# List milestones
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_milestones","arguments":{"project":"PROJECT"}},"id":2}\n' | node dist/index.cjs

# Create milestone (targetDate is Unix timestamp in ms)
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"create_milestone","arguments":{"project":"PROJECT","label":"Test","targetDate":1772467200000}},"id":2}\n' | node dist/index.cjs
```

### Calendar & Time

```bash
# List events
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_events","arguments":{"limit":5}},"id":2}\n' | node dist/index.cjs

# List work slots
printf '..initialize..\n{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_work_slots","arguments":{"limit":5}},"id":2}\n' | node dist/index.cjs
```

## Initialize Payload

For brevity, `..initialize..` in examples above means:

```json
{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}
```

## How It Works

When `MCP_AUTO_EXIT=true`, the server exits when stdin closes (when printf finishes). Without this flag, the server runs indefinitely (normal MCP behavior for production use with clients like Claude Desktop).

For testing, set `MCP_AUTO_EXIT=true` either in environment or inline with each command.

## Checking Results

Filter for specific response:
```bash
... | grep '"id":2'
```

Check for errors:
```bash
... | grep '"isError":true'
```

Pretty print JSON:
```bash
... | grep '"id":2' | jq -r '.result.content[0].text' | jq .
```
