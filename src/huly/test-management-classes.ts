// Hardcoded class IDs for the Test Management module.
// @hcengineering/test-management is not published on npm, so we can't import class refs.
// These are runtime string constants matching the Huly platform's class naming convention.
// If Huly renames these, queries will silently return empty — integration tests catch drift.

import type { AttachedDoc, Class, Doc, Ref, Space } from "@hcengineering/core"

export interface TestProject extends Space {
  readonly __testProjectBrand: unique symbol
}

export interface TestSuite extends Doc {
  readonly __testSuiteBrand: unique symbol
  name: string
  description?: string
  parent?: Ref<TestSuite>
}

export interface TestCase extends AttachedDoc {
  readonly __testCaseBrand: unique symbol
  name: string
  description?: string
  type: number
  priority: number
  status: number
  assignee?: string | null
}

export interface TestPlan extends Doc {
  readonly __testPlanBrand: unique symbol
  name: string
  description?: string
}

export interface TestPlanItem extends AttachedDoc {
  readonly __testPlanItemBrand: unique symbol
  testCase: Ref<TestCase>
  testSuite?: Ref<TestSuite>
  assignee?: string | null
}

export interface TestRun extends Doc {
  readonly __testRunBrand: unique symbol
  name: string
  description?: string
  dueDate?: number
}

export interface TestResult extends AttachedDoc {
  readonly __testResultBrand: unique symbol
  name: string
  description?: string
  testCase: Ref<TestCase>
  testSuite?: Ref<TestSuite>
  status: number
  assignee?: string | null
}

export const testManagement = {
  class: {
    TestProject: "testManagement:class:TestProject" as Ref<Class<TestProject>>,
    TestSuite: "testManagement:class:TestSuite" as Ref<Class<TestSuite>>,
    TestCase: "testManagement:class:TestCase" as Ref<Class<TestCase>>,
    TestPlan: "testManagement:class:TestPlan" as Ref<Class<TestPlan>>,
    TestPlanItem: "testManagement:class:TestPlanItem" as Ref<Class<TestPlanItem>>,
    TestRun: "testManagement:class:TestRun" as Ref<Class<TestRun>>,
    TestResult: "testManagement:class:TestResult" as Ref<Class<TestResult>>
  }
} as const
