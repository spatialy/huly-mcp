import { JSONSchema, ParseResult, Schema } from "effect"

import { normalizeForComparison } from "../../utils/normalize.js"
import {
  LimitParam,
  NonEmptyString,
  type TestCaseId,
  type TestResultId,
  type TestRunId,
  type TestSuiteId,
  Timestamp
} from "./shared.js"

// --- Test Result Status Enum ---

export const TestResultStatusValues = ["untested", "blocked", "passed", "failed"] as const

const TestResultStatusLiteral = Schema.Literal(...TestResultStatusValues)

const normalizedResultStatusLookup = new Map(
  TestResultStatusValues.map(v => [normalizeForComparison(v), v] as const)
)

export const TestResultStatusSchema = Schema.transformOrFail(
  Schema.String,
  TestResultStatusLiteral,
  {
    strict: true,
    decode: (input, _options, ast) => {
      const match = normalizedResultStatusLookup.get(normalizeForComparison(input))
      return match !== undefined
        ? ParseResult.succeed(match)
        : ParseResult.fail(new ParseResult.Type(ast, input, `Expected one of: ${TestResultStatusValues.join(", ")}`))
    },
    encode: ParseResult.succeed
  }
).annotations({
  title: "TestResultStatus",
  description: "Test result execution status",
  jsonSchema: { type: "string", enum: [...TestResultStatusValues] }
})

export type TestResultStatus = Schema.Schema.Type<typeof TestResultStatusSchema>

// --- Test Run Result Types ---

export interface TestRunSummary {
  readonly id: TestRunId
  readonly name: string
  readonly dueDate?: number | undefined
}

export interface TestRunDetail {
  readonly id: TestRunId
  readonly name: string
  readonly description?: string | undefined
  readonly dueDate?: number | undefined
}

export interface TestResultSummary {
  readonly id: TestResultId
  readonly name: string
  readonly testCase: TestCaseId
  readonly testSuite?: TestSuiteId | undefined
  readonly status: TestResultStatus
  readonly assignee?: string | undefined
}

export interface TestResultDetail {
  readonly id: TestResultId
  readonly name: string
  readonly description?: string | undefined
  readonly testCase: TestCaseId
  readonly testSuite?: TestSuiteId | undefined
  readonly status: TestResultStatus
  readonly assignee?: string | undefined
}

// --- Test Run Param Schemas ---

export const ListTestRunsParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  limit: Schema.optional(
    LimitParam.annotations({
      description: "Maximum number of test runs to return (default: 50)"
    })
  )
}).annotations({
  title: "ListTestRunsParams",
  description: "Parameters for listing test runs in a project"
})

export type ListTestRunsParams = Schema.Schema.Type<typeof ListTestRunsParamsSchema>

export interface ListTestRunsResult {
  readonly runs: ReadonlyArray<TestRunSummary>
  readonly total: number
}

export const GetTestRunParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  run: NonEmptyString.annotations({
    description: "Test run name or ID"
  })
}).annotations({
  title: "GetTestRunParams",
  description: "Parameters for getting a test run"
})

export type GetTestRunParams = Schema.Schema.Type<typeof GetTestRunParamsSchema>

export const CreateTestRunParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  name: NonEmptyString.annotations({
    description: "Test run name"
  }),
  description: Schema.optional(Schema.String.annotations({
    description: "Test run description (markdown supported)"
  })),
  dueDate: Schema.optional(Timestamp.annotations({
    description: "Due date as Unix timestamp in milliseconds"
  }))
}).annotations({
  title: "CreateTestRunParams",
  description: "Parameters for creating a test run"
})

export type CreateTestRunParams = Schema.Schema.Type<typeof CreateTestRunParamsSchema>

export interface CreateTestRunResult {
  readonly id: TestRunId
  readonly name: string
}

export const UpdateTestRunParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  run: NonEmptyString.annotations({
    description: "Test run name or ID"
  }),
  name: Schema.optional(NonEmptyString.annotations({
    description: "New test run name"
  })),
  description: Schema.optional(Schema.String.annotations({
    description: "New test run description (markdown supported)"
  })),
  dueDate: Schema.optional(
    Schema.NullOr(Timestamp).annotations({
      description: "New due date as Unix timestamp in milliseconds (null to clear)"
    })
  )
}).annotations({
  title: "UpdateTestRunParams",
  description: "Parameters for updating a test run"
})

export type UpdateTestRunParams = Schema.Schema.Type<typeof UpdateTestRunParamsSchema>

export interface UpdateTestRunResult {
  readonly id: TestRunId
  readonly updated: boolean
}

export const DeleteTestRunParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  run: NonEmptyString.annotations({
    description: "Test run name or ID"
  })
}).annotations({
  title: "DeleteTestRunParams",
  description: "Parameters for deleting a test run"
})

export type DeleteTestRunParams = Schema.Schema.Type<typeof DeleteTestRunParamsSchema>

export interface DeleteTestRunResult {
  readonly id: TestRunId
  readonly deleted: boolean
}

export const ListTestResultsParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  run: NonEmptyString.annotations({
    description: "Test run name or ID"
  }),
  status: Schema.optional(TestResultStatusSchema.annotations({
    description: "Filter by result status (untested, blocked, passed, failed)"
  })),
  assignee: Schema.optional(NonEmptyString.annotations({
    description: "Filter by assignee email or name"
  })),
  limit: Schema.optional(
    LimitParam.annotations({
      description: "Maximum number of test results to return (default: 50)"
    })
  )
}).annotations({
  title: "ListTestResultsParams",
  description: "Parameters for listing test results in a test run"
})

