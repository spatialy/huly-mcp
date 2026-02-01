#!/usr/bin/env node
/**
 * Manual verification script for Huly MCP server.
 *
 * Tests all 5 MCP tools against a real Huly instance.
 * Requires environment variables to be set.
 *
 * Usage:
 *   # Set environment variables first
 *   export HULY_URL=https://huly.app
 *   export HULY_EMAIL=your-email@example.com
 *   export HULY_PASSWORD=your-password
 *   export HULY_WORKSPACE=your-workspace
 *
 *   # Run verification
 *   npx tsx scripts/verify-mcp.ts
 *
 * @module
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { spawn } from "child_process"

// --- Types ---

interface TestResult {
  name: string
  passed: boolean
  error?: string
  result?: unknown
}

interface TestContext {
  client: Client
  project: string
  createdIssueId?: string
}

// --- Color Helpers ---

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
}

const log = {
  info: (msg: string) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  dim: (msg: string) => console.log(`${colors.dim}${msg}${colors.reset}`),
}

// --- Test Functions ---

async function testListIssues(ctx: TestContext): Promise<TestResult> {
  const name = "list_issues"
  try {
    const result = await ctx.client.callTool({
      name: "list_issues",
      arguments: {
        project: ctx.project,
        limit: 5,
      },
    })

    if (result.isError) {
      return { name, passed: false, error: JSON.stringify(result.content) }
    }

    const content = result.content[0]
    if (content.type !== "text") {
      return { name, passed: false, error: "Expected text content" }
    }

    const issues = JSON.parse(content.text)
    if (!Array.isArray(issues)) {
      return { name, passed: false, error: "Expected array of issues" }
    }

    log.dim(`  Found ${issues.length} issues`)
    return { name, passed: true, result: { count: issues.length } }
  } catch (e) {
    return { name, passed: false, error: String(e) }
  }
}

async function testListIssuesWithStatus(ctx: TestContext): Promise<TestResult> {
  const name = "list_issues (status=open)"
  try {
    const result = await ctx.client.callTool({
      name: "list_issues",
      arguments: {
        project: ctx.project,
        status: "open",
        limit: 3,
      },
    })

    if (result.isError) {
      return { name, passed: false, error: JSON.stringify(result.content) }
    }

    const content = result.content[0]
    if (content.type !== "text") {
      return { name, passed: false, error: "Expected text content" }
    }

    const issues = JSON.parse(content.text)
    log.dim(`  Found ${issues.length} open issues`)
    return { name, passed: true, result: { count: issues.length } }
  } catch (e) {
    return { name, passed: false, error: String(e) }
  }
}

async function testGetIssue(ctx: TestContext): Promise<TestResult> {
  const name = "get_issue"
  try {
    // First get an issue to work with
    const listResult = await ctx.client.callTool({
      name: "list_issues",
      arguments: {
        project: ctx.project,
        limit: 1,
      },
    })

    if (listResult.isError) {
      return { name, passed: false, error: "Could not list issues first" }
    }

    const listContent = listResult.content[0]
    if (listContent.type !== "text") {
      return { name, passed: false, error: "Expected text content" }
    }

    const issues = JSON.parse(listContent.text)
    if (issues.length === 0) {
      log.warn("  No issues found, skipping get_issue test")
      return { name, passed: true, result: { skipped: true } }
    }

    const issueId = issues[0].identifier
    log.dim(`  Getting issue: ${issueId}`)

    const result = await ctx.client.callTool({
      name: "get_issue",
      arguments: {
        project: ctx.project,
        identifier: issueId,
      },
    })

    if (result.isError) {
      return { name, passed: false, error: JSON.stringify(result.content) }
    }

    const content = result.content[0]
    if (content.type !== "text") {
      return { name, passed: false, error: "Expected text content" }
    }

    const issue = JSON.parse(content.text)
    if (!issue.identifier || !issue.title) {
      return { name, passed: false, error: "Missing required fields" }
    }

    log.dim(`  Title: ${issue.title}`)
    log.dim(`  Description length: ${issue.description?.length ?? 0} chars`)

    return { name, passed: true, result: { identifier: issue.identifier } }
  } catch (e) {
    return { name, passed: false, error: String(e) }
  }
}

async function testCreateIssue(ctx: TestContext): Promise<TestResult> {
  const name = "create_issue"
  try {
    const timestamp = new Date().toISOString()
    const result = await ctx.client.callTool({
      name: "create_issue",
      arguments: {
        project: ctx.project,
        title: `[MCP Verification] Test issue ${timestamp}`,
        description: `# Test Issue\n\nCreated by MCP verification script at ${timestamp}.\n\n## Markdown Test\n\n- Item 1\n- Item 2\n- **Bold** and *italic*\n\n\`\`\`js\nconsole.log("Hello from MCP!")\n\`\`\``,
        priority: "low",
      },
    })

    if (result.isError) {
      return { name, passed: false, error: JSON.stringify(result.content) }
    }

    const content = result.content[0]
    if (content.type !== "text") {
      return { name, passed: false, error: "Expected text content" }
    }

    const created = JSON.parse(content.text)
    if (!created.identifier) {
      return { name, passed: false, error: "No identifier returned" }
    }

    ctx.createdIssueId = created.identifier
    log.dim(`  Created issue: ${created.identifier}`)

    return { name, passed: true, result: { identifier: created.identifier } }
  } catch (e) {
    return { name, passed: false, error: String(e) }
  }
}

async function testUpdateIssue(ctx: TestContext): Promise<TestResult> {
  const name = "update_issue"
  try {
    if (!ctx.createdIssueId) {
      return { name, passed: false, error: "No issue created to update" }
    }

    const result = await ctx.client.callTool({
      name: "update_issue",
      arguments: {
        project: ctx.project,
        identifier: ctx.createdIssueId,
        title: `[MCP Verification] Updated test issue`,
        priority: "medium",
      },
    })

    if (result.isError) {
      return { name, passed: false, error: JSON.stringify(result.content) }
    }

    const content = result.content[0]
    if (content.type !== "text") {
      return { name, passed: false, error: "Expected text content" }
    }

    const updated = JSON.parse(content.text)
    log.dim(`  Updated: ${updated.identifier}, success: ${updated.updated}`)

    return { name, passed: true, result: updated }
  } catch (e) {
    return { name, passed: false, error: String(e) }
  }
}

async function testAddLabel(ctx: TestContext): Promise<TestResult> {
  const name = "add_issue_label"
  try {
    if (!ctx.createdIssueId) {
      return { name, passed: false, error: "No issue created to label" }
    }

    const result = await ctx.client.callTool({
      name: "add_issue_label",
      arguments: {
        project: ctx.project,
        identifier: ctx.createdIssueId,
        label: "mcp-test",
        color: 3,
      },
    })

    if (result.isError) {
      return { name, passed: false, error: JSON.stringify(result.content) }
    }

    const content = result.content[0]
    if (content.type !== "text") {
      return { name, passed: false, error: "Expected text content" }
    }

    const labeled = JSON.parse(content.text)
    log.dim(`  Label added: ${labeled.labelAdded}`)

    return { name, passed: true, result: labeled }
  } catch (e) {
    return { name, passed: false, error: String(e) }
  }
}

async function testErrorNotFoundProject(ctx: TestContext): Promise<TestResult> {
  const name = "error: project not found"
  try {
    const result = await ctx.client.callTool({
      name: "list_issues",
      arguments: {
        project: "NONEXISTENT_PROJECT_12345",
      },
    })

    if (!result.isError) {
      return { name, passed: false, error: "Expected error but got success" }
    }

    const content = result.content[0]
    if (content.type !== "text") {
      return { name, passed: false, error: "Expected text content" }
    }

    log.dim(`  Error message: ${content.text}`)
    return { name, passed: true, result: { error: content.text } }
  } catch (e) {
    return { name, passed: false, error: String(e) }
  }
}

async function testErrorNotFoundIssue(ctx: TestContext): Promise<TestResult> {
  const name = "error: issue not found"
  try {
    const result = await ctx.client.callTool({
      name: "get_issue",
      arguments: {
        project: ctx.project,
        identifier: "999999999",
      },
    })

    if (!result.isError) {
      return { name, passed: false, error: "Expected error but got success" }
    }

    const content = result.content[0]
    if (content.type !== "text") {
      return { name, passed: false, error: "Expected text content" }
    }

    log.dim(`  Error message: ${content.text}`)
    return { name, passed: true, result: { error: content.text } }
  } catch (e) {
    return { name, passed: false, error: String(e) }
  }
}

async function testErrorInvalidParams(ctx: TestContext): Promise<TestResult> {
  const name = "error: invalid params"
  try {
    const result = await ctx.client.callTool({
      name: "list_issues",
      arguments: {
        // Missing required 'project' parameter
        limit: 5,
      },
    })

    if (!result.isError) {
      return { name, passed: false, error: "Expected error but got success" }
    }

    const content = result.content[0]
    if (content.type !== "text") {
      return { name, passed: false, error: "Expected text content" }
    }

    log.dim(`  Error message: ${content.text}`)
    return { name, passed: true, result: { error: content.text } }
  } catch (e) {
    return { name, passed: false, error: String(e) }
  }
}

// --- Main ---

async function main() {
  console.log("\n")
  log.info("Huly MCP Server Verification")
  log.info("=============================\n")

  // Check environment
  const project = process.env.HULY_PROJECT ?? process.env.HULY_WORKSPACE
  if (!project) {
    log.error("HULY_PROJECT or HULY_WORKSPACE environment variable is required")
    log.dim("  Set HULY_PROJECT to your project identifier (e.g., 'HULY')")
    process.exit(1)
  }

  const requiredEnvVars = ["HULY_URL", "HULY_EMAIL", "HULY_PASSWORD", "HULY_WORKSPACE"]
  const missingVars = requiredEnvVars.filter(v => !process.env[v])
  if (missingVars.length > 0) {
    log.error(`Missing environment variables: ${missingVars.join(", ")}`)
    process.exit(1)
  }

  log.info(`Project: ${project}`)
  log.info(`URL: ${process.env.HULY_URL}`)
  log.info(`Workspace: ${process.env.HULY_WORKSPACE}\n`)

  // Start MCP server as child process
  log.info("Starting MCP server...")
  const serverProcess = spawn("node", ["--experimental-strip-types", "src/index.ts"], {
    env: process.env,
    stdio: ["pipe", "pipe", "inherit"],
  })

  // Create MCP client
  const transport = new StdioClientTransport({
    command: "node",
    args: ["--experimental-strip-types", "src/index.ts"],
    env: process.env as Record<string, string>,
  })

  const client = new Client({
    name: "mcp-verifier",
    version: "1.0.0",
  })

  try {
    await client.connect(transport)
    log.success("Connected to MCP server\n")

    // List available tools
    const tools = await client.listTools()
    log.info(`Available tools: ${tools.tools.map(t => t.name).join(", ")}\n`)

    // Run tests
    const ctx: TestContext = { client, project }
    const results: TestResult[] = []

    log.info("Running tool tests...\n")

    // Happy path tests
    results.push(await testListIssues(ctx))
    results.push(await testListIssuesWithStatus(ctx))
    results.push(await testGetIssue(ctx))
    results.push(await testCreateIssue(ctx))
    results.push(await testUpdateIssue(ctx))
    results.push(await testAddLabel(ctx))

    // Error case tests
    log.info("\nRunning error case tests...\n")
    results.push(await testErrorNotFoundProject(ctx))
    results.push(await testErrorNotFoundIssue(ctx))
    results.push(await testErrorInvalidParams(ctx))

    // Summary
    console.log("\n")
    log.info("Test Results")
    log.info("============\n")

    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length

    for (const result of results) {
      if (result.passed) {
        log.success(result.name)
      } else {
        log.error(`${result.name}: ${result.error}`)
      }
    }

    console.log("\n")
    if (failed === 0) {
      log.success(`All ${passed} tests passed!`)
    } else {
      log.error(`${failed} of ${passed + failed} tests failed`)
    }

    // Cleanup hint
    if (ctx.createdIssueId) {
      log.warn(`\nNote: Created test issue ${ctx.createdIssueId} - you may want to delete it manually`)
    }

    await client.close()
    serverProcess.kill()

    process.exit(failed > 0 ? 1 : 0)
  } catch (e) {
    log.error(`Failed to connect: ${e}`)
    serverProcess.kill()
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
