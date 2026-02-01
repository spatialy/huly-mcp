import { describe, it, expect } from "vitest"
import { Effect, Exit, Layer } from "effect"
import type {
  Doc,
  FindResult,
  Ref,
  Space,
  Status,
} from "@hcengineering/core"
import { type Issue as HulyIssue, type Project as HulyProject, IssuePriority } from "@hcengineering/tracker"
import { HulyClient, type HulyClientOperations } from "../../src/huly/client.js"
import {
  McpServerService,
  McpServerError,
  TOOL_DEFINITIONS,
} from "../../src/mcp/server.js"

// Import plugin objects at runtime (CommonJS modules)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tracker = require("@hcengineering/tracker").default as typeof import("@hcengineering/tracker").default

// --- Mock Data Builders ---

const makeProject = (overrides?: Partial<HulyProject>): HulyProject =>
  ({
    _id: "project-1" as Ref<HulyProject>,
    _class: tracker.class.Project,
    space: "space-1" as Ref<Space>,
    identifier: "TEST",
    name: "Test Project",
    sequence: 1,
    defaultIssueStatus: "status-open" as Ref<Status>,
    defaultTimeReportDay: 0,
    modifiedBy: "user-1" as Ref<Doc>,
    modifiedOn: Date.now(),
    createdBy: "user-1" as Ref<Doc>,
    createdOn: Date.now(),
    ...overrides,
  }) as HulyProject

const makeIssue = (overrides?: Partial<HulyIssue>): HulyIssue =>
  ({
    _id: "issue-1" as Ref<HulyIssue>,
    _class: tracker.class.Issue,
    space: "project-1" as Ref<HulyProject>,
    identifier: "TEST-1",
    title: "Test Issue",
    description: null,
    status: "status-open" as Ref<Status>,
    priority: IssuePriority.Medium,
    assignee: null,
    kind: "task-type-1" as Ref<Doc>,
    number: 1,
    dueDate: null,
    rank: "0|aaa",
    attachedTo: "no-parent" as Ref<HulyIssue>,
    attachedToClass: tracker.class.Issue,
    collection: "subIssues",
    component: null,
    subIssues: 0,
    parents: [],
    estimation: 0,
    remainingTime: 0,
    reportedTime: 0,
    reports: 0,
    childInfo: [],
    modifiedBy: "user-1" as Ref<Doc>,
    modifiedOn: Date.now(),
    createdBy: "user-1" as Ref<Doc>,
    createdOn: Date.now(),
    ...overrides,
  }) as HulyIssue

const makeStatus = (overrides?: Partial<Status>): Status =>
  ({
    _id: "status-1" as Ref<Status>,
    _class: "core:class:Status" as Ref<Doc>,
    space: "space-1" as Ref<Space>,
    ofAttribute: "tracker:attribute:IssueStatus" as Ref<Doc>,
    name: "Open",
    modifiedBy: "user-1" as Ref<Doc>,
    modifiedOn: Date.now(),
    createdBy: "user-1" as Ref<Doc>,
    createdOn: Date.now(),
    ...overrides,
  }) as Status

// --- Test Helpers ---

const createMockHulyClientLayer = (config: {
  projects?: HulyProject[]
  issues?: HulyIssue[]
  statuses?: Status[]
}) => {
  const projects = config.projects ?? []
  const issues = config.issues ?? []
  const statuses = config.statuses ?? []

  const findAllImpl: HulyClientOperations["findAll"] = ((_class: unknown) => {
    if (_class === tracker.class.Issue) {
      return Effect.succeed(issues as unknown as FindResult<Doc>)
    }
    if (_class === tracker.class.IssueStatus) {
      return Effect.succeed(statuses as unknown as FindResult<Doc>)
    }
    return Effect.succeed([] as unknown as FindResult<Doc>)
  }) as HulyClientOperations["findAll"]

  const findOneImpl: HulyClientOperations["findOne"] = ((_class: unknown, query: unknown) => {
    if (_class === tracker.class.Project) {
      const identifier = (query as Record<string, unknown>).identifier as string
      const found = projects.find(p => p.identifier === identifier)
      return Effect.succeed(found as Doc | undefined)
    }
    if (_class === tracker.class.Issue) {
      const q = query as Record<string, unknown>
      const found = issues.find(i =>
        (q.identifier && i.identifier === q.identifier) ||
        (q.number && i.number === q.number)
      )
      return Effect.succeed(found as Doc | undefined)
    }
    return Effect.succeed(undefined)
  }) as HulyClientOperations["findOne"]

  return HulyClient.testLayer({
    findAll: findAllImpl,
    findOne: findOneImpl,
  })
}

// --- Tests ---

