import type { AttachedData, Data, DocumentQuery, DocumentUpdate, MarkupBlobRef, Ref } from "@hcengineering/core"
import { generateId, SortingOrder } from "@hcengineering/core"
import { Effect } from "effect"

import { TestCaseId, TestProjectId, TestSuiteId } from "../../domain/schemas/shared.js"
import type {
  CreateTestCaseParams,
  CreateTestCaseResult,
  CreateTestSuiteParams,
  CreateTestSuiteResult,
  DeleteTestCaseParams,
  DeleteTestCaseResult,
  DeleteTestSuiteParams,
  DeleteTestSuiteResult,
  GetTestCaseParams,
  GetTestSuiteParams,
  ListTestCasesParams,
  ListTestCasesResult,
  ListTestProjectsParams,
  ListTestProjectsResult,
  ListTestSuitesParams,
  ListTestSuitesResult,
  TestCaseDetail,
  TestCaseSummary,
  TestProjectSummary,
  TestSuiteDetail,
  TestSuiteSummary,
  UpdateTestCaseParams,
  UpdateTestCaseResult,
  UpdateTestSuiteParams,
  UpdateTestSuiteResult
} from "../../domain/schemas/test-management.js"
import { HulyClient, type HulyClientError } from "../client.js"
import type {
  PersonNotFoundError,
  TestCaseNotFoundError,
  TestProjectNotFoundError,
  TestSuiteNotFoundError
} from "../errors.js"
import type { TestCase, TestProject, TestSuite } from "../test-management-classes.js"
import { testManagement } from "../test-management-classes.js"
import { clampLimit, findPersonByEmailOrName } from "./shared.js"
import {
  findTestCase,
  findTestProject,
  findTestSuite,
  priorityToString,
  resolveAssigneeName,
  resolveAssigneeRef,
  statusToString,
  STRING_TO_TEST_CASE_PRIORITY,
  STRING_TO_TEST_CASE_STATUS,
  STRING_TO_TEST_CASE_TYPE,
  typeToString
} from "./test-management-shared.js"

// --- Suite Operations ---

export const listTestProjects = (
  params: ListTestProjectsParams
): Effect.Effect<ListTestProjectsResult, HulyClientError, HulyClient> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const projects = yield* client.findAll<TestProject>(
      testManagement.class.TestProject,
      {},
      { limit: clampLimit(params.limit), sort: { name: SortingOrder.Ascending } }
    )
    const summaries: Array<TestProjectSummary> = projects.map((p) => ({
      id: TestProjectId.make(p._id),
      name: p.name
    }))
    return { projects: summaries, total: projects.total }
  })

export const listTestSuites = (
  params: ListTestSuitesParams
): Effect.Effect<
  ListTestSuitesResult,
  TestProjectNotFoundError | TestSuiteNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const query: DocumentQuery<TestSuite> = { space: project._id }
    if (params.parent !== undefined) {
      const parentSuite = yield* findTestSuite(client, project._id, params.parent, project.name)
      query.parent = parentSuite._id
    }
    const suites = yield* client.findAll<TestSuite>(
      testManagement.class.TestSuite,
      query,
      { limit: clampLimit(params.limit), sort: { name: SortingOrder.Ascending } }
    )
    const summaries: Array<TestSuiteSummary> = suites.map((s) => ({
      id: TestSuiteId.make(s._id),
      name: s.name,
      parent: s.parent ? TestSuiteId.make(s.parent) : undefined
    }))
    return { suites: summaries, total: suites.total }
  })

export const getTestSuite = (
  params: GetTestSuiteParams
): Effect.Effect<TestSuiteDetail, TestProjectNotFoundError | TestSuiteNotFoundError | HulyClientError, HulyClient> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const suite = yield* findTestSuite(client, project._id, params.suite, project.name)
    let description: string | undefined
    if (suite.description) {
      // description field stores a MarkupBlobRef (branded string) at runtime
      description = yield* client.fetchMarkup(
        testManagement.class.TestSuite,
        suite._id,
        "description",
        suite.description as MarkupBlobRef,
        "markdown"
      )
    }
    return {
      id: TestSuiteId.make(suite._id),
      name: suite.name,
      description,
      parent: suite.parent ? TestSuiteId.make(suite.parent) : undefined
    }
  })