export type ListTestResultsParams = Schema.Schema.Type<typeof ListTestResultsParamsSchema>

export interface ListTestResultsResult {
  readonly results: ReadonlyArray<TestResultSummary>
  readonly total: number
}

export const GetTestResultParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  run: NonEmptyString.annotations({
    description: "Test run name or ID"
  }),
  result: NonEmptyString.annotations({
    description: "Test result name or ID"
  })
}).annotations({
  title: "GetTestResultParams",
  description: "Parameters for getting a test result"
})

export type GetTestResultParams = Schema.Schema.Type<typeof GetTestResultParamsSchema>

export const CreateTestResultParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  run: NonEmptyString.annotations({
    description: "Test run name or ID"
  }),
  testCase: NonEmptyString.annotations({
    description: "Test case name or ID to create a result for"
  }),
  status: Schema.optional(TestResultStatusSchema.annotations({
    description: "Initial result status (default: untested)"
  })),
  assignee: Schema.optional(NonEmptyString.annotations({
    description: "Assignee email or name"
  })),
  description: Schema.optional(Schema.String.annotations({
    description: "Result description/notes (markdown supported)"
  }))
}).annotations({
  title: "CreateTestResultParams",
  description: "Parameters for creating a test result in a test run"
})

export type CreateTestResultParams = Schema.Schema.Type<typeof CreateTestResultParamsSchema>

export interface CreateTestResultResult {
  readonly id: TestResultId
  readonly name: string
}

export const UpdateTestResultParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  run: NonEmptyString.annotations({
    description: "Test run name or ID"
  }),
  result: NonEmptyString.annotations({
    description: "Test result name or ID"
  }),
  status: Schema.optional(TestResultStatusSchema.annotations({
    description: "New result status"
  })),
  assignee: Schema.optional(
    Schema.NullOr(NonEmptyString).annotations({
      description: "New assignee email or name (null to unassign)"
    })
  ),
  description: Schema.optional(Schema.String.annotations({
    description: "New result description/notes (markdown supported)"
  }))
}).annotations({
  title: "UpdateTestResultParams",
  description: "Parameters for updating a test result"
})

export type UpdateTestResultParams = Schema.Schema.Type<typeof UpdateTestResultParamsSchema>

export interface UpdateTestResultResult {
  readonly id: TestResultId
  readonly updated: boolean
}

// --- Run Test Plan (compound) ---

export const RunTestPlanParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  plan: NonEmptyString.annotations({
    description: "Test plan name or ID to create a run from"
  }),
  name: Schema.optional(NonEmptyString.annotations({
    description: "Name for the new test run (defaults to plan name + timestamp)"
  })),
  dueDate: Schema.optional(Timestamp.annotations({
    description: "Due date for the test run as Unix timestamp in milliseconds"
  }))
}).annotations({
  title: "RunTestPlanParams",
  description: "Parameters for creating a test run from a test plan"
})

export type RunTestPlanParams = Schema.Schema.Type<typeof RunTestPlanParamsSchema>

export interface RunTestPlanResult {
  readonly runId: TestRunId
  readonly runName: string
  readonly resultCount: number
}

// --- JSON Schemas ---

export const listTestRunsParamsJsonSchema = JSONSchema.make(ListTestRunsParamsSchema)
export const getTestRunParamsJsonSchema = JSONSchema.make(GetTestRunParamsSchema)
export const createTestRunParamsJsonSchema = JSONSchema.make(CreateTestRunParamsSchema)
export const updateTestRunParamsJsonSchema = JSONSchema.make(UpdateTestRunParamsSchema)
export const deleteTestRunParamsJsonSchema = JSONSchema.make(DeleteTestRunParamsSchema)
export const listTestResultsParamsJsonSchema = JSONSchema.make(ListTestResultsParamsSchema)
export const getTestResultParamsJsonSchema = JSONSchema.make(GetTestResultParamsSchema)
export const createTestResultParamsJsonSchema = JSONSchema.make(CreateTestResultParamsSchema)
export const updateTestResultParamsJsonSchema = JSONSchema.make(UpdateTestResultParamsSchema)
export const runTestPlanParamsJsonSchema = JSONSchema.make(RunTestPlanParamsSchema)

// --- Parse Functions ---

export const parseListTestRunsParams = Schema.decodeUnknown(ListTestRunsParamsSchema)
export const parseGetTestRunParams = Schema.decodeUnknown(GetTestRunParamsSchema)
export const parseCreateTestRunParams = Schema.decodeUnknown(CreateTestRunParamsSchema)
export const parseUpdateTestRunParams = Schema.decodeUnknown(UpdateTestRunParamsSchema)
export const parseDeleteTestRunParams = Schema.decodeUnknown(DeleteTestRunParamsSchema)
export const parseListTestResultsParams = Schema.decodeUnknown(ListTestResultsParamsSchema)
export const parseGetTestResultParams = Schema.decodeUnknown(GetTestResultParamsSchema)
export const parseCreateTestResultParams = Schema.decodeUnknown(CreateTestResultParamsSchema)
export const parseUpdateTestResultParams = Schema.decodeUnknown(UpdateTestResultParamsSchema)
export const parseRunTestPlanParams = Schema.decodeUnknown(RunTestPlanParamsSchema)
