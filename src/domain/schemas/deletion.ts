import { JSONSchema, Schema } from "effect"

import { ProjectIdentifier } from "./shared.js"

export const EntityTypeValues = ["issue", "project", "component", "milestone"] as const

export const EntityTypeSchema = Schema.Literal(...EntityTypeValues).annotations({
  title: "EntityType",
  description: "Type of entity to preview deletion for"
})

export type EntityType = Schema.Schema.Type<typeof EntityTypeSchema>

export const PreviewDeletionParamsSchema = Schema.Struct({
  entityType: EntityTypeSchema.annotations({
    description: "Type of entity: issue, project, component, or milestone"
  }),
  project: ProjectIdentifier.annotations({
    description: "Project identifier (e.g., 'HULY'). For entityType='project', this IS the target project."
  }),
  identifier: Schema.optional(Schema.String).annotations({
    description:
      "Entity identifier within the project. Required for issue (e.g., 'PROJ-123' or number), component (label or ID), milestone (label or ID). Ignored for entityType='project'."
  })
}).pipe(
  Schema.filter((params) => {
    if (params.entityType !== "project" && (params.identifier === undefined || params.identifier.trim() === "")) {
      return {
        path: ["identifier"],
        message: `identifier is required when entityType is '${params.entityType}'`
      }
    }
    return undefined
  })
).annotations({
  title: "PreviewDeletionParams",
  description: "Parameters for previewing deletion impact"
})

export type PreviewDeletionParams = Schema.Schema.Type<typeof PreviewDeletionParamsSchema>

export const DeletionImpactSchema = Schema.Struct({
  entityType: EntityTypeSchema,
  identifier: Schema.String.annotations({
    description: "The resolved identifier of the entity"
  }),
  impact: Schema.Struct({
    subIssues: Schema.optional(Schema.Number).annotations({ description: "Number of sub-issues (issue only)" }),
    comments: Schema.optional(Schema.Number).annotations({ description: "Number of comments (issue only)" }),
    attachments: Schema.optional(Schema.Number).annotations({ description: "Number of attachments (issue only)" }),
    blockedBy: Schema.optional(Schema.Number).annotations({
      description: "Number of blocking relations (issue only)"
    }),
    relations: Schema.optional(Schema.Number).annotations({ description: "Number of other relations (issue only)" }),
    issues: Schema.optional(Schema.Number).annotations({
      description: "Number of issues (project/component/milestone)"
    }),
    components: Schema.optional(Schema.Number).annotations({ description: "Number of components (project only)" }),
    milestones: Schema.optional(Schema.Number).annotations({ description: "Number of milestones (project only)" }),
    templates: Schema.optional(Schema.Number).annotations({
      description: "Number of issue templates (project only)"
    })
  }),
  warnings: Schema.Array(Schema.String).annotations({
    description: "Human-readable warnings about deletion consequences"
  }),
  totalAffected: Schema.Number.annotations({
    description: "Sum of all impact counts"
  })
}).annotations({
  title: "DeletionImpact",
  description: "Preview of what would be affected by deleting an entity"
})

export type DeletionImpact = Schema.Schema.Type<typeof DeletionImpactSchema>

export const previewDeletionParamsJsonSchema = JSONSchema.make(PreviewDeletionParamsSchema)
export const parsePreviewDeletionParams = Schema.decodeUnknown(PreviewDeletionParamsSchema)