describe("TOOL_DEFINITIONS", () => {
  // test-revizorro: approved
  it("exports 5 tool definitions", () => {
    const tools = Object.keys(TOOL_DEFINITIONS)
    expect(tools).toHaveLength(5)
    expect(tools).toContain("list_issues")
    expect(tools).toContain("get_issue")
    expect(tools).toContain("create_issue")
    expect(tools).toContain("update_issue")
    expect(tools).toContain("add_issue_label")
  })

  // test-revizorro: approved
  it("each tool has name, description, and inputSchema", () => {
    for (const [key, tool] of Object.entries(TOOL_DEFINITIONS)) {
      expect(tool.name).toBe(key)
      expect(typeof tool.description).toBe("string")
      expect(tool.description.length).toBeGreaterThan(10)
      expect(tool.inputSchema).toBeDefined()
      expect(typeof tool.inputSchema).toBe("object")
    }
  })

  describe("inputSchema format", () => {
    // test-revizorro: suspect [Only checks 1 of 4 properties (project), missing status/assignee/limit verification]
    it("list_issues schema has correct structure", () => {
      const schema = TOOL_DEFINITIONS.list_issues.inputSchema
      expect(schema).toHaveProperty("type", "object")
      expect(schema).toHaveProperty("properties")
      expect((schema as { properties: Record<string, unknown> }).properties).toHaveProperty("project")
    })

    // test-revizorro: approved
    it("get_issue schema has correct structure", () => {
      const schema = TOOL_DEFINITIONS.get_issue.inputSchema
      expect(schema).toHaveProperty("type", "object")
      expect(schema).toHaveProperty("properties")
      expect((schema as { properties: Record<string, unknown> }).properties).toHaveProperty("project")
      expect((schema as { properties: Record<string, unknown> }).properties).toHaveProperty("identifier")
    })

    // test-revizorro: approved
    it("create_issue schema has correct structure", () => {
      const schema = TOOL_DEFINITIONS.create_issue.inputSchema
      expect(schema).toHaveProperty("type", "object")
      expect(schema).toHaveProperty("properties")
      expect((schema as { properties: Record<string, unknown> }).properties).toHaveProperty("project")
      expect((schema as { properties: Record<string, unknown> }).properties).toHaveProperty("title")
    })

    // test-revizorro: suspect [Only checks 2 of 7 properties (project/identifier), missing title/description/priority/assignee/status verification]
    it("update_issue schema has correct structure", () => {
      const schema = TOOL_DEFINITIONS.update_issue.inputSchema
      expect(schema).toHaveProperty("type", "object")
      expect(schema).toHaveProperty("properties")
      expect((schema as { properties: Record<string, unknown> }).properties).toHaveProperty("project")
      expect((schema as { properties: Record<string, unknown> }).properties).toHaveProperty("identifier")
    })

    // test-revizorro: suspect [Missing 'color' property check (4th field in schema), claims "correct structure" but incomplete]
    it("add_issue_label schema has correct structure", () => {
      const schema = TOOL_DEFINITIONS.add_issue_label.inputSchema
      expect(schema).toHaveProperty("type", "object")
      expect(schema).toHaveProperty("properties")
      expect((schema as { properties: Record<string, unknown> }).properties).toHaveProperty("project")
      expect((schema as { properties: Record<string, unknown> }).properties).toHaveProperty("identifier")
      expect((schema as { properties: Record<string, unknown> }).properties).toHaveProperty("label")
    })
  })
})

