import type { AttachedData, Data, DocumentUpdate, MarkupBlobRef, Ref } from "@hcengineering/core"
import { generateId, SortingOrder } from "@hcengineering/core"
import { Effect } from "effect"

import { TestCaseId, TestPlanId, TestPlanItemId, TestSuiteId } from "../../domain/schemas/shared.js"
import type {
  AddTestPlanItemParams,
  AddTestPlanItemResult,
  CreateTestPlanParams,
  CreateTestPlanResult,
  DeleteTestPlanParams,
  DeleteTestPlanResult,
  GetTestPlanParams,
  ListTestPlansParams,
  ListTestPlansResult,
  RemoveTestPlanItemParams,
  RemoveTestPlanItemResult,
  TestPlanDetail,
  TestPlanItemSummary,
  TestPlanSummary,
  UpdateTestPlanParams,
  UpdateTestPlanResult
} from "../../domain/schemas/test-plans.js"
import { HulyClient, type HulyClientError } from "../client.js"
import type {
  PersonNotFoundError,
  TestCaseNotFoundError,
  TestPlanNotFoundError,
  TestProjectNotFoundError
} from "../errors.js"
import type { TestPlan, TestPlanItem } from "../test-management-classes.js"
import { testManagement } from "../test-management-classes.js"
import { clampLimit } from "./shared.js"
import {
  findTestCase,
  findTestPlan,
  findTestProject,
  resolveAssigneeName,
  resolveAssigneeRef
} from "./test-management-shared.js"

export const listTestPlans = (
  params: ListTestPlansParams
): Effect.Effect<
  ListTestPlansResult,
  TestProjectNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const plans = yield* client.findAll<TestPlan>(
      testManagement.class.TestPlan,
      { space: project._id },
      { limit: clampLimit(params.limit), sort: { name: SortingOrder.Ascending } }
    )
    const summaries: Array<TestPlanSummary> = plans.map((p) => ({
      id: TestPlanId.make(p._id),
      name: p.name
    }))
    return { plans: summaries, total: plans.total }
  })

export const getTestPlan = (
  params: GetTestPlanParams
): Effect.Effect<
  TestPlanDetail,
  TestProjectNotFoundError | TestPlanNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const plan = yield* findTestPlan(client, project._id, params.plan, project.name)
    let description: string | undefined
    if (plan.description) {
      // description field stores a MarkupBlobRef (branded string) at runtime
      description = yield* client.fetchMarkup(
        testManagement.class.TestPlan,
        plan._id,
        "description",
        plan.description as MarkupBlobRef,
        "markdown"
      )
    }
    const items = yield* client.findAll<TestPlanItem>(
      testManagement.class.TestPlanItem,
      { attachedTo: plan._id },
      { sort: { modifiedOn: SortingOrder.Descending } }
    )
    const itemSummaries: Array<TestPlanItemSummary> = []
    for (const item of items) {
      const assigneeName = yield* resolveAssigneeName(client, item.assignee)
      itemSummaries.push({
        id: TestPlanItemId.make(item._id),
        testCase: TestCaseId.make(item.testCase),
        testSuite: item.testSuite ? TestSuiteId.make(item.testSuite) : undefined,
        assignee: assigneeName
      })
    }
    return {
      id: TestPlanId.make(plan._id),
      name: plan.name,
      description,
      items: itemSummaries
    }
  })

export const createTestPlan = (
  params: CreateTestPlanParams
): Effect.Effect<
  CreateTestPlanResult,
  TestProjectNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const planId: Ref<TestPlan> = generateId()
    let descriptionRef: MarkupBlobRef | null = null
    if (params.description !== undefined && params.description.trim() !== "") {
      descriptionRef = yield* client.uploadMarkup(
        testManagement.class.TestPlan,
        planId,
        "description",
        params.description,
        "markdown"
      ) as Effect.Effect<MarkupBlobRef, HulyClientError>
    }
    // Data<TestPlan> strips Doc base fields. Our TestPlan interface is opaque (hardcoded class IDs,
    // no npm package), so the literal can't satisfy the generic constraint without a cast.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- opaque interface boundary
    const planData = {
      name: params.name,
      description: descriptionRef ?? ""
    } as Data<TestPlan>
    yield* client.createDoc(testManagement.class.TestPlan, project._id, planData, planId)
    return { id: TestPlanId.make(planId), name: params.name }
  })

