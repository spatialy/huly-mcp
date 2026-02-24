import { JSONSchema, Schema } from "effect"

import { LimitParam, NonEmptyString } from "./shared.js"

export const CardId = NonEmptyString.pipe(Schema.brand("CardId"))
export type CardId = Schema.Schema.Type<typeof CardId>

export const CardTypeId = NonEmptyString.pipe(Schema.brand("CardTypeId"))
export type CardTypeId = Schema.Schema.Type<typeof CardTypeId>

export interface CardTypeSummary {
  readonly id: CardTypeId
  readonly label: string
}

export const ListCardTypesParamsSchema = Schema.Struct({
  limit: Schema.optional(
    LimitParam.annotations({
      description: "Maximum number of card types to return (default: 50)"
    })
  )
}).annotations({
  title: "ListCardTypesParams",
  description: "Parameters for listing card types (MasterTags) in the workspace"
})

export type ListCardTypesParams = Schema.Schema.Type<typeof ListCardTypesParamsSchema>

export interface ListCardTypesResult {
  readonly types: ReadonlyArray<CardTypeSummary>
  readonly total: number
}

export interface CardSummary {
  readonly id: CardId
  readonly title: string
  readonly type: string
  readonly modifiedOn?: number | undefined
}

export const ListCardsParamsSchema = Schema.Struct({
  type: Schema.optional(NonEmptyString.annotations({
    description: "Filter by card type name or ID (MasterTag)"
  })),
  limit: Schema.optional(
    LimitParam.annotations({
      description: "Maximum number of cards to return (default: 50)"
    })
  )
}).annotations({
  title: "ListCardsParams",
  description: "Parameters for listing cards"
})

export type ListCardsParams = Schema.Schema.Type<typeof ListCardsParamsSchema>

export interface ListCardsResult {
  readonly cards: ReadonlyArray<CardSummary>
  readonly total: number
}

export interface CardDetail {
  readonly id: CardId
  readonly title: string
  readonly type: string
  readonly content?: string | undefined
  readonly modifiedOn?: number | undefined
  readonly createdOn?: number | undefined
}

export const GetCardParamsSchema = Schema.Struct({
  card: NonEmptyString.annotations({
    description: "Card title or ID"
  })
}).annotations({
  title: "GetCardParams",
  description: "Parameters for getting a single card"
})

export type GetCardParams = Schema.Schema.Type<typeof GetCardParamsSchema>

export const CreateCardParamsSchema = Schema.Struct({
  title: NonEmptyString.annotations({
    description: "Card title"
  }),
  type: Schema.optional(NonEmptyString.annotations({
    description: "Card type name or ID (MasterTag). If omitted, uses the default card type."
  })),
  content: Schema.optional(Schema.String.annotations({
    description: "Card content (markdown supported)"
  }))
}).annotations({
  title: "CreateCardParams",
  description: "Parameters for creating a card"
})

export type CreateCardParams = Schema.Schema.Type<typeof CreateCardParamsSchema>

export interface CreateCardResult {
  readonly id: CardId
  readonly title: string
}

export const UpdateCardParamsSchema = Schema.Struct({
  card: NonEmptyString.annotations({
    description: "Card title or ID"
  }),
  title: Schema.optional(NonEmptyString.annotations({
    description: "New card title"
  })),
  content: Schema.optional(Schema.String.annotations({
    description: "New card content (markdown supported)"
  }))
}).annotations({
  title: "UpdateCardParams",
  description: "Parameters for updating a card"
})

export type UpdateCardParams = Schema.Schema.Type<typeof UpdateCardParamsSchema>

export interface UpdateCardResult {
  readonly id: CardId
  readonly updated: boolean
}

export const DeleteCardParamsSchema = Schema.Struct({
  card: NonEmptyString.annotations({
    description: "Card title or ID"
  })
}).annotations({
  title: "DeleteCardParams",
  description: "Parameters for deleting a card"
})

export type DeleteCardParams = Schema.Schema.Type<typeof DeleteCardParamsSchema>

export interface DeleteCardResult {
  readonly id: CardId
  readonly deleted: boolean
}

export const listCardTypesParamsJsonSchema = JSONSchema.make(ListCardTypesParamsSchema)
export const listCardsParamsJsonSchema = JSONSchema.make(ListCardsParamsSchema)
export const getCardParamsJsonSchema = JSONSchema.make(GetCardParamsSchema)
export const createCardParamsJsonSchema = JSONSchema.make(CreateCardParamsSchema)
export const updateCardParamsJsonSchema = JSONSchema.make(UpdateCardParamsSchema)
export const deleteCardParamsJsonSchema = JSONSchema.make(DeleteCardParamsSchema)

export const parseListCardTypesParams = Schema.decodeUnknown(ListCardTypesParamsSchema)
export const parseListCardsParams = Schema.decodeUnknown(ListCardsParamsSchema)
export const parseGetCardParams = Schema.decodeUnknown(GetCardParamsSchema)
export const parseCreateCardParams = Schema.decodeUnknown(CreateCardParamsSchema)
export const parseUpdateCardParams = Schema.decodeUnknown(UpdateCardParamsSchema)
export const parseDeleteCardParams = Schema.decodeUnknown(DeleteCardParamsSchema)
