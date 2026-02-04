import { listProjectsParamsJsonSchema, parseListProjectsParams } from "../../domain/schemas.js"
import { listProjects } from "../../huly/operations/projects.js"
import { createToolHandler, type RegisteredTool } from "./registry.js"

export const projectTools: ReadonlyArray<RegisteredTool> = [
  {
    name: "list_projects",
    description: "List all Huly projects. Returns projects sorted by name. Supports filtering by archived status.",
    inputSchema: listProjectsParamsJsonSchema,
    handler: createToolHandler(
      "list_projects",
      parseListProjectsParams,
      (params) => listProjects(params)
    )
  }
]
