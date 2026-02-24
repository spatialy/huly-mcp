import {
  createProjectParamsJsonSchema,
  deleteProjectParamsJsonSchema,
  getProjectParamsJsonSchema,
  listProjectsParamsJsonSchema,
  parseCreateProjectParams,
  parseDeleteProjectParams,
  parseGetProjectParams,
  parseListProjectsParams,
  parseUpdateProjectParams,
  updateProjectParamsJsonSchema
} from "../../domain/schemas.js"
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject
} from "../../huly/operations/projects.js"
import { createToolHandler, type RegisteredTool } from "./registry.js"

const CATEGORY = "projects" as const

export const projectTools: ReadonlyArray<RegisteredTool> = [
  {
    name: "list_projects",
    description: "List all Huly projects. Returns projects sorted by name. Supports filtering by archived status.",
    category: CATEGORY,
    inputSchema: listProjectsParamsJsonSchema,
    handler: createToolHandler(
      "list_projects",
      parseListProjectsParams,
      listProjects
    )
  },
  {
    name: "get_project",
    description:
      "Get full details of a Huly project including statuses. Returns project metadata, default status, and all available statuses.",
    category: CATEGORY,
    inputSchema: getProjectParamsJsonSchema,
    handler: createToolHandler(
      "get_project",
      parseGetProjectParams,
      getProject
    )
  },
  {
    name: "create_project",
    description:
      "Create a new Huly project with the given identifier and name. The identifier must be 1-5 uppercase characters (e.g. 'PROJ'). Creates with default Backlog status.",
    category: CATEGORY,
    inputSchema: createProjectParamsJsonSchema,
    handler: createToolHandler(
      "create_project",
      parseCreateProjectParams,
      createProject
    )
  },
  {
    name: "update_project",
    description: "Update fields on an existing Huly project. Only provided fields are modified.",
    category: CATEGORY,
    inputSchema: updateProjectParamsJsonSchema,
    handler: createToolHandler(
      "update_project",
      parseUpdateProjectParams,
      updateProject
    )
  },
  {
    name: "delete_project",
    description: "Permanently delete a Huly project and all its issues. This action cannot be undone.",
    category: CATEGORY,
    inputSchema: deleteProjectParamsJsonSchema,
    handler: createToolHandler(
      "delete_project",
      parseDeleteProjectParams,
      deleteProject
    )
  }
]
