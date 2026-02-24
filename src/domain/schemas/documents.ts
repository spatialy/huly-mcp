import { JSONSchema, Schema } from "effect"

import type { DocumentId, TeamspaceId } from "./shared.js"
import { DocumentIdentifier, LimitParam, NonEmptyString, TeamspaceIdentifier } from "./shared.js"

// No codec needed — internal type, not used for runtime validation
export interface TeamspaceSummary {
  readonly id: TeamspaceId
  readonly name: string
  readonly description?: string | undefined
  readonly archived: boolean
  readonly private: boolean
}

export const ListTeamspacesParamsSchema = Schema.Struct({
  includeArchived: Schema.optional(Schema.Boolean.annotations({
    description: "Include archived teamspaces in results (default: false, showing only active)"
  })),
  limit: Schema.optional(
    LimitParam.annotations({
      description: "Maximum number of teamspaces to return (default: 50)"
    })
  )
}).annotations({
  title: "ListTeamspacesParams",
  description: "Parameters for listing teamspaces"
})

export type ListTeamspacesParams = Schema.Schema.Type<typeof ListTeamspacesParamsSchema>

export interface ListTeamspacesResult {
  readonly teamspaces: ReadonlyArray<TeamspaceSummary>
  readonly total: number
}

export interface DocumentSummary {
  readonly id: DocumentId
  readonly title: string
  readonly teamspace: string
  readonly modifiedOn?: number | undefined
}

export const ListDocumentsParamsSchema = Schema.Struct({
  teamspace: TeamspaceIdentifier.annotations({
    description: "Teamspace name or ID"
  }),
  titleSearch: Schema.optional(Schema.String.annotations({
    description: "Search documents by title substring (case-insensitive)"
  })),
  contentSearch: Schema.optional(Schema.String.annotations({
    description: "Search documents by content (fulltext search)"
  })),
  limit: Schema.optional(
    LimitParam.annotations({
      description: "Maximum number of documents to return (default: 50)"
    })
  )
}).annotations({
  title: "ListDocumentsParams",
  description: "Parameters for listing documents in a teamspace"
})

export type ListDocumentsParams = Schema.Schema.Type<typeof ListDocumentsParamsSchema>

export interface ListDocumentsResult {
  readonly documents: ReadonlyArray<DocumentSummary>
  readonly total: number
}

export interface Document {
  readonly id: DocumentId
  readonly title: string
  readonly content?: string | undefined
  readonly teamspace: string
  readonly modifiedOn?: number | undefined
  readonly createdOn?: number | undefined
}

export const GetDocumentParamsSchema = Schema.Struct({
  teamspace: TeamspaceIdentifier.annotations({
    description: "Teamspace name or ID"
  }),
  document: DocumentIdentifier.annotations({
    description: "Document title or ID"
  })
}).annotations({
  title: "GetDocumentParams",
  description: "Parameters for getting a single document"
})

export type GetDocumentParams = Schema.Schema.Type<typeof GetDocumentParamsSchema>

export const CreateDocumentParamsSchema = Schema.Struct({
  teamspace: TeamspaceIdentifier.annotations({
    description: "Teamspace name or ID"
  }),
  title: NonEmptyString.annotations({
    description: "Document title"
  }),
  content: Schema.optional(Schema.String.annotations({
    description: "Document content (markdown supported)"
  }))
}).annotations({
  title: "CreateDocumentParams",
  description: "Parameters for creating a document"
})

export type CreateDocumentParams = Schema.Schema.Type<typeof CreateDocumentParamsSchema>

export const UpdateDocumentParamsSchema = Schema.Struct({
  teamspace: TeamspaceIdentifier.annotations({
    description: "Teamspace name or ID"
  }),
  document: DocumentIdentifier.annotations({
    description: "Document title or ID"
  }),
  title: Schema.optional(NonEmptyString.annotations({
    description: "New document title"
  })),
  content: Schema.optional(Schema.String.annotations({
    description: "New document content (markdown supported)"
  }))
}).annotations({
  title: "UpdateDocumentParams",
  description: "Parameters for updating a document"
})

export type UpdateDocumentParams = Schema.Schema.Type<typeof UpdateDocumentParamsSchema>

export const DeleteDocumentParamsSchema = Schema.Struct({
  teamspace: TeamspaceIdentifier.annotations({
    description: "Teamspace name or ID"
  }),
  document: DocumentIdentifier.annotations({
    description: "Document title or ID"
  })
}).annotations({
  title: "DeleteDocumentParams",
  description: "Parameters for deleting a document"
})

export type DeleteDocumentParams = Schema.Schema.Type<typeof DeleteDocumentParamsSchema>

