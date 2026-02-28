import { JSONSchema, ParseResult, Schema } from "effect"

import { normalizeForComparison } from "../../utils/normalize.js"
import { LimitParam, NonEmptyString, type TestCaseId, type TestProjectId, type TestSuiteId } from "./shared.js"

// --- Enum Schemas ---

export const TestCaseTypeValues = ["functional", "performance", "regression", "security", "smoke", "usability"] as const

const TestCaseTypeLiteral = Schema.Literal(...TestCaseTypeValues)

const normalizedTypeLookup = new Map(
  TestCaseTypeValues.map(v => [normalizeForComparison(v), v] as const)
)

export const TestCaseTypeSchema = Schema.transformOrFail(
  Schema.String,
  TestCaseTypeLiteral,
  {
    strict: true,
    decode: (input, _options, ast) => {
      const match = normalizedTypeLookup.get(normalizeForComparison(input))
      return match !== undefined
        ? ParseResult.succeed(match)
        : ParseResult.fail(new ParseResult.Type(ast, input, `Expected one of: ${TestCaseTypeValues.join(", ")}`))
    },
    encode: ParseResult.succeed
  }
).annotations({
  title: "TestCaseType",
  description: "Test case type",
  jsonSchema: { type: "string", enum: [...TestCaseTypeValues] }
})

export type TestCaseType = Schema.Schema.Type<typeof TestCaseTypeSchema>

export const TestCasePriorityValues = ["low", "medium", "high", "urgent"] as const

const TestCasePriorityLiteral = Schema.Literal(...TestCasePriorityValues)

const normalizedPriorityLookup = new Map(
  TestCasePriorityValues.map(v => [normalizeForComparison(v), v] as const)
)

export const TestCasePrioritySchema = Schema.transformOrFail(
  Schema.String,
  TestCasePriorityLiteral,
  {
    strict: true,
    decode: (input, _options, ast) => {
      const match = normalizedPriorityLookup.get(normalizeForComparison(input))
      return match !== undefined
        ? ParseResult.succeed(match)
        : ParseResult.fail(new ParseResult.Type(ast, input, `Expected one of: ${TestCasePriorityValues.join(", ")}`))
    },
    encode: ParseResult.succeed
  }
).annotations({
  title: "TestCasePriority",
  description: "Test case priority level",
  jsonSchema: { type: "string", enum: [...TestCasePriorityValues] }
})

export type TestCasePriority = Schema.Schema.Type<typeof TestCasePrioritySchema>

export const TestCaseStatusValues = [
  "draft",
  "ready-for-review",
  "fix-review-comments",
  "approved",
  "rejected"
] as const

const TestCaseStatusLiteral = Schema.Literal(...TestCaseStatusValues)

const normalizedStatusLookup = new Map(
  TestCaseStatusValues.map(v => [normalizeForComparison(v), v] as const)
)

export const TestCaseStatusSchema = Schema.transformOrFail(
  Schema.String,
  TestCaseStatusLiteral,
  {
    strict: true,
    decode: (input, _options, ast) => {
      const match = normalizedStatusLookup.get(normalizeForComparison(input))
      return match !== undefined
        ? ParseResult.succeed(match)
        : ParseResult.fail(new ParseResult.Type(ast, input, `Expected one of: ${TestCaseStatusValues.join(", ")}`))
    },
    encode: ParseResult.succeed
  }
).annotations({
  title: "TestCaseStatus",
  description: "Test case review status",
  jsonSchema: { type: "string", enum: [...TestCaseStatusValues] }
})

export type TestCaseStatus = Schema.Schema.Type<typeof TestCaseStatusSchema>

// --- Result Types ---

export interface TestProjectSummary {
  readonly id: TestProjectId
  readonly name: string
}

export interface TestSuiteSummary {
  readonly id: TestSuiteId
  readonly name: string
  readonly parent?: TestSuiteId | undefined
}

export interface TestSuiteDetail {
  readonly id: TestSuiteId
  readonly name: string
  readonly description?: string | undefined
  readonly parent?: TestSuiteId | undefined
}

export interface TestCaseSummary {
  readonly id: TestCaseId
  readonly name: string
  readonly type: TestCaseType
  readonly priority: TestCasePriority
  readonly status: TestCaseStatus
  readonly assignee?: string | undefined
}

export interface TestCaseDetail {
  readonly id: TestCaseId
  readonly name: string
  readonly description?: string | undefined
  readonly type: TestCaseType
  readonly priority: TestCasePriority
  readonly status: TestCaseStatus
  readonly assignee?: string | undefined
}

// --- Param Schemas ---

export const ListTestProjectsParamsSchema = Schema.Struct({
  limit: Schema.optional(
    LimitParam.annotations({
      description: "Maximum number of test projects to return (default: 50)"
    })
  )
}).annotations({
  title: "ListTestProjectsParams",
  description: "Parameters for listing test management projects"
})