export const createTestSuite = (
  params: CreateTestSuiteParams
): Effect.Effect<
  CreateTestSuiteResult,
  TestProjectNotFoundError | TestSuiteNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    let parentRef: Ref<TestSuite> | undefined
    if (params.parent !== undefined) {
      const parentSuite = yield* findTestSuite(client, project._id, params.parent, project.name)
      parentRef = parentSuite._id
    }
    const suiteId: Ref<TestSuite> = generateId()
    let descriptionRef: MarkupBlobRef | null = null
    if (params.description !== undefined && params.description.trim() !== "") {
      descriptionRef = yield* client.uploadMarkup(
        testManagement.class.TestSuite,
        suiteId,
        "description",
        params.description,
        "markdown"
      ) as Effect.Effect<MarkupBlobRef, HulyClientError>
    }
    // Data<TestSuite> strips Doc base fields. Our TestSuite interface is opaque (hardcoded class IDs,
    // no npm package), so the literal can't satisfy the generic constraint without a cast.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- opaque interface boundary
    const suiteData = {
      name: params.name,
      description: descriptionRef ?? "",
      parent: parentRef
    } as Data<TestSuite>
    yield* client.createDoc(testManagement.class.TestSuite, project._id, suiteData, suiteId)
    return { id: TestSuiteId.make(suiteId), name: params.name }
  })

export const updateTestSuite = (
  params: UpdateTestSuiteParams
): Effect.Effect<
  UpdateTestSuiteResult,
  TestProjectNotFoundError | TestSuiteNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const suite = yield* findTestSuite(client, project._id, params.suite, project.name)
    const ops: Record<string, unknown> = {}
    let descriptionUpdatedInPlace = false
    if (params.name !== undefined) ops.name = params.name
    if (params.description !== undefined) {
      if (suite.description) {
        yield* client.updateMarkup(
          testManagement.class.TestSuite,
          suite._id,
          "description",
          params.description,
          "markdown"
        )
        descriptionUpdatedInPlace = true
      } else {
        ops.description = yield* client.uploadMarkup(
          testManagement.class.TestSuite,
          suite._id,
          "description",
          params.description,
          "markdown"
        )
      }
    }
    if (Object.keys(ops).length === 0 && !descriptionUpdatedInPlace) {
      return { id: TestSuiteId.make(suite._id), updated: false }
    }
    if (Object.keys(ops).length > 0) {
      yield* client.updateDoc(
        testManagement.class.TestSuite,
        suite.space,
        suite._id,
        ops as DocumentUpdate<TestSuite>
      )
    }
    return { id: TestSuiteId.make(suite._id), updated: true }
  })

export const deleteTestSuite = (
  params: DeleteTestSuiteParams
): Effect.Effect<
  DeleteTestSuiteResult,
  TestProjectNotFoundError | TestSuiteNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const suite = yield* findTestSuite(client, project._id, params.suite, project.name)
    yield* client.removeDoc(testManagement.class.TestSuite, suite.space, suite._id)
    return { id: TestSuiteId.make(suite._id), deleted: true }
  })

// --- Test Case Operations ---

export const listTestCases = (
  params: ListTestCasesParams
): Effect.Effect<
  ListTestCasesResult,
  TestProjectNotFoundError | TestSuiteNotFoundError | PersonNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const query: DocumentQuery<TestCase> = { space: project._id }
    if (params.suite !== undefined) {
      const suite = yield* findTestSuite(client, project._id, params.suite, project.name)
      query.attachedTo = suite._id
    }
    if (params.type !== undefined) query.type = STRING_TO_TEST_CASE_TYPE[params.type]
    if (params.priority !== undefined) query.priority = STRING_TO_TEST_CASE_PRIORITY[params.priority]
    if (params.status !== undefined) query.status = STRING_TO_TEST_CASE_STATUS[params.status]
    if (params.assignee !== undefined) {
      const person = yield* findPersonByEmailOrName(client, params.assignee)
      if (person === undefined) return { cases: [], total: 0 } // Person._id is Ref<Person> at runtime; assignee field stores the same string
      ;(query as Record<string, unknown>).assignee = person._id
    }
    const cases = yield* client.findAll<TestCase>(
      testManagement.class.TestCase,
      query,
      { limit: clampLimit(params.limit), sort: { modifiedOn: SortingOrder.Descending } }
    )
    const summaries: Array<TestCaseSummary> = []
    for (const tc of cases) {
      const assigneeName = yield* resolveAssigneeName(client, tc.assignee)
      summaries.push({
        id: TestCaseId.make(tc._id),
        name: tc.name,
        type: typeToString(tc.type),
        priority: priorityToString(tc.priority),
        status: statusToString(tc.status),
        assignee: assigneeName
      })
    }
    return { cases: summaries, total: cases.total }
  })

