import {
  addTestPlanItemParamsJsonSchema,
  createTestPlanParamsJsonSchema,
  createTestResultParamsJsonSchema,
  createTestRunParamsJsonSchema,
  deleteTestPlanParamsJsonSchema,
  deleteTestRunParamsJsonSchema,
  getTestPlanParamsJsonSchema,
  getTestResultParamsJsonSchema,
  getTestRunParamsJsonSchema,
  listTestPlansParamsJsonSchema,
  listTestResultsParamsJsonSchema,
  listTestRunsParamsJsonSchema,
  parseAddTestPlanItemParams,
  parseCreateTestPlanParams,
  parseCreateTestResultParams,
  parseCreateTestRunParams,
  parseDeleteTestPlanParams,
  parseDeleteTestRunParams,
  parseGetTestPlanParams,
  parseGetTestResultParams,
  parseGetTestRunParams,
  parseListTestPlansParams,
  parseListTestResultsParams,
  parseListTestRunsParams,
  parseRemoveTestPlanItemParams,
  parseRunTestPlanParams,
  parseUpdateTestPlanParams,
  parseUpdateTestResultParams,
  parseUpdateTestRunParams,
  removeTestPlanItemParamsJsonSchema,
  runTestPlanParamsJsonSchema,
  updateTestPlanParamsJsonSchema,
  updateTestResultParamsJsonSchema,
  updateTestRunParamsJsonSchema
} from "../../domain/schemas.js"
import {
  addTestPlanItem,
  createTestPlan,
  deleteTestPlan,
  getTestPlan,
  listTestPlans,
  removeTestPlanItem,
  updateTestPlan
} from "../../huly/operations/test-plans.js"
import {
  createTestResult,
  createTestRun,
  deleteTestRun,
  getTestResult,
  getTestRun,
  listTestResults,
  listTestRuns,
  runTestPlan,
  updateTestResult,
  updateTestRun
} from "../../huly/operations/test-runs.js"
import { createToolHandler, type RegisteredTool } from "./registry.js"

const CATEGORY = "test-management" as const