export type ListTestProjectsParams = Schema.Schema.Type<typeof ListTestProjectsParamsSchema>

export interface ListTestProjectsResult {
  readonly projects: ReadonlyArray<TestProjectSummary>
  readonly total: number
}

export const ListTestSuitesParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  parent: Schema.optional(NonEmptyString.annotations({
    description: "Filter by parent suite name or ID (omit for top-level suites)"
  })),
  limit: Schema.optional(
    LimitParam.annotations({
      description: "Maximum number of suites to return (default: 50)"
    })
  )
}).annotations({
  title: "ListTestSuitesParams",
  description: "Parameters for listing test suites in a project"
})

export type ListTestSuitesParams = Schema.Schema.Type<typeof ListTestSuitesParamsSchema>

export interface ListTestSuitesResult {
  readonly suites: ReadonlyArray<TestSuiteSummary>
  readonly total: number
}

export const GetTestSuiteParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  suite: NonEmptyString.annotations({
    description: "Test suite name or ID"
  })
}).annotations({
  title: "GetTestSuiteParams",
  description: "Parameters for getting a test suite"
})

export type GetTestSuiteParams = Schema.Schema.Type<typeof GetTestSuiteParamsSchema>

export const CreateTestSuiteParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  name: NonEmptyString.annotations({
    description: "Suite name"
  }),
  description: Schema.optional(Schema.String.annotations({
    description: "Suite description (markdown supported)"
  })),
  parent: Schema.optional(NonEmptyString.annotations({
    description: "Parent suite name or ID (for nesting)"
  }))
}).annotations({
  title: "CreateTestSuiteParams",
  description: "Parameters for creating a test suite"
})

export type CreateTestSuiteParams = Schema.Schema.Type<typeof CreateTestSuiteParamsSchema>

export interface CreateTestSuiteResult {
  readonly id: TestSuiteId
  readonly name: string
}

export const UpdateTestSuiteParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  suite: NonEmptyString.annotations({
    description: "Test suite name or ID"
  }),
  name: Schema.optional(NonEmptyString.annotations({
    description: "New suite name"
  })),
  description: Schema.optional(Schema.String.annotations({
    description: "New suite description (markdown supported)"
  }))
}).annotations({
  title: "UpdateTestSuiteParams",
  description: "Parameters for updating a test suite"
})

export type UpdateTestSuiteParams = Schema.Schema.Type<typeof UpdateTestSuiteParamsSchema>

export interface UpdateTestSuiteResult {
  readonly id: TestSuiteId
  readonly updated: boolean
}

export const DeleteTestSuiteParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  suite: NonEmptyString.annotations({
    description: "Test suite name or ID"
  })
}).annotations({
  title: "DeleteTestSuiteParams",
  description: "Parameters for deleting a test suite"
})

export type DeleteTestSuiteParams = Schema.Schema.Type<typeof DeleteTestSuiteParamsSchema>

export interface DeleteTestSuiteResult {
  readonly id: TestSuiteId
  readonly deleted: boolean
}

export const ListTestCasesParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  suite: Schema.optional(NonEmptyString.annotations({
    description: "Filter by suite name or ID"
  })),
  type: Schema.optional(TestCaseTypeSchema.annotations({
    description: "Filter by test case type (functional, performance, regression, security, smoke, usability)"
  })),
  priority: Schema.optional(TestCasePrioritySchema.annotations({
    description: "Filter by priority (low, medium, high, urgent)"
  })),
  status: Schema.optional(TestCaseStatusSchema.annotations({
    description: "Filter by status (draft, ready-for-review, fix-review-comments, approved, rejected)"
  })),
  assignee: Schema.optional(NonEmptyString.annotations({
    description: "Filter by assignee email or name"
  })),
  limit: Schema.optional(
    LimitParam.annotations({
      description: "Maximum number of test cases to return (default: 50)"
    })
  )
}).annotations({
  title: "ListTestCasesParams",
  description: "Parameters for listing test cases"
})

export type ListTestCasesParams = Schema.Schema.Type<typeof ListTestCasesParamsSchema>

export interface ListTestCasesResult {
  readonly cases: ReadonlyArray<TestCaseSummary>
  readonly total: number
}

export const GetTestCaseParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  testCase: NonEmptyString.annotations({
    description: "Test case name or ID"
  })
}).annotations({
  title: "GetTestCaseParams",
  description: "Parameters for getting a test case"
})

export type GetTestCaseParams = Schema.Schema.Type<typeof GetTestCaseParamsSchema>

