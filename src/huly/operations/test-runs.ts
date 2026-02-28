import type { AttachedData, Data, DocumentQuery, DocumentUpdate, MarkupBlobRef, Ref } from "@hcengineering/core"
import { generateId, SortingOrder } from "@hcengineering/core"
import { Effect } from "effect"

import { TestCaseId, TestResultId, TestRunId, TestSuiteId } from "../../domain/schemas/shared.js"
import type {
  CreateTestResultParams,
  CreateTestResultResult,
  CreateTestRunParams,
  CreateTestRunResult,
  DeleteTestRunParams,
  DeleteTestRunResult,
  GetTestResultParams,
  GetTestRunParams,
  ListTestResultsParams,
  ListTestResultsResult,
  ListTestRunsParams,
  ListTestRunsResult,
  RunTestPlanParams,
  RunTestPlanResult,
  TestResultDetail,
  TestResultSummary,
  TestRunDetail,
  TestRunSummary,
  UpdateTestResultParams,
  UpdateTestResultResult,
  UpdateTestRunParams,
  UpdateTestRunResult
} from "../../domain/schemas/test-runs.js"
import { HulyClient, type HulyClientError } from "../client.js"
import type {
  PersonNotFoundError,
  TestCaseNotFoundError,
  TestPlanNotFoundError,
  TestProjectNotFoundError,
  TestResultNotFoundError,
  TestRunNotFoundError
} from "../errors.js"
import type { TestCase, TestPlanItem, TestResult, TestRun } from "../test-management-classes.js"
import { testManagement } from "../test-management-classes.js"
import { clampLimit, findPersonByEmailOrName } from "./shared.js"
import {
  findTestCase,
  findTestPlan,
  findTestProject,
  findTestResult,
  findTestRun,
  resolveAssigneeName,
  resolveAssigneeRef,
  resultStatusToString,
  STRING_TO_TEST_RESULT_STATUS
} from "./test-management-shared.js"

export const listTestRuns = (
  params: ListTestRunsParams
): Effect.Effect<
  ListTestRunsResult,
  TestProjectNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const runs = yield* client.findAll<TestRun>(
      testManagement.class.TestRun,
      { space: project._id },
      { limit: clampLimit(params.limit), sort: { modifiedOn: SortingOrder.Descending } }
    )
    const summaries: Array<TestRunSummary> = runs.map((r) => ({
      id: TestRunId.make(r._id),
      name: r.name,
      dueDate: r.dueDate
    }))
    return { runs: summaries, total: runs.total }
  })

export const getTestRun = (
  params: GetTestRunParams
): Effect.Effect<
  TestRunDetail,
  TestProjectNotFoundError | TestRunNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const run = yield* findTestRun(client, project._id, params.run, project.name)
    let description: string | undefined
    if (run.description) {
      // description field stores a MarkupBlobRef (branded string) at runtime
      description = yield* client.fetchMarkup(
        testManagement.class.TestRun,
        run._id,
        "description",
        run.description as MarkupBlobRef,
        "markdown"
      )
    }
    return {
      id: TestRunId.make(run._id),
      name: run.name,
      description,
      dueDate: run.dueDate
    }
  })

export const createTestRun = (
  params: CreateTestRunParams
): Effect.Effect<
  CreateTestRunResult,
  TestProjectNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const runId: Ref<TestRun> = generateId()
    let descriptionRef: MarkupBlobRef | null = null
    if (params.description !== undefined && params.description.trim() !== "") {
      descriptionRef = yield* client.uploadMarkup(
        testManagement.class.TestRun,
        runId,
        "description",
        params.description,
        "markdown"
      ) as Effect.Effect<MarkupBlobRef, HulyClientError>
    }
    // Data<TestRun> strips Doc base fields. Our TestRun interface is opaque.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- opaque interface boundary
    const runData = {
      name: params.name,
      description: descriptionRef ?? "",
      dueDate: params.dueDate ?? null
    } as Data<TestRun>
    yield* client.createDoc(testManagement.class.TestRun, project._id, runData, runId)
    return { id: TestRunId.make(runId), name: params.name }
  })

