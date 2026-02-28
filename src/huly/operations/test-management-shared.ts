import type { Person } from "@hcengineering/contact"
import type { Ref } from "@hcengineering/core"
import { Effect } from "effect"

import type { TestCasePriority, TestCaseStatus, TestCaseType } from "../../domain/schemas/test-management.js"
import type { HulyClient, HulyClientError } from "../client.js"
import {
  PersonNotFoundError,
  TestCaseNotFoundError,
  TestProjectNotFoundError,
  TestSuiteNotFoundError
} from "../errors.js"
import { contact } from "../huly-plugins.js"
import type { TestCase, TestProject, TestSuite } from "../test-management-classes.js"
import { testManagement } from "../test-management-classes.js"
import { findByNameOrId, findPersonByEmailOrName, toRef } from "./shared.js"

// --- Enum Mappings ---

const TEST_CASE_TYPE_TO_STRING: Record<number, TestCaseType> = {
  0: "functional",
  1: "performance",
  2: "regression",
  3: "security",
  4: "smoke",
  5: "usability"
}

export const STRING_TO_TEST_CASE_TYPE: Record<TestCaseType, number> = {
  functional: 0,
  performance: 1,
  regression: 2,
  security: 3,
  smoke: 4,
  usability: 5
}

const TEST_CASE_PRIORITY_TO_STRING: Record<number, TestCasePriority> = {
  0: "low",
  1: "medium",
  2: "high",
  3: "urgent"
}

export const STRING_TO_TEST_CASE_PRIORITY: Record<TestCasePriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3
}

const TEST_CASE_STATUS_TO_STRING: Record<number, TestCaseStatus> = {
  0: "draft",
  1: "ready-for-review",
  2: "fix-review-comments",
  3: "approved",
  4: "rejected"
}

export const STRING_TO_TEST_CASE_STATUS: Record<TestCaseStatus, number> = {
  "draft": 0,
  "ready-for-review": 1,
  "fix-review-comments": 2,
  "approved": 3,
  "rejected": 4
}

export const typeToString = (n: number): TestCaseType => TEST_CASE_TYPE_TO_STRING[n] ?? "functional"
export const priorityToString = (n: number): TestCasePriority => TEST_CASE_PRIORITY_TO_STRING[n] ?? "medium"
export const statusToString = (n: number): TestCaseStatus => TEST_CASE_STATUS_TO_STRING[n] ?? "draft"

// --- Lookup Helpers ---

export const findTestProject = (
  client: HulyClient["Type"],
  identifier: string
): Effect.Effect<TestProject, TestProjectNotFoundError | HulyClientError> =>
  Effect.gen(function*() {
    const project = yield* findByNameOrId(
      client,
      testManagement.class.TestProject,
      { name: identifier },
      { _id: toRef<TestProject>(identifier) }
    )
    if (project === undefined) {
      return yield* new TestProjectNotFoundError({ identifier })
    }
    return project
  })

export const findTestSuite = (
  client: HulyClient["Type"],
  projectId: Ref<TestProject>,
  identifier: string,
  projectName: string
): Effect.Effect<TestSuite, TestSuiteNotFoundError | HulyClientError> =>
  Effect.gen(function*() {
    const suite = yield* findByNameOrId(
      client,
      testManagement.class.TestSuite,
      { space: projectId, name: identifier },
      { space: projectId, _id: toRef<TestSuite>(identifier) }
    )
    if (suite === undefined) {
      return yield* new TestSuiteNotFoundError({ identifier, project: projectName })
    }
    return suite
  })

export const findTestCase = (
  client: HulyClient["Type"],
  projectId: Ref<TestProject>,
  identifier: string
): Effect.Effect<TestCase, TestCaseNotFoundError | HulyClientError> =>
  Effect.gen(function*() {
    const tc = yield* findByNameOrId(
      client,
      testManagement.class.TestCase,
      { space: projectId, name: identifier },
      { space: projectId, _id: toRef<TestCase>(identifier) }
    )
    if (tc === undefined) {
      return yield* new TestCaseNotFoundError({ identifier, suite: "(project)" })
    }
    return tc
  })

export const resolveAssigneeRef = (
  client: HulyClient["Type"],
  assigneeIdentifier: string
): Effect.Effect<Ref<Person>, PersonNotFoundError | HulyClientError> =>
  Effect.gen(function*() {
    const person = yield* findPersonByEmailOrName(client, assigneeIdentifier)
    if (person === undefined) {
      return yield* new PersonNotFoundError({ identifier: assigneeIdentifier })
    }
    return person._id
  })

export const resolveAssigneeName = (
  client: HulyClient["Type"],
  assigneeRef: string | null | undefined
): Effect.Effect<string | undefined, HulyClientError> =>
  Effect.gen(function*() {
    if (assigneeRef == null || assigneeRef === "") return undefined
    const person = yield* client.findOne<Person>(
      contact.class.Person,
      { _id: toRef<Person>(assigneeRef) }
    )
    return person?.name
  })