export const CreateTestCaseParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  suite: NonEmptyString.annotations({
    description: "Suite name or ID to create the test case in"
  }),
  name: NonEmptyString.annotations({
    description: "Test case name"
  }),
  description: Schema.optional(Schema.String.annotations({
    description: "Test case description (markdown supported)"
  })),
  type: Schema.optional(TestCaseTypeSchema.annotations({
    description: "Test case type (default: functional)"
  })),
  priority: Schema.optional(TestCasePrioritySchema.annotations({
    description: "Test case priority (default: medium)"
  })),
  status: Schema.optional(TestCaseStatusSchema.annotations({
    description: "Test case status (default: draft)"
  })),
  assignee: Schema.optional(NonEmptyString.annotations({
    description: "Assignee email or name"
  }))
}).annotations({
  title: "CreateTestCaseParams",
  description: "Parameters for creating a test case"
})

export type CreateTestCaseParams = Schema.Schema.Type<typeof CreateTestCaseParamsSchema>

export interface CreateTestCaseResult {
  readonly id: TestCaseId
  readonly name: string
}

export const UpdateTestCaseParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  testCase: NonEmptyString.annotations({
    description: "Test case name or ID"
  }),
  name: Schema.optional(NonEmptyString.annotations({
    description: "New test case name"
  })),
  description: Schema.optional(Schema.String.annotations({
    description: "New test case description (markdown supported)"
  })),
  type: Schema.optional(TestCaseTypeSchema.annotations({
    description: "New test case type"
  })),
  priority: Schema.optional(TestCasePrioritySchema.annotations({
    description: "New test case priority"
  })),
  status: Schema.optional(TestCaseStatusSchema.annotations({
    description: "New test case status"
  })),
  assignee: Schema.optional(
    Schema.NullOr(NonEmptyString).annotations({
      description: "New assignee email or name (null to unassign)"
    })
  )
}).annotations({
  title: "UpdateTestCaseParams",
  description: "Parameters for updating a test case"
})

export type UpdateTestCaseParams = Schema.Schema.Type<typeof UpdateTestCaseParamsSchema>

export interface UpdateTestCaseResult {
  readonly id: TestCaseId
  readonly updated: boolean
}

export const DeleteTestCaseParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  testCase: NonEmptyString.annotations({
    description: "Test case name or ID"
  })
}).annotations({
  title: "DeleteTestCaseParams",
  description: "Parameters for deleting a test case"
})

export type DeleteTestCaseParams = Schema.Schema.Type<typeof DeleteTestCaseParamsSchema>

export interface DeleteTestCaseResult {
  readonly id: TestCaseId
  readonly deleted: boolean
}

// --- JSON Schemas ---

export const listTestProjectsParamsJsonSchema = JSONSchema.make(ListTestProjectsParamsSchema)
export const listTestSuitesParamsJsonSchema = JSONSchema.make(ListTestSuitesParamsSchema)
export const getTestSuiteParamsJsonSchema = JSONSchema.make(GetTestSuiteParamsSchema)
export const createTestSuiteParamsJsonSchema = JSONSchema.make(CreateTestSuiteParamsSchema)
export const updateTestSuiteParamsJsonSchema = JSONSchema.make(UpdateTestSuiteParamsSchema)
export const deleteTestSuiteParamsJsonSchema = JSONSchema.make(DeleteTestSuiteParamsSchema)
export const listTestCasesParamsJsonSchema = JSONSchema.make(ListTestCasesParamsSchema)
export const getTestCaseParamsJsonSchema = JSONSchema.make(GetTestCaseParamsSchema)
export const createTestCaseParamsJsonSchema = JSONSchema.make(CreateTestCaseParamsSchema)
export const updateTestCaseParamsJsonSchema = JSONSchema.make(UpdateTestCaseParamsSchema)
export const deleteTestCaseParamsJsonSchema = JSONSchema.make(DeleteTestCaseParamsSchema)

// --- Parse Functions ---

export const parseListTestProjectsParams = Schema.decodeUnknown(ListTestProjectsParamsSchema)
export const parseListTestSuitesParams = Schema.decodeUnknown(ListTestSuitesParamsSchema)
export const parseGetTestSuiteParams = Schema.decodeUnknown(GetTestSuiteParamsSchema)
export const parseCreateTestSuiteParams = Schema.decodeUnknown(CreateTestSuiteParamsSchema)
export const parseUpdateTestSuiteParams = Schema.decodeUnknown(UpdateTestSuiteParamsSchema)
export const parseDeleteTestSuiteParams = Schema.decodeUnknown(DeleteTestSuiteParamsSchema)
export const parseListTestCasesParams = Schema.decodeUnknown(ListTestCasesParamsSchema)
export const parseGetTestCaseParams = Schema.decodeUnknown(GetTestCaseParamsSchema)
export const parseCreateTestCaseParams = Schema.decodeUnknown(CreateTestCaseParamsSchema)
export const parseUpdateTestCaseParams = Schema.decodeUnknown(UpdateTestCaseParamsSchema)
export const parseDeleteTestCaseParams = Schema.decodeUnknown(DeleteTestCaseParamsSchema)
