import { describe, it, expect } from "vitest"
import { Effect, Schema, Exit } from "effect"
import {
  IssuePrioritySchema,
  IssuePriorityValues,
  LabelSchema,
  PersonRefSchema,
  ProjectSummarySchema,
  makeJsonSchema,
  parseIssue,
  parseIssueSummary,
  parseProject,
  parseListIssuesParams,
  parseGetIssueParams,
  parseCreateIssueParams,
  parseUpdateIssueParams,
  parseAddLabelParams,
  listIssuesParamsJsonSchema,
  getIssueParamsJsonSchema,
  createIssueParamsJsonSchema,
  updateIssueParamsJsonSchema,
  addLabelParamsJsonSchema,
  type IssuePriority,
  type Issue,
  type IssueSummary,
  type Project,
  type ListIssuesParams,
  type GetIssueParams,
  type CreateIssueParams,
  type UpdateIssueParams,
  type AddLabelParams,
} from "../../src/domain/schemas.js"

// Helper type for JSON Schema assertions
type JsonSchemaObject = {
  $schema?: string
  type?: string
  required?: string[]
  properties?: Record<string, { description?: string }>
}

describe("Domain Schemas", () => {
  describe("IssuePrioritySchema", () => {
    // test-revizorro: approved
    it("accepts valid priorities", async () => {
      for (const priority of IssuePriorityValues) {
        const result = await Effect.runPromise(
          Schema.decodeUnknown(IssuePrioritySchema)(priority)
        )
        expect(result).toBe(priority)
      }
    })

    // test-revizorro: approved
    it("rejects invalid priority", async () => {
      const exit = await Effect.runPromiseExit(
        Schema.decodeUnknown(IssuePrioritySchema)("invalid")
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })

    // test-revizorro: suspect [Tests TypeScript compile-time types at runtime (meaningless), trivial assertion always passes]
    it("type extraction works", () => {
      const priority: IssuePriority = "urgent"
      expect(IssuePriorityValues).toContain(priority)
    })
  })

  describe("LabelSchema", () => {
    // test-revizorro: approved
    it("parses label with title only", async () => {
      const result = await Effect.runPromise(
        Schema.decodeUnknown(LabelSchema)({ title: "bug" })
      )
      expect(result).toEqual({ title: "bug" })
    })

    // test-revizorro: approved
    it("parses label with title and color", async () => {
      const result = await Effect.runPromise(
        Schema.decodeUnknown(LabelSchema)({ title: "feature", color: 5 })
      )
      expect(result).toEqual({ title: "feature", color: 5 })
    })

    // test-revizorro: approved
    it("rejects empty title", async () => {
      const exit = await Effect.runPromiseExit(
        Schema.decodeUnknown(LabelSchema)({ title: "  " })
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe("PersonRefSchema", () => {
    // test-revizorro: approved
    it("parses with id only", async () => {
      const result = await Effect.runPromise(
        Schema.decodeUnknown(PersonRefSchema)({ id: "person-123" })
      )
      expect(result).toEqual({ id: "person-123" })
    })

    // test-revizorro: approved
    it("parses with all fields", async () => {
      const result = await Effect.runPromise(
        Schema.decodeUnknown(PersonRefSchema)({
          id: "person-123",
          name: "John Doe",
          email: "john@example.com",
        })
      )
      expect(result).toEqual({
        id: "person-123",
        name: "John Doe",
        email: "john@example.com",
      })
    })
  })

  describe("ProjectSummarySchema", () => {
    // test-revizorro: approved
    it("parses minimal project", async () => {
      const result = await Effect.runPromise(
        Schema.decodeUnknown(ProjectSummarySchema)({
          identifier: "HULY",
          name: "Huly Project",
        })
      )
      expect(result).toEqual({
        identifier: "HULY",
        name: "Huly Project",
      })
    })

    // test-revizorro: suspect [Only checks description field, ignores identifier/name - partial verification antipattern]
    it("parses with description", async () => {
      const result = await Effect.runPromise(
        Schema.decodeUnknown(ProjectSummarySchema)({
          identifier: "HULY",
          name: "Huly Project",
          description: "Main project",
        })
      )
      expect(result.description).toBe("Main project")
    })
  })

  describe("ProjectSchema", () => {
    // test-revizorro: approved
    it("parses full project", async () => {
      const result = await Effect.runPromise(
        parseProject({
          identifier: "HULY",
          name: "Huly Project",
          description: "Main project",
          defaultStatus: "Open",
          statuses: ["Open", "In Progress", "Done"],
        })
      )
      expect(result.identifier).toBe("HULY")
      expect(result.statuses).toEqual(["Open", "In Progress", "Done"])
    })
  })

  describe("IssueSummarySchema", () => {
    // test-revizorro: approved
    it("parses minimal issue summary", async () => {
      const result = await Effect.runPromise(
        parseIssueSummary({
          identifier: "HULY-123",
          title: "Fix bug",
          status: "Open",
        })
      )
      expect(result).toEqual({
        identifier: "HULY-123",
        title: "Fix bug",
        status: "Open",
      })
    })

    // test-revizorro: approved
    it("parses with all optional fields", async () => {
      const result = await Effect.runPromise(
        parseIssueSummary({
          identifier: "HULY-123",
          title: "Fix bug",
          status: "Open",
          priority: "high",
          assignee: "john@example.com",
          modifiedOn: 1706500000000,
        })
      )
      expect(result.priority).toBe("high")
      expect(result.assignee).toBe("john@example.com")
      expect(result.modifiedOn).toBe(1706500000000)
    })
  })

  describe("IssueSchema", () => {
    // test-revizorro: approved
    it("parses minimal issue", async () => {
      const result = await Effect.runPromise(
        parseIssue({
          identifier: "HULY-123",
          title: "Fix bug",
          status: "Open",
          project: "HULY",
        })
      )
      expect(result.identifier).toBe("HULY-123")
      expect(result.project).toBe("HULY")
    })

    // test-revizorro: suspect [Only verifies 3 of 13 fields - missing verification for identifier, title, description, status, assignee, project, timestamps, dueDate, estimation]
    it("parses full issue", async () => {
      const result = await Effect.runPromise(
        parseIssue({
          identifier: "HULY-123",
          title: "Fix bug",
          description: "# Description\n\nFix the bug",
          status: "Open",
          priority: "urgent",
          assignee: "john@example.com",
          assigneeRef: { id: "person-1", name: "John" },
          labels: [{ title: "bug", color: 1 }],
          project: "HULY",
          modifiedOn: 1706500000000,
          createdOn: 1706400000000,
          dueDate: 1706600000000,
          estimation: 3600000,
        })
      )
      expect(result.priority).toBe("urgent")
      expect(result.labels).toHaveLength(1)
      expect(result.assigneeRef?.name).toBe("John")
    })

    // test-revizorro: approved
    it("handles null dueDate", async () => {
      const result = await Effect.runPromise(
        parseIssue({
          identifier: "HULY-123",
          title: "Fix bug",
          status: "Open",
          project: "HULY",
          dueDate: null,
        })
      )
      expect(result.dueDate).toBeNull()
    })

    // test-revizorro: suspect [Tests TypeScript compile-time types at runtime (meaningless), trivial assertion just verifies assignment worked]
    it("type extraction provides full type info", () => {
      const issue: Issue = {
        identifier: "HULY-1",
        title: "Test",
        status: "Open",
        project: "HULY",
        priority: "medium",
      }
      expect(issue.identifier).toBe("HULY-1")
    })
  })

  describe("ListIssuesParamsSchema", () => {
    // test-revizorro: approved
    it("parses minimal params", async () => {
      const result = await Effect.runPromise(
        parseListIssuesParams({ project: "HULY" })
      )
      expect(result).toEqual({ project: "HULY" })
    })

    // test-revizorro: suspect [Only checks limit field, ignores project/status/assignee - partial verification antipattern]
    it("parses with all options", async () => {
      const result = await Effect.runPromise(
        parseListIssuesParams({
          project: "HULY",
          status: "Open",
          assignee: "john@example.com",
          limit: 50,
        })
      )
      expect(result.limit).toBe(50)
    })

    // test-revizorro: approved
    it("rejects negative limit", async () => {
      const exit = await Effect.runPromiseExit(
        parseListIssuesParams({ project: "HULY", limit: -1 })
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })

    // test-revizorro: approved
    it("rejects non-integer limit", async () => {
      const exit = await Effect.runPromiseExit(
        parseListIssuesParams({ project: "HULY", limit: 10.5 })
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe("GetIssueParamsSchema", () => {
    // test-revizorro: approved
    it("parses valid params", async () => {
      const result = await Effect.runPromise(
        parseGetIssueParams({ project: "HULY", identifier: "HULY-123" })
      )
      expect(result).toEqual({ project: "HULY", identifier: "HULY-123" })
    })

    // test-revizorro: approved
    it("rejects missing identifier", async () => {
      const exit = await Effect.runPromiseExit(
        parseGetIssueParams({ project: "HULY" })
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe("CreateIssueParamsSchema", () => {
    // test-revizorro: approved
    it("parses minimal params", async () => {
      const result = await Effect.runPromise(
        parseCreateIssueParams({ project: "HULY", title: "New issue" })
      )
      expect(result).toEqual({ project: "HULY", title: "New issue" })
    })

    // test-revizorro: suspect [Sends 6 fields but only verifies 2 (priority, description) - missing checks for project, title, assignee, status]
    it("parses with all options", async () => {
      const result = await Effect.runPromise(
        parseCreateIssueParams({
          project: "HULY",
          title: "New issue",
          description: "Details here",
          priority: "high",
          assignee: "john@example.com",
          status: "Open",
        })
      )
      expect(result.priority).toBe("high")
      expect(result.description).toBe("Details here")
    })

    // test-revizorro: approved
    it("rejects empty title", async () => {
      const exit = await Effect.runPromiseExit(
        parseCreateIssueParams({ project: "HULY", title: "   " })
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe("UpdateIssueParamsSchema", () => {
    // test-revizorro: approved
    it("parses minimal params", async () => {
      const result = await Effect.runPromise(
        parseUpdateIssueParams({ project: "HULY", identifier: "HULY-123" })
      )
      expect(result).toEqual({ project: "HULY", identifier: "HULY-123" })
    })

    // test-revizorro: approved
    it("parses with update fields", async () => {
      const result = await Effect.runPromise(
        parseUpdateIssueParams({
          project: "HULY",
          identifier: "HULY-123",
          title: "Updated title",
          priority: "low",
          assignee: null,
        })
      )
      expect(result.title).toBe("Updated title")
      expect(result.assignee).toBeNull()
    })
  })

  describe("AddLabelParamsSchema", () => {
    // test-revizorro: approved
    it("parses valid params", async () => {
      const result = await Effect.runPromise(
        parseAddLabelParams({
          project: "HULY",
          identifier: "HULY-123",
          label: "bug",
        })
      )
      expect(result).toEqual({
        project: "HULY",
        identifier: "HULY-123",
        label: "bug",
      })
    })

    // test-revizorro: approved
    it("rejects empty label", async () => {
      const exit = await Effect.runPromiseExit(
        parseAddLabelParams({
          project: "HULY",
          identifier: "HULY-123",
          label: "  ",
        })
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe("JSON Schema Generation", () => {
    // test-revizorro: approved
    it("generates JSON Schema for ListIssuesParams", () => {
      const schema = listIssuesParamsJsonSchema as JsonSchemaObject
      expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#")
      expect(schema.type).toBe("object")
      expect(schema.required).toContain("project")
    })

    // test-revizorro: approved
    it("generates JSON Schema for GetIssueParams", () => {
      const schema = getIssueParamsJsonSchema as JsonSchemaObject
      expect(schema.type).toBe("object")
      expect(schema.required).toContain("project")
      expect(schema.required).toContain("identifier")
    })

    // test-revizorro: suspect [Sends 6 fields but only verifies 2 (priority, description) - missing checks for project, title, assignee, status]
    it("generates JSON Schema for CreateIssueParams", () => {
      const schema = createIssueParamsJsonSchema as JsonSchemaObject
      expect(schema.type).toBe("object")
      expect(schema.required).toContain("project")
      expect(schema.required).toContain("title")
    })

    // test-revizorro: approved
    it("generates JSON Schema for UpdateIssueParams", () => {
      const schema = updateIssueParamsJsonSchema as JsonSchemaObject
      expect(schema.type).toBe("object")
      expect(schema.required).toContain("project")
      expect(schema.required).toContain("identifier")
    })

    // test-revizorro: approved
    it("generates JSON Schema for AddLabelParams", () => {
      const schema = addLabelParamsJsonSchema as JsonSchemaObject
      expect(schema.type).toBe("object")
      expect(schema.required).toContain("project")
      expect(schema.required).toContain("identifier")
      expect(schema.required).toContain("label")
    })

    // test-revizorro: approved
    it("makeJsonSchema works with any schema", () => {
      const customSchema = Schema.Struct({
        name: Schema.String,
        age: Schema.Number,
      })
      const jsonSchema = makeJsonSchema(customSchema) as JsonSchemaObject
      expect(jsonSchema.type).toBe("object")
      expect(jsonSchema.required).toContain("name")
      expect(jsonSchema.required).toContain("age")
    })

    // test-revizorro: approved
    it("schema is valid JSON Schema draft-07", () => {
      const schema = createIssueParamsJsonSchema as JsonSchemaObject
      expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#")
      expect(schema.type).toBe("object")
      // additionalProperties should be false for strict validation
      expect((schema as Record<string, unknown>).additionalProperties).toBe(false)
    })
  })

  describe("Type Extraction", () => {
    // test-revizorro: suspect [Sends 6 fields but only verifies 2 (priority, description) - missing checks for project, title, assignee, status]
    it("Issue type is correctly extracted", () => {
      const issue: Issue = {
        identifier: "TEST-1",
        title: "Test Issue",
        status: "Open",
        project: "TEST",
      }
      expect(issue.identifier).toBe("TEST-1")
    })

    // test-revizorro: suspect [Only tests TypeScript compilation, not schema validation - should use parseIssueSummary and test validation]
    it("IssueSummary type is correctly extracted", () => {
      const summary: IssueSummary = {
        identifier: "TEST-1",
        title: "Test Issue",
        status: "Open",
      }
      expect(summary.identifier).toBe("TEST-1")
    })

    // test-revizorro: suspect [Type-only test, no parsing/validation, trivial assertion just checks assigned value]
    it("Project type is correctly extracted", () => {
      const project: Project = {
        identifier: "TEST",
        name: "Test Project",
      }
      expect(project.identifier).toBe("TEST")
    })

    // test-revizorro: suspect [Only checks assigned value equals itself, no schema validation, doesn't test NonEmptyString or positive limit rules]
    it("ListIssuesParams type is correctly extracted", () => {
      const params: ListIssuesParams = {
        project: "TEST",
        limit: 10,
      }
      expect(params.project).toBe("TEST")
    })

    // test-revizorro: suspect [Only tests TypeScript compilation, not schema validation - creates 2-field object, checks only 1 field equality]
    it("GetIssueParams type is correctly extracted", () => {
      const params: GetIssueParams = {
        project: "TEST",
        identifier: "TEST-1",
      }
      expect(params.identifier).toBe("TEST-1")
    })

    // test-revizorro: approved
    it("CreateIssueParams type is correctly extracted", () => {
      const params: CreateIssueParams = {
        project: "TEST",
        title: "New Issue",
        priority: "medium",
      }
      expect(params.title).toBe("New Issue")
    })

    // test-revizorro: approved
    it("UpdateIssueParams type is correctly extracted", () => {
      const params: UpdateIssueParams = {
        project: "TEST",
        identifier: "TEST-1",
        title: "Updated",
      }
      expect(params.title).toBe("Updated")
    })

    // test-revizorro: suspect [Type-only test, no schema validation. Asserts constant equals itself, doesn't test decoding/parsing]
    it("AddLabelParams type is correctly extracted", () => {
      const params: AddLabelParams = {
        project: "TEST",
        identifier: "TEST-1",
        label: "bug",
      }
      expect(params.label).toBe("bug")
    })
  })
})
