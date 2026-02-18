import { JSONSchema, Schema } from "effect"

import { LimitParam, ProjectIdentifier, StatusName } from "./shared.js"

// No codec needed — internal type, not used for runtime validation
export interface ProjectSummary {
  readonly identifier: ProjectIdentifier
  readonly name: string
  readonly description?: string | undefined
  readonly archived: boolean
}

export const ListProjectsParamsSchema = Schema.Struct({
  includeArchived: Schema.optional(Schema.Boolean.annotations({
    description: "Include archived projects in results (default: false, showing only active)"
  })),
  limit: Schema.optional(
    LimitParam.annotations({
      description: "Maximum number of projects to return (default: 50)"
    })
  )
}).annotations({
  title: "ListProjectsParams",
  description: "Parameters for listing projects"
})

export type ListProjectsParams = Schema.Schema.Type<typeof ListProjectsParamsSchema>

export interface ListProjectsResult {
  readonly projects: ReadonlyArray<ProjectSummary>
  readonly total: number
}

export const ProjectSchema = Schema.Struct({
  identifier: ProjectIdentifier,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  archived: Schema.Boolean,
  defaultStatus: Schema.optional(StatusName),
  statuses: Schema.optional(Schema.Array(StatusName))
}).annotations({
  title: "Project",
  description: "Full project with status information"
})

export type Project = Schema.Schema.Type<typeof ProjectSchema>

export const listProjectsParamsJsonSchema = JSONSchema.make(ListProjectsParamsSchema)

export const parseListProjectsParams = Schema.decodeUnknown(ListProjectsParamsSchema)
export const parseProject = Schema.decodeUnknown(ProjectSchema)
