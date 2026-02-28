import { JSONSchema, Schema } from "effect"

import {
  LimitParam,
  NonEmptyString,
  type TestCaseId,
  type TestPlanId,
  type TestPlanItemId,
  type TestSuiteId
} from "./shared.js"

// --- Test Plan Result Types ---

export interface TestPlanSummary {
  readonly id: TestPlanId
  readonly name: string
}

export interface TestPlanDetail {
  readonly id: TestPlanId
  readonly name: string
  readonly description?: string | undefined
  readonly items: ReadonlyArray<TestPlanItemSummary>
}

export interface TestPlanItemSummary {
  readonly id: TestPlanItemId
  readonly testCase: TestCaseId
  readonly testSuite?: TestSuiteId | undefined
  readonly assignee?: string | undefined
}

// --- Test Plan Param Schemas ---

export const ListTestPlansParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  limit: Schema.optional(
    LimitParam.annotations({
      description: "Maximum number of test plans to return (default: 50)"
    })
  )
}).annotations({
  title: "ListTestPlansParams",
  description: "Parameters for listing test plans in a project"
})

export type ListTestPlansParams = Schema.Schema.Type<typeof ListTestPlansParamsSchema>

export interface ListTestPlansResult {
  readonly plans: ReadonlyArray<TestPlanSummary>
  readonly total: number
}

export const GetTestPlanParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  plan: NonEmptyString.annotations({
    description: "Test plan name or ID"
  })
}).annotations({
  title: "GetTestPlanParams",
  description: "Parameters for getting a test plan"
})

export type GetTestPlanParams = Schema.Schema.Type<typeof GetTestPlanParamsSchema>

export const CreateTestPlanParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  name: NonEmptyString.annotations({
    description: "Test plan name"
  }),
  description: Schema.optional(Schema.String.annotations({
    description: "Test plan description (markdown supported)"
  }))
}).annotations({
  title: "CreateTestPlanParams",
  description: "Parameters for creating a test plan"
})

export type CreateTestPlanParams = Schema.Schema.Type<typeof CreateTestPlanParamsSchema>

export interface CreateTestPlanResult {
  readonly id: TestPlanId
  readonly name: string
}

export const UpdateTestPlanParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  plan: NonEmptyString.annotations({
    description: "Test plan name or ID"
  }),
  name: Schema.optional(NonEmptyString.annotations({
    description: "New test plan name"
  })),
  description: Schema.optional(Schema.String.annotations({
    description: "New test plan description (markdown supported)"
  }))
}).annotations({
  title: "UpdateTestPlanParams",
  description: "Parameters for updating a test plan"
})

export type UpdateTestPlanParams = Schema.Schema.Type<typeof UpdateTestPlanParamsSchema>

export interface UpdateTestPlanResult {
  readonly id: TestPlanId
  readonly updated: boolean
}

export const DeleteTestPlanParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  plan: NonEmptyString.annotations({
    description: "Test plan name or ID"
  })
}).annotations({
  title: "DeleteTestPlanParams",
  description: "Parameters for deleting a test plan"
})

export type DeleteTestPlanParams = Schema.Schema.Type<typeof DeleteTestPlanParamsSchema>

export interface DeleteTestPlanResult {
  readonly id: TestPlanId
  readonly deleted: boolean
}

export const AddTestPlanItemParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  plan: NonEmptyString.annotations({
    description: "Test plan name or ID"
  }),
  testCase: NonEmptyString.annotations({
    description: "Test case name or ID to add to the plan"
  }),
  assignee: Schema.optional(NonEmptyString.annotations({
    description: "Assignee email or name (overrides the test case's default assignee for this plan)"
  }))
}).annotations({
  title: "AddTestPlanItemParams",
  description: "Parameters for adding a test case to a test plan"
})

export type AddTestPlanItemParams = Schema.Schema.Type<typeof AddTestPlanItemParamsSchema>

export interface AddTestPlanItemResult {
  readonly id: TestPlanItemId
  readonly testCase: TestCaseId
}

export const RemoveTestPlanItemParamsSchema = Schema.Struct({
  project: NonEmptyString.annotations({
    description: "Test project name or ID"
  }),
  plan: NonEmptyString.annotations({
    description: "Test plan name or ID"
  }),
  item: NonEmptyString.annotations({
    description: "Test plan item ID to remove"
  })
}).annotations({
  title: "RemoveTestPlanItemParams",
  description: "Parameters for removing a test case from a test plan"
})

export type RemoveTestPlanItemParams = Schema.Schema.Type<typeof RemoveTestPlanItemParamsSchema>

export interface RemoveTestPlanItemResult {
  readonly id: TestPlanItemId
  readonly removed: boolean
}

// --- JSON Schemas ---

export const listTestPlansParamsJsonSchema = JSONSchema.make(ListTestPlansParamsSchema)
export const getTestPlanParamsJsonSchema = JSONSchema.make(GetTestPlanParamsSchema)
export const createTestPlanParamsJsonSchema = JSONSchema.make(CreateTestPlanParamsSchema)
export const updateTestPlanParamsJsonSchema = JSONSchema.make(UpdateTestPlanParamsSchema)
export const deleteTestPlanParamsJsonSchema = JSONSchema.make(DeleteTestPlanParamsSchema)
export const addTestPlanItemParamsJsonSchema = JSONSchema.make(AddTestPlanItemParamsSchema)
export const removeTestPlanItemParamsJsonSchema = JSONSchema.make(RemoveTestPlanItemParamsSchema)

// --- Parse Functions ---

export const parseListTestPlansParams = Schema.decodeUnknown(ListTestPlansParamsSchema)
export const parseGetTestPlanParams = Schema.decodeUnknown(GetTestPlanParamsSchema)
export const parseCreateTestPlanParams = Schema.decodeUnknown(CreateTestPlanParamsSchema)
export const parseUpdateTestPlanParams = Schema.decodeUnknown(UpdateTestPlanParamsSchema)
export const parseDeleteTestPlanParams = Schema.decodeUnknown(DeleteTestPlanParamsSchema)
export const parseAddTestPlanItemParams = Schema.decodeUnknown(AddTestPlanItemParamsSchema)
export const parseRemoveTestPlanItemParams = Schema.decodeUnknown(RemoveTestPlanItemParamsSchema)
