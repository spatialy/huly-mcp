import {
  createDocumentParamsJsonSchema,
  createTeamspaceParamsJsonSchema,
  deleteDocumentParamsJsonSchema,
  deleteTeamspaceParamsJsonSchema,
  getDocumentParamsJsonSchema,
  getTeamspaceParamsJsonSchema,
  listDocumentsParamsJsonSchema,
  listTeamspacesParamsJsonSchema,
  parseCreateDocumentParams,
  parseCreateTeamspaceParams,
  parseDeleteDocumentParams,
  parseDeleteTeamspaceParams,
  parseGetDocumentParams,
  parseGetTeamspaceParams,
  parseListDocumentsParams,
  parseListTeamspacesParams,
  parseUpdateDocumentParams,
  parseUpdateTeamspaceParams,
  updateDocumentParamsJsonSchema,
  updateTeamspaceParamsJsonSchema
} from "../../domain/schemas.js"
import {
  createDocument,
  createTeamspace,
  deleteDocument,
  deleteTeamspace,
  getDocument,
  getTeamspace,
  listDocuments,
  listTeamspaces,
  updateDocument,
  updateTeamspace
} from "../../huly/operations/documents.js"
import { createToolHandler, type RegisteredTool } from "./registry.js"

const CATEGORY = "documents" as const

export const documentTools: ReadonlyArray<RegisteredTool> = [
  {
    name: "list_teamspaces",
    description:
      "List all Huly document teamspaces. Returns teamspaces sorted by name. Supports filtering by archived status.",
    category: CATEGORY,
    inputSchema: listTeamspacesParamsJsonSchema,
    handler: createToolHandler(
      "list_teamspaces",
      parseListTeamspacesParams,
      listTeamspaces
    )
  },
  {
    name: "get_teamspace",
    description:
      "Get details of a single Huly teamspace by name or ID. Returns teamspace metadata including name, description, archived and private status.",
    category: CATEGORY,
    inputSchema: getTeamspaceParamsJsonSchema,
    handler: createToolHandler(
      "get_teamspace",
      parseGetTeamspaceParams,
      getTeamspace
    )
  },
  {
    name: "create_teamspace",
    description: "Create a new Huly document teamspace. Returns the created teamspace id and name.",
    category: CATEGORY,
    inputSchema: createTeamspaceParamsJsonSchema,
    handler: createToolHandler(
      "create_teamspace",
      parseCreateTeamspaceParams,
      createTeamspace
    )
  },
  {
    name: "update_teamspace",
    description: "Update fields on an existing Huly teamspace. Only provided fields are modified.",
    category: CATEGORY,
    inputSchema: updateTeamspaceParamsJsonSchema,
    handler: createToolHandler(
      "update_teamspace",
      parseUpdateTeamspaceParams,
      updateTeamspace
    )
  },
  {
    name: "delete_teamspace",
    description: "Permanently delete a Huly teamspace and all its documents. This action cannot be undone.",
    category: CATEGORY,
    inputSchema: deleteTeamspaceParamsJsonSchema,
    handler: createToolHandler(
      "delete_teamspace",
      parseDeleteTeamspaceParams,
      deleteTeamspace
    )
  },
  {
    name: "list_documents",
    description:
      "List documents in a Huly teamspace. Returns documents sorted by modification date (newest first). Supports searching by title substring (titleSearch) and content (contentSearch).",
    category: CATEGORY,
    inputSchema: listDocumentsParamsJsonSchema,
    handler: createToolHandler(
      "list_documents",
      parseListDocumentsParams,
      listDocuments
    )
  },
  {
    name: "get_document",
    description:
      "Retrieve full details for a Huly document including markdown content. Use this to view document content and metadata.",
    category: CATEGORY,
    inputSchema: getDocumentParamsJsonSchema,
    handler: createToolHandler(
      "get_document",
      parseGetDocumentParams,
      getDocument
    )
  },
  {
    name: "create_document",
    description:
      "Create a new document in a Huly teamspace. Content supports markdown formatting. Returns the created document id.",
    category: CATEGORY,
    inputSchema: createDocumentParamsJsonSchema,
    handler: createToolHandler(
      "create_document",
      parseCreateDocumentParams,
      createDocument
    )
  },
  {
    name: "update_document",
    description:
      "Update fields on an existing Huly document. Only provided fields are modified. Content updates support markdown.",
    category: CATEGORY,
    inputSchema: updateDocumentParamsJsonSchema,
    handler: createToolHandler(
      "update_document",
      parseUpdateDocumentParams,
      updateDocument
    )
  },
  {
    name: "delete_document",
    description: "Permanently delete a Huly document. This action cannot be undone.",
    category: CATEGORY,
    inputSchema: deleteDocumentParamsJsonSchema,
    handler: createToolHandler(
      "delete_document",
      parseDeleteDocumentParams,
      deleteDocument
    )
  }
]
