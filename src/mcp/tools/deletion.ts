import { parsePreviewDeletionParams, previewDeletionParamsJsonSchema } from "../../domain/schemas/deletion.js"
import { previewDeletion } from "../../huly/operations/deletion.js"
import { createToolHandler, type RegisteredTool } from "./registry.js"

const CATEGORY = "issues" as const

export const deletionTools: ReadonlyArray<RegisteredTool> = [
  {
    name: "preview_deletion",
    description:
      "Preview the impact of deleting a Huly entity before actually deleting it. Shows affected sub-entities, relations, and warnings. Supports issues, projects, components, and milestones. Use this to understand cascade effects before calling a delete operation.",
    category: CATEGORY,
    inputSchema: previewDeletionParamsJsonSchema,
    handler: createToolHandler(
      "preview_deletion",
      parsePreviewDeletionParams,
      previewDeletion
    )
  }
]
