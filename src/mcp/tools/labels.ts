import {
  createLabelParamsJsonSchema,
  deleteLabelParamsJsonSchema,
  listLabelsParamsJsonSchema,
  parseCreateLabelParams,
  parseDeleteLabelParams,
  parseListLabelsParams,
  parseUpdateLabelParams,
  updateLabelParamsJsonSchema
} from "../../domain/schemas.js"
import { createLabel, deleteLabel, listLabels, updateLabel } from "../../huly/operations/labels.js"
import { createToolHandler, type RegisteredTool } from "./registry.js"

const CATEGORY = "labels" as const

export const labelTools: ReadonlyArray<RegisteredTool> = [
  {
    name: "list_labels",
    description:
      "List label/tag definitions in the workspace. Labels are global (not project-scoped). Returns labels for tracker issues sorted by modification date (newest first).",
    category: CATEGORY,
    inputSchema: listLabelsParamsJsonSchema,
    handler: createToolHandler(
      "list_labels",
      parseListLabelsParams,
      listLabels
    )
  },
  {
    name: "create_label",
    description:
      "Create a new label/tag definition in the workspace. Labels are global and can be attached to any issue. Returns existing label if one with the same title already exists (created=false). Use add_issue_label to attach a label to a specific issue.",
    category: CATEGORY,
    inputSchema: createLabelParamsJsonSchema,
    handler: createToolHandler(
      "create_label",
      parseCreateLabelParams,
      createLabel
    )
  },
  {
    name: "update_label",
    description: "Update a label/tag definition. Accepts label ID or title. Only provided fields are modified.",
    category: CATEGORY,
    inputSchema: updateLabelParamsJsonSchema,
    handler: createToolHandler(
      "update_label",
      parseUpdateLabelParams,
      updateLabel
    )
  },
  {
    name: "delete_label",
    description: "Permanently delete a label/tag definition. Accepts label ID or title. This action cannot be undone.",
    category: CATEGORY,
    inputSchema: deleteLabelParamsJsonSchema,
    handler: createToolHandler(
      "delete_label",
      parseDeleteLabelParams,
      deleteLabel
    )
  }
]