export const testPlansRunsTools: ReadonlyArray<RegisteredTool> = [
  // --- Test Plan Tools ---

  {
    name: "list_test_plans",
    description:
      "List test plans in a test project. Test plans group test cases for repeated execution (e.g., regression suites, release checklists).",
    category: CATEGORY,
    inputSchema: listTestPlansParamsJsonSchema,
    handler: createToolHandler(
      "list_test_plans",
      parseListTestPlansParams,
      listTestPlans
    )
  },
  {
    name: "get_test_plan",
    description:
      "Get full details of a test plan including its description and list of test plan items (test case references with optional assignee overrides).",
    category: CATEGORY,
    inputSchema: getTestPlanParamsJsonSchema,
    handler: createToolHandler(
      "get_test_plan",
      parseGetTestPlanParams,
      getTestPlan
    )
  },
  {
    name: "create_test_plan",
    description:
      "Create an empty test plan in a test project. After creation, use add_test_plan_item to add test cases to it. Description supports markdown.",
    category: CATEGORY,
    inputSchema: createTestPlanParamsJsonSchema,
    handler: createToolHandler(
      "create_test_plan",
      parseCreateTestPlanParams,
      createTestPlan
    )
  },
  {
    name: "update_test_plan",
    description:
      "Update a test plan's name or description. Only provided fields are modified. Description supports markdown.",
    category: CATEGORY,
    inputSchema: updateTestPlanParamsJsonSchema,
    handler: createToolHandler(
      "update_test_plan",
      parseUpdateTestPlanParams,
      updateTestPlan
    )
  },
  {
    name: "delete_test_plan",
    description: "Permanently delete a test plan and its items. This action cannot be undone.",
    category: CATEGORY,
    inputSchema: deleteTestPlanParamsJsonSchema,
    handler: createToolHandler(
      "delete_test_plan",
      parseDeleteTestPlanParams,
      deleteTestPlan
    )
  },
  {
    name: "add_test_plan_item",
    description:
      "Add a test case to a test plan. Automatically captures the test case's parent suite. Optionally override the assignee for this plan.",
    category: CATEGORY,
    inputSchema: addTestPlanItemParamsJsonSchema,
    handler: createToolHandler(
      "add_test_plan_item",
      parseAddTestPlanItemParams,
      addTestPlanItem
    )
  },
  {
    name: "remove_test_plan_item",
    description: "Remove a test case from a test plan by its item ID. Use get_test_plan to find item IDs.",
    category: CATEGORY,
    inputSchema: removeTestPlanItemParamsJsonSchema,
    handler: createToolHandler(
      "remove_test_plan_item",
      parseRemoveTestPlanItemParams,
      removeTestPlanItem
    )
  },

  // --- Test Run Tools ---

  {
    name: "list_test_runs",
    description:
      "List test runs in a test project. Test runs track the execution of test cases with pass/fail results.",
    category: CATEGORY,
    inputSchema: listTestRunsParamsJsonSchema,
    handler: createToolHandler(
      "list_test_runs",
      parseListTestRunsParams,
      listTestRuns
    )
  },
  {
    name: "get_test_run",
    description:
      "Get full details of a test run including its description and due date. Use list_test_results to see results within the run.",
    category: CATEGORY,
    inputSchema: getTestRunParamsJsonSchema,
    handler: createToolHandler(
      "get_test_run",
      parseGetTestRunParams,
      getTestRun
    )
  },
  {
    name: "create_test_run",
    description:
      "Create an empty test run. After creation, use create_test_result to add results, or use run_test_plan to create a pre-populated run from a test plan.",
    category: CATEGORY,
    inputSchema: createTestRunParamsJsonSchema,
    handler: createToolHandler(
      "create_test_run",
      parseCreateTestRunParams,
      createTestRun
    )
  },
  {
    name: "update_test_run",
    description:
      "Update a test run's name, description, or due date. Set dueDate to null to clear it. Only provided fields are modified.",
    category: CATEGORY,
    inputSchema: updateTestRunParamsJsonSchema,
    handler: createToolHandler(
      "update_test_run",
      parseUpdateTestRunParams,
      updateTestRun
    )
  },
  {
    name: "delete_test_run",
    description: "Permanently delete a test run and all its results. This action cannot be undone.",
    category: CATEGORY,
    inputSchema: deleteTestRunParamsJsonSchema,
    handler: createToolHandler(
      "delete_test_run",
      parseDeleteTestRunParams,
      deleteTestRun
    )
  },

  // --- Test Result Tools ---

  {
    name: "list_test_results",
    description:
      "List test results in a test run. Filter by status (untested/blocked/passed/failed) or assignee. Each result links to a test case.",
    category: CATEGORY,
    inputSchema: listTestResultsParamsJsonSchema,
    handler: createToolHandler(
      "list_test_results",
      parseListTestResultsParams,
      listTestResults
    )
  },
  {
    name: "get_test_result",
    description: "Get full details of a test result including description, status, linked test case, and assignee.",
    category: CATEGORY,
    inputSchema: getTestResultParamsJsonSchema,
    handler: createToolHandler(
      "get_test_result",
      parseGetTestResultParams,
      getTestResult
    )
  },
  {
    name: "create_test_result",
    description:
      "Add a test result to a test run. Links to an existing test case. Defaults to status=untested. Name is inherited from the test case.",
    category: CATEGORY,
    inputSchema: createTestResultParamsJsonSchema,
    handler: createToolHandler(
      "create_test_result",
      parseCreateTestResultParams,
      createTestResult
    )
  },
  {
    name: "update_test_result",
    description:
      "Update a test result's status, assignee, or description. Use this to record pass/fail outcomes. Set assignee to null to unassign.",
    category: CATEGORY,
    inputSchema: updateTestResultParamsJsonSchema,
    handler: createToolHandler(
      "update_test_result",
      parseUpdateTestResultParams,
      updateTestResult
    )
  },

  // --- Compound Tools ---

  {
    name: "run_test_plan",
    description:
      "Create a test run from a test plan. Copies all test plan items into the run as test results with status=untested. This is the primary way to execute a test plan — one call creates a fully populated test run ready for testing.",
    category: CATEGORY,
    inputSchema: runTestPlanParamsJsonSchema,
    handler: createToolHandler(
      "run_test_plan",
      parseRunTestPlanParams,
      runTestPlan
    )
  }
]