export const updateTestPlan = (
  params: UpdateTestPlanParams
): Effect.Effect<
  UpdateTestPlanResult,
  TestProjectNotFoundError | TestPlanNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const plan = yield* findTestPlan(client, project._id, params.plan, project.name)
    const ops: Record<string, unknown> = {}
    let descriptionUpdatedInPlace = false
    if (params.name !== undefined) ops.name = params.name
    if (params.description !== undefined) {
      if (plan.description) {
        yield* client.updateMarkup(
          testManagement.class.TestPlan,
          plan._id,
          "description",
          params.description,
          "markdown"
        )
        descriptionUpdatedInPlace = true
      } else {
        ops.description = yield* client.uploadMarkup(
          testManagement.class.TestPlan,
          plan._id,
          "description",
          params.description,
          "markdown"
        )
      }
    }
    if (Object.keys(ops).length === 0 && !descriptionUpdatedInPlace) {
      return { id: TestPlanId.make(plan._id), updated: false }
    }
    if (Object.keys(ops).length > 0) {
      yield* client.updateDoc(
        testManagement.class.TestPlan,
        plan.space,
        plan._id,
        ops as DocumentUpdate<TestPlan>
      )
    }
    return { id: TestPlanId.make(plan._id), updated: true }
  })

export const deleteTestPlan = (
  params: DeleteTestPlanParams
): Effect.Effect<
  DeleteTestPlanResult,
  TestProjectNotFoundError | TestPlanNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const plan = yield* findTestPlan(client, project._id, params.plan, project.name)
    yield* client.removeDoc(testManagement.class.TestPlan, plan.space, plan._id)
    return { id: TestPlanId.make(plan._id), deleted: true }
  })

export const addTestPlanItem = (
  params: AddTestPlanItemParams
): Effect.Effect<
  AddTestPlanItemResult,
  TestProjectNotFoundError | TestPlanNotFoundError | TestCaseNotFoundError | PersonNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const plan = yield* findTestPlan(client, project._id, params.plan, project.name)
    const tc = yield* findTestCase(client, project._id, params.testCase)
    const itemId: Ref<TestPlanItem> = generateId()
    let assigneeRef: string | null = null
    if (params.assignee !== undefined) {
      assigneeRef = yield* resolveAssigneeRef(client, params.assignee)
    }
    // AttachedData strips Doc/AttachedDoc base fields. Our TestPlanItem interface is opaque.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- opaque interface boundary
    const itemData = {
      testCase: tc._id,
      testSuite: tc.attachedTo,
      assignee: assigneeRef
    } as AttachedData<TestPlanItem>
    yield* client.addCollection(
      testManagement.class.TestPlanItem,
      project._id,
      plan._id,
      testManagement.class.TestPlan,
      "items",
      itemData,
      itemId
    )
    return { id: TestPlanItemId.make(itemId), testCase: TestCaseId.make(tc._id) }
  })

export const removeTestPlanItem = (
  params: RemoveTestPlanItemParams
): Effect.Effect<
  RemoveTestPlanItemResult,
  TestProjectNotFoundError | TestPlanNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    yield* findTestPlan(client, project._id, params.plan, project.name)

    yield* client.removeDoc(
      testManagement.class.TestPlanItem,
      project._id,
      params.item as Ref<TestPlanItem>
    )
    return { id: TestPlanItemId.make(params.item), removed: true }
  })