export const getTestCase = (
  params: GetTestCaseParams
): Effect.Effect<TestCaseDetail, TestProjectNotFoundError | TestCaseNotFoundError | HulyClientError, HulyClient> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const tc = yield* findTestCase(client, project._id, params.testCase)
    let description: string | undefined
    if (tc.description) {
      // description field stores a MarkupBlobRef (branded string) at runtime
      description = yield* client.fetchMarkup(
        testManagement.class.TestCase,
        tc._id,
        "description",
        tc.description as MarkupBlobRef,
        "markdown"
      )
    }
    const assigneeName = yield* resolveAssigneeName(client, tc.assignee)
    return {
      id: TestCaseId.make(tc._id),
      name: tc.name,
      description,
      type: typeToString(tc.type),
      priority: priorityToString(tc.priority),
      status: statusToString(tc.status),
      assignee: assigneeName
    }
  })

const DEFAULT_TYPE = 0 // functional
const DEFAULT_PRIORITY = 1 // medium
const DEFAULT_STATUS = 0 // draft

export const createTestCase = (
  params: CreateTestCaseParams
): Effect.Effect<
  CreateTestCaseResult,
  TestProjectNotFoundError | TestSuiteNotFoundError | PersonNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const suite = yield* findTestSuite(client, project._id, params.suite, project.name)
    const caseId: Ref<TestCase> = generateId()
    let descriptionRef: MarkupBlobRef | null = null
    if (params.description !== undefined && params.description.trim() !== "") {
      descriptionRef = yield* client.uploadMarkup(
        testManagement.class.TestCase,
        caseId,
        "description",
        params.description,
        "markdown"
      ) as Effect.Effect<MarkupBlobRef, HulyClientError>
    }
    let assigneeRef: string | null = null
    if (params.assignee !== undefined) {
      assigneeRef = yield* resolveAssigneeRef(client, params.assignee)
    }
    // AttachedData strips Doc/AttachedDoc base fields. Our TestCase interface is opaque (hardcoded class IDs,
    // no npm package), so the literal can't satisfy the generic constraint without a cast.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- opaque interface boundary
    const caseData = {
      name: params.name,
      description: descriptionRef ?? "",
      type: params.type !== undefined ? STRING_TO_TEST_CASE_TYPE[params.type] : DEFAULT_TYPE,
      priority: params.priority !== undefined ? STRING_TO_TEST_CASE_PRIORITY[params.priority] : DEFAULT_PRIORITY,
      status: params.status !== undefined ? STRING_TO_TEST_CASE_STATUS[params.status] : DEFAULT_STATUS,
      assignee: assigneeRef
    } as AttachedData<TestCase>
    yield* client.addCollection(
      testManagement.class.TestCase,
      project._id,
      suite._id,
      testManagement.class.TestSuite,
      "testCases",
      caseData,
      caseId
    )
    return { id: TestCaseId.make(caseId), name: params.name }
  })

export const updateTestCase = (
  params: UpdateTestCaseParams
): Effect.Effect<
  UpdateTestCaseResult,
  TestProjectNotFoundError | TestCaseNotFoundError | PersonNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const tc = yield* findTestCase(client, project._id, params.testCase)
    const ops: Record<string, unknown> = {}
    let descriptionUpdatedInPlace = false
    if (params.name !== undefined) ops.name = params.name
    if (params.description !== undefined) {
      if (tc.description) {
        yield* client.updateMarkup(
          testManagement.class.TestCase,
          tc._id,
          "description",
          params.description,
          "markdown"
        )
        descriptionUpdatedInPlace = true
      } else {
        ops.description = yield* client.uploadMarkup(
          testManagement.class.TestCase,
          tc._id,
          "description",
          params.description,
          "markdown"
        )
      }
    }
    if (params.type !== undefined) ops.type = STRING_TO_TEST_CASE_TYPE[params.type]
    if (params.priority !== undefined) ops.priority = STRING_TO_TEST_CASE_PRIORITY[params.priority]
    if (params.status !== undefined) ops.status = STRING_TO_TEST_CASE_STATUS[params.status]
    if (params.assignee !== undefined) {
      ops.assignee = params.assignee === null ? null : yield* resolveAssigneeRef(client, params.assignee)
    }
    if (Object.keys(ops).length === 0 && !descriptionUpdatedInPlace) {
      return { id: TestCaseId.make(tc._id), updated: false }
    }
    if (Object.keys(ops).length > 0) {
      yield* client.updateDoc(
        testManagement.class.TestCase,
        tc.space,
        tc._id,
        ops as DocumentUpdate<TestCase>
      )
    }
    return { id: TestCaseId.make(tc._id), updated: true }
  })

export const deleteTestCase = (
  params: DeleteTestCaseParams
): Effect.Effect<
  DeleteTestCaseResult,
  TestProjectNotFoundError | TestCaseNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const project = yield* findTestProject(client, params.project)
    const tc = yield* findTestCase(client, project._id, params.testCase)
    yield* client.removeDoc(testManagement.class.TestCase, tc.space, tc._id)
    return { id: TestCaseId.make(tc._id), deleted: true }
  })