describe("McpServerService", () => {
  describe("layer creation", () => {
    // test-revizorro: approved
    it("can create layer with stdio transport config", async () => {
      const project = makeProject()
      const issues = [makeIssue()]
      const statuses = [makeStatus({ _id: "status-open" as Ref<Status>, name: "Open" })]

      const hulyClientLayer = createMockHulyClientLayer({
        projects: [project],
        issues,
        statuses,
      })

      const serverLayer = McpServerService.layer({ transport: "stdio" }).pipe(
        Layer.provide(hulyClientLayer)
      )

      // Verify we can build the layer (this tests the Effect.gen runs without error)
      const exit = await Effect.runPromiseExit(
        Layer.build(serverLayer).pipe(Effect.scoped)
      )

      expect(Exit.isSuccess(exit)).toBe(true)
    })

    // test-revizorro: approved
    it("can create layer with http transport config", async () => {
      const project = makeProject()
      const hulyClientLayer = createMockHulyClientLayer({
        projects: [project],
        issues: [],
        statuses: [],
      })

      const serverLayer = McpServerService.layer({
        transport: "http",
        httpPort: 3000,
      }).pipe(Layer.provide(hulyClientLayer))

      const exit = await Effect.runPromiseExit(
        Layer.build(serverLayer).pipe(Effect.scoped)
      )

      expect(Exit.isSuccess(exit)).toBe(true)
    })
  })

  describe("testLayer", () => {
    // test-revizorro: approved
    it("creates a test layer with default operations", async () => {
      const testLayer = McpServerService.testLayer({})

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const server = yield* McpServerService
          // run() should return void immediately with default mock
          yield* server.run()
          yield* server.stop()
          return "success"
        }).pipe(Effect.provide(testLayer))
      )

      expect(result).toBe("success")
    })

    // test-revizorro: approved
    it("allows overriding run operation", async () => {
      let runCalled = false

      const testLayer = McpServerService.testLayer({
        run: () =>
          Effect.sync(() => {
            runCalled = true
          }),
      })

      await Effect.runPromise(
        Effect.gen(function* () {
          const server = yield* McpServerService
          yield* server.run()
        }).pipe(Effect.provide(testLayer))
      )

      expect(runCalled).toBe(true)
    })

    // test-revizorro: approved
    it("allows overriding stop operation", async () => {
      let stopCalled = false

      const testLayer = McpServerService.testLayer({
        stop: () =>
          Effect.sync(() => {
            stopCalled = true
          }),
      })

      await Effect.runPromise(
        Effect.gen(function* () {
          const server = yield* McpServerService
          yield* server.stop()
        }).pipe(Effect.provide(testLayer))
      )

      expect(stopCalled).toBe(true)
    })

    // test-revizorro: approved
    it("can mock run to fail with error", async () => {
      const testLayer = McpServerService.testLayer({
        run: () =>
          new McpServerError({ message: "Test error" }),
      })

      const exit = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const server = yield* McpServerService
          yield* server.run()
        }).pipe(Effect.provide(testLayer))
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const cause = exit.cause
        expect(cause._tag).toBe("Fail")
        if (cause._tag === "Fail") {
          expect((cause.error as McpServerError)._tag).toBe("McpServerError")
          expect((cause.error as McpServerError).message).toBe("Test error")
        }
      }
    })
  })
})

describe("McpServerError", () => {
  // test-revizorro: approved
  it("creates error with message", () => {
    const error = new McpServerError({ message: "Connection failed" })
    expect(error._tag).toBe("McpServerError")
    expect(error.message).toBe("Connection failed")
  })

  // test-revizorro: approved
  it("creates error with message and cause", () => {
    const cause = new Error("Original error")
    const error = new McpServerError({
      message: "Connection failed",
      cause,
    })
    expect(error._tag).toBe("McpServerError")
    expect(error.message).toBe("Connection failed")
    expect(error.cause).toBe(cause)
  })

  // test-revizorro: approved
  it("can be used as Effect error", async () => {
    const effect = Effect.fail(new McpServerError({ message: "Test" }))

    const exit = await Effect.runPromiseExit(effect)

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const cause = exit.cause
      expect(cause._tag).toBe("Fail")
      if (cause._tag === "Fail") {
        expect((cause.error as McpServerError)._tag).toBe("McpServerError")
      }
    }
  })
})

describe("Tool definition descriptions", () => {
  // test-revizorro: approved
  it("list_issues has helpful description", () => {
    expect(TOOL_DEFINITIONS.list_issues.description).toContain("Query")
    expect(TOOL_DEFINITIONS.list_issues.description).toContain("issues")
    expect(TOOL_DEFINITIONS.list_issues.description).toContain("filter")
  })

  // test-revizorro: approved
  it("get_issue has helpful description", () => {
    expect(TOOL_DEFINITIONS.get_issue.description).toContain("Retrieve")
    expect(TOOL_DEFINITIONS.get_issue.description).toContain("full details")
    expect(TOOL_DEFINITIONS.get_issue.description).toContain("markdown")
  })

  // test-revizorro: approved
  it("create_issue has helpful description", () => {
    expect(TOOL_DEFINITIONS.create_issue.description).toContain("Create")
    expect(TOOL_DEFINITIONS.create_issue.description).toContain("issue")
    expect(TOOL_DEFINITIONS.create_issue.description).toContain("markdown")
  })

  // test-revizorro: suspect [Only checks trivial word presence, doesn't validate description is actually helpful or complete]
  it("update_issue has helpful description", () => {
    expect(TOOL_DEFINITIONS.update_issue.description).toContain("Update")
    expect(TOOL_DEFINITIONS.update_issue.description).toContain("modified")
  })

  // test-revizorro: approved
  it("add_issue_label has helpful description", () => {
    expect(TOOL_DEFINITIONS.add_issue_label.description).toContain("label")
    expect(TOOL_DEFINITIONS.add_issue_label.description).toContain("tag")
  })
})
