import { JSONSchema, Schema } from "effect"

import { LimitParam, NonEmptyString } from "./shared.js"

export const FulltextSearchParamsSchema = Schema.Struct({
  query: NonEmptyString.annotations({
    description: "Search query string for fulltext search"
  }),
  limit: Schema.optional(
    LimitParam.annotations({
      description: "Maximum number of results to return (default: 50)"
    })
  )
}).annotations({
  title: "FulltextSearchParams",
  description: "Parameters for fulltext search"
})

export type FulltextSearchParams = Schema.Schema.Type<typeof FulltextSearchParamsSchema>

// No codec needed — internal type, not used for runtime validation
export interface SearchResultItem {
  readonly id: string
  readonly class: string
  readonly space?: string | undefined
  readonly modifiedOn?: number | undefined
}

export interface FulltextSearchResult {
  readonly items: ReadonlyArray<SearchResultItem>
  readonly total: number
  readonly query: string
}

export const fulltextSearchParamsJsonSchema = JSONSchema.make(FulltextSearchParamsSchema)

export const parseFulltextSearchParams = Schema.decodeUnknown(FulltextSearchParamsSchema)
