import {
  createTestCaseParamsJsonSchema,
  createTestSuiteParamsJsonSchema,
  deleteTestCaseParamsJsonSchema,
  deleteTestSuiteParamsJsonSchema,
  getTestCaseParamsJsonSchema,
  getTestSuiteParamsJsonSchema,
  listTestCasesParamsJsonSchema,
  listTestProjectsParamsJsonSchema,
  listTestSuitesParamsJsonSchema,
  parseCreateTestCaseParams,
  parseCreateTestSuiteParams,
  parseDeleteTestCaseParams,
  parseDeleteTestSuiteParams,
  parseGetTestCaseParams,
  parseGetTestSuiteParams,
  parseListTestCasesParams,
  parseListTestProjectsParams,
  parseListTestSuitesParams,
  parseUpdateTestCaseParams,
  parseUpdateTestSuiteParams,
  updateTestCaseParamsJsonSchema,
  updateTestSuiteParamsJsonSchema
} from "../../domain/schemas.js"
import {
  createTestCase,
  createTestSuite,
  deleteTestCase,
  deleteTestSuite,
  getTestCase,
  getTestSuite,
  listTestCases,
  listTestProjects,
  listTestSuites,
  updateTestCase,
  updateTestSuite
} from "../../huly/operations/test-management.js"
import { createToolHandler, type RegisteredTool } from "./registry.js"

const CATEGORY = "test-management" as const

export const testManagementTools: ReadonlyArray<RegisteredTool> = [
  {
    name: "list_test_projects",
    description:
      "List test management projects in the Huly workspace. These are separate from tracker projects — they contain test suites and test cases.",
    category: CATEGORY,
    inputSchema: listTestProjectsParamsJsonSchema,
    handler: createToolHandler(
      "list_test_projects",
      parseListTestProjectsParams,
      listTestProjects
    )
  },
  {
    name: "list_test_suites",
    description:
      "List test suites in a test project. Optionally filter by parent suite to see only nested suites. Returns suites sorted by name.",
    category: CATEGORY,
    inputSchema: listTestSuitesParamsJsonSchema,
    handler: createToolHandler(
      "list_test_suites",
      parseListTestSuitesParams,
      listTestSuites
    )
  },
  {
    name: "get_test_suite",
    description:
      "Get full details of a test suite including its markdown description. Look up by name or ID within a test project.",
    category: CATEGORY,
    inputSchema: getTestSuiteParamsJsonSchema,
    handler: createToolHandler(
      "get_test_suite",
      parseGetTestSuiteParams,
      getTestSuite
    )
  },
  {
    name: "create_test_suite",
    description:
      "Create a new test suite in a test project. Supports nesting via the parent parameter. Description supports markdown.",
    category: CATEGORY,
    inputSchema: createTestSuiteParamsJsonSchema,
    handler: createToolHandler(
      "create_test_suite",
      parseCreateTestSuiteParams,
      createTestSuite
    )
  },
  {
    name: "update_test_suite",
    description:
      "Update a test suite's name or description. Only provided fields are modified. Description supports markdown.",
    category: CATEGORY,
    inputSchema: updateTestSuiteParamsJsonSchema,
    handler: createToolHandler(
      "update_test_suite",
      parseUpdateTestSuiteParams,
      updateTestSuite
    )
  },
  {
    name: "delete_test_suite",
    description: "Permanently delete a test suite from a test project. This action cannot be undone.",
    category: CATEGORY,
    inputSchema: deleteTestSuiteParamsJsonSchema,
    handler: createToolHandler(
      "delete_test_suite",
      parseDeleteTestSuiteParams,
      deleteTestSuite
    )
  },
  {
    name: "list_test_cases",
    description:
      "List test cases in a test project. Filter by suite, type (functional/performance/regression/security/smoke/usability), priority (low/medium/high/urgent), status (draft/ready-for-review/fix-review-comments/approved/rejected), or assignee.",
    category: CATEGORY,
    inputSchema: listTestCasesParamsJsonSchema,
    handler: createToolHandler(
      "list_test_cases",
      parseListTestCasesParams,
      listTestCases
    )
  },
  {
    name: "get_test_case",
    description:
      "Get full details of a test case including its markdown description, type, priority, status, and assignee. Look up by name or ID.",
    category: CATEGORY,
    inputSchema: getTestCaseParamsJsonSchema,
    handler: createToolHandler(
      "get_test_case",
      parseGetTestCaseParams,
      getTestCase
    )
  },
  {
    name: "create_test_case",
    description:
      "Create a new test case in a test suite. Defaults: type=functional, priority=medium, status=draft. Description supports markdown. Assignee resolved by email or name.",
    category: CATEGORY,
    inputSchema: createTestCaseParamsJsonSchema,
    handler: createToolHandler(
      "create_test_case",
      parseCreateTestCaseParams,
      createTestCase
    )
  },
  {
    name: "update_test_case",
    description:
      "Update fields on a test case. Only provided fields are modified. Set assignee to null to unassign. Description supports markdown.",
    category: CATEGORY,
    inputSchema: updateTestCaseParamsJsonSchema,
    handler: createToolHandler(
      "update_test_case",
      parseUpdateTestCaseParams,
      updateTestCase
    )
  },
  {
    name: "delete_test_case",
    description: "Permanently delete a test case. This action cannot be undone.",
    category: CATEGORY,
    inputSchema: deleteTestCaseParamsJsonSchema,
    handler: createToolHandler(
      "delete_test_case",
      parseDeleteTestCaseParams,
      deleteTestCase
    )
  }
]