export const updateTestRun = (
  params: UpdateTestRunParams
): Effect.Effect<
  UpdateTestRunResult,
  TestProjectNotFoundError | TestRunNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const run = yield* findTestRun(client, project._id, params.run, project.name)
    const ops: Record<string, unknown> = {}
    let descriptionUpdatedInPlace = false
    if (params.name !== undefined) ops.name = params.name
    if (params.description !== undefined) {
      if (run.description) {
        yield* client.updateMarkup(
          testManagement.class.TestRun,
          run._id,
          "description",
          params.description,
          "markdown"
        )
        descriptionUpdatedInPlace = true
      } else {
        ops.description = yield* client.uploadMarkup(
          testManagement.class.TestRun,
          run._id,
          "description",
          params.description,
          "markdown"
        )
      }
    }
    if (params.dueDate !== undefined) {
      ops.dueDate = params.dueDate ?? null
    }
    if (Object.keys(ops).length === 0 && !descriptionUpdatedInPlace) {
      return { id: TestRunId.make(run._id), updated: false }
    }
    if (Object.keys(ops).length > 0) {
      yield* client.updateDoc(
        testManagement.class.TestRun,
        run.space,
        run._id,
        ops as DocumentUpdate<TestRun>
      )
    }
    return { id: TestRunId.make(run._id), updated: true }
  })

export const deleteTestRun = (
  params: DeleteTestRunParams
): Effect.Effect<
  DeleteTestRunResult,
  TestProjectNotFoundError | TestRunNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const run = yield* findTestRun(client, project._id, params.run, project.name)
    yield* client.removeDoc(testManagement.class.TestRun, run.space, run._id)
    return { id: TestRunId.make(run._id), deleted: true }
  })

// --- Test Result Operations ---

export const listTestResults = (
  params: ListTestResultsParams
): Effect.Effect<
  ListTestResultsResult,
  TestProjectNotFoundError | TestRunNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const run = yield* findTestRun(client, project._id, params.run, project.name)
    const query: DocumentQuery<TestResult> = { attachedTo: run._id }
    if (params.status !== undefined) query.status = STRING_TO_TEST_RESULT_STATUS[params.status]
    if (params.assignee !== undefined) {
      const person = yield* findPersonByEmailOrName(client, params.assignee)
      if (person === undefined) return { results: [], total: 0 }
      ;(query as Record<string, unknown>).assignee = person._id
    }
    const results = yield* client.findAll<TestResult>(
      testManagement.class.TestResult,
      query,
      { limit: clampLimit(params.limit), sort: { modifiedOn: SortingOrder.Descending } }
    )
    const summaries: Array<TestResultSummary> = []
    for (const r of results) {
      const assigneeName = yield* resolveAssigneeName(client, r.assignee)
      summaries.push({
        id: TestResultId.make(r._id),
        name: r.name,
        testCase: TestCaseId.make(r.testCase),
        testSuite: r.testSuite ? TestSuiteId.make(r.testSuite) : undefined,
        status: resultStatusToString(r.status),
        assignee: assigneeName
      })
    }
    return { results: summaries, total: results.total }
  })

export const getTestResult = (
  params: GetTestResultParams
): Effect.Effect<
  TestResultDetail,
  TestProjectNotFoundError | TestRunNotFoundError | TestResultNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const run = yield* findTestRun(client, project._id, params.run, project.name)
    const result = yield* findTestResult(client, project._id, params.result, run.name)
    let description: string | undefined
    if (result.description) {
      // description field stores a MarkupBlobRef (branded string) at runtime
      description = yield* client.fetchMarkup(
        testManagement.class.TestResult,
        result._id,
        "description",
        result.description as MarkupBlobRef,
        "markdown"
      )
    }
    const assigneeName = yield* resolveAssigneeName(client, result.assignee)
    return {
      id: TestResultId.make(result._id),
      name: result.name,
      description,
      testCase: TestCaseId.make(result.testCase),
      testSuite: result.testSuite ? TestSuiteId.make(result.testSuite) : undefined,
      status: resultStatusToString(result.status),
      assignee: assigneeName
    }
  })

const DEFAULT_RESULT_STATUS = 0 // untested