export const listTeamspacesParamsJsonSchema = JSONSchema.make(ListTeamspacesParamsSchema)
export const listDocumentsParamsJsonSchema = JSONSchema.make(ListDocumentsParamsSchema)
export const getDocumentParamsJsonSchema = JSONSchema.make(GetDocumentParamsSchema)
export const createDocumentParamsJsonSchema = JSONSchema.make(CreateDocumentParamsSchema)
export const updateDocumentParamsJsonSchema = JSONSchema.make(UpdateDocumentParamsSchema)
export const deleteDocumentParamsJsonSchema = JSONSchema.make(DeleteDocumentParamsSchema)

export const parseListTeamspacesParams = Schema.decodeUnknown(ListTeamspacesParamsSchema)
export const parseListDocumentsParams = Schema.decodeUnknown(ListDocumentsParamsSchema)
export const parseGetDocumentParams = Schema.decodeUnknown(GetDocumentParamsSchema)
export const parseCreateDocumentParams = Schema.decodeUnknown(CreateDocumentParamsSchema)
export const parseUpdateDocumentParams = Schema.decodeUnknown(UpdateDocumentParamsSchema)
export const parseDeleteDocumentParams = Schema.decodeUnknown(DeleteDocumentParamsSchema)

// No codec needed — internal type, not used for runtime validation
export interface CreateDocumentResult {
  readonly id: DocumentId
  readonly title: string
}

export interface UpdateDocumentResult {
  readonly id: DocumentId
  readonly updated: boolean
}

export interface DeleteDocumentResult {
  readonly id: DocumentId
  readonly deleted: boolean
}

// --- Teamspace CRUD Schemas ---

export const GetTeamspaceParamsSchema = Schema.Struct({
  teamspace: TeamspaceIdentifier.annotations({
    description: "Teamspace name or ID"
  })
}).annotations({
  title: "GetTeamspaceParams",
  description: "Parameters for getting a single teamspace"
})

export type GetTeamspaceParams = Schema.Schema.Type<typeof GetTeamspaceParamsSchema>

export interface Teamspace {
  readonly id: TeamspaceId
  readonly name: string
  readonly description?: string | undefined
  readonly archived: boolean
  readonly private: boolean
}

export const CreateTeamspaceParamsSchema = Schema.Struct({
  name: NonEmptyString.annotations({
    description: "Teamspace name"
  }),
  description: Schema.optional(Schema.String.annotations({
    description: "Teamspace description"
  })),
  private: Schema.optional(Schema.Boolean.annotations({
    description: "Whether the teamspace is private (default: false)"
  }))
}).annotations({
  title: "CreateTeamspaceParams",
  description: "Parameters for creating a teamspace"
})

export type CreateTeamspaceParams = Schema.Schema.Type<typeof CreateTeamspaceParamsSchema>

export interface CreateTeamspaceResult {
  readonly id: TeamspaceId
  readonly name: string
}

export const UpdateTeamspaceParamsSchema = Schema.Struct({
  teamspace: TeamspaceIdentifier.annotations({
    description: "Teamspace name or ID"
  }),
  name: Schema.optional(NonEmptyString.annotations({
    description: "New teamspace name"
  })),
  description: Schema.optional(Schema.String.annotations({
    description: "New teamspace description"
  }))
}).annotations({
  title: "UpdateTeamspaceParams",
  description: "Parameters for updating a teamspace"
})

export type UpdateTeamspaceParams = Schema.Schema.Type<typeof UpdateTeamspaceParamsSchema>

export interface UpdateTeamspaceResult {
  readonly id: TeamspaceId
  readonly updated: boolean
}

export const DeleteTeamspaceParamsSchema = Schema.Struct({
  teamspace: TeamspaceIdentifier.annotations({
    description: "Teamspace name or ID"
  })
}).annotations({
  title: "DeleteTeamspaceParams",
  description: "Parameters for deleting a teamspace"
})

export type DeleteTeamspaceParams = Schema.Schema.Type<typeof DeleteTeamspaceParamsSchema>

export interface DeleteTeamspaceResult {
  readonly id: TeamspaceId
  readonly deleted: boolean
}

export const getTeamspaceParamsJsonSchema = JSONSchema.make(GetTeamspaceParamsSchema)
export const createTeamspaceParamsJsonSchema = JSONSchema.make(CreateTeamspaceParamsSchema)
export const updateTeamspaceParamsJsonSchema = JSONSchema.make(UpdateTeamspaceParamsSchema)
export const deleteTeamspaceParamsJsonSchema = JSONSchema.make(DeleteTeamspaceParamsSchema)

export const parseGetTeamspaceParams = Schema.decodeUnknown(GetTeamspaceParamsSchema)
export const parseCreateTeamspaceParams = Schema.decodeUnknown(CreateTeamspaceParamsSchema)
export const parseUpdateTeamspaceParams = Schema.decodeUnknown(UpdateTeamspaceParamsSchema)
export const parseDeleteTeamspaceParams = Schema.decodeUnknown(DeleteTeamspaceParamsSchema)