export const createTestResult = (
  params: CreateTestResultParams
): Effect.Effect<
  CreateTestResultResult,
  TestProjectNotFoundError | TestRunNotFoundError | TestCaseNotFoundError | PersonNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const run = yield* findTestRun(client, project._id, params.run, project.name)
    const tc = yield* findTestCase(client, project._id, params.testCase)
    const resultId: Ref<TestResult> = generateId()
    let descriptionRef: MarkupBlobRef | null = null
    if (params.description !== undefined && params.description.trim() !== "") {
      descriptionRef = yield* client.uploadMarkup(
        testManagement.class.TestResult,
        resultId,
        "description",
        params.description,
        "markdown"
      ) as Effect.Effect<MarkupBlobRef, HulyClientError>
    }
    let assigneeRef: string | null = null
    if (params.assignee !== undefined) {
      assigneeRef = yield* resolveAssigneeRef(client, params.assignee)
    }
    // AttachedData strips Doc/AttachedDoc base fields. Our TestResult interface is opaque.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- opaque interface boundary
    const resultData = {
      name: tc.name,
      description: descriptionRef ?? "",
      testCase: tc._id,
      testSuite: tc.attachedTo,
      status: params.status !== undefined ? STRING_TO_TEST_RESULT_STATUS[params.status] : DEFAULT_RESULT_STATUS,
      assignee: assigneeRef
    } as AttachedData<TestResult>
    yield* client.addCollection(
      testManagement.class.TestResult,
      project._id,
      run._id,
      testManagement.class.TestRun,
      "results",
      resultData,
      resultId
    )
    return { id: TestResultId.make(resultId), name: tc.name }
  })

export const updateTestResult = (
  params: UpdateTestResultParams
): Effect.Effect<
  UpdateTestResultResult,
  TestProjectNotFoundError | TestRunNotFoundError | TestResultNotFoundError | PersonNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const run = yield* findTestRun(client, project._id, params.run, project.name)
    const result = yield* findTestResult(client, project._id, params.result, run.name)
    const ops: Record<string, unknown> = {}
    let descriptionUpdatedInPlace = false
    if (params.description !== undefined) {
      if (result.description) {
        yield* client.updateMarkup(
          testManagement.class.TestResult,
          result._id,
          "description",
          params.description,
          "markdown"
        )
        descriptionUpdatedInPlace = true
      } else {
        ops.description = yield* client.uploadMarkup(
          testManagement.class.TestResult,
          result._id,
          "description",
          params.description,
          "markdown"
        )
      }
    }
    if (params.status !== undefined) ops.status = STRING_TO_TEST_RESULT_STATUS[params.status]
    if (params.assignee !== undefined) {
      ops.assignee = params.assignee === null ? null : yield* resolveAssigneeRef(client, params.assignee)
    }
    if (Object.keys(ops).length === 0 && !descriptionUpdatedInPlace) {
      return { id: TestResultId.make(result._id), updated: false }
    }
    if (Object.keys(ops).length > 0) {
      yield* client.updateDoc(
        testManagement.class.TestResult,
        result.space,
        result._id,
        ops as DocumentUpdate<TestResult>
      )
    }
    return { id: TestResultId.make(result._id), updated: true }
  })

// --- Compound Operations ---

export const runTestPlan = (
  params: RunTestPlanParams
): Effect.Effect<
  RunTestPlanResult,
  TestProjectNotFoundError | TestPlanNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const plan = yield* findTestPlan(client, project._id, params.plan, project.name)
    const items = yield* client.findAll<TestPlanItem>(
      testManagement.class.TestPlanItem,
      { attachedTo: plan._id },
      {}
    )
    const runName = params.name ?? `${plan.name} — ${new Date().toISOString().slice(0, 16)}`
    const runId: Ref<TestRun> = generateId()
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- opaque interface boundary
    const runData = {
      name: runName,
      description: "",
      dueDate: params.dueDate ?? null
    } as Data<TestRun>
    yield* client.createDoc(testManagement.class.TestRun, project._id, runData, runId)
    for (const item of items) {
      const tc = yield* client.findOne<TestCase>(
        testManagement.class.TestCase,
        { _id: item.testCase }
      )
      const resultId: Ref<TestResult> = generateId()
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- opaque interface boundary
      const resultData = {
        name: tc?.name ?? "",
        description: "",
        testCase: item.testCase,
        testSuite: item.testSuite ?? null,
        status: DEFAULT_RESULT_STATUS,
        assignee: item.assignee ?? null
      } as AttachedData<TestResult>
      yield* client.addCollection(
        testManagement.class.TestResult,
        project._id,
        runId,
        testManagement.class.TestRun,
        "results",
        resultData,
        resultId
      )
    }
    return { runId: TestRunId.make(runId), runName, resultCount: items.length }
  })
