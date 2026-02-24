/**
 * Card domain operations for Huly MCP server.
 *
 * Provides typed operations for querying and managing cards from Huly platform.
 * Cards have dynamic types (MasterTags) with custom fields per type.
 *
 * @module
 */
import type { Card as HulyCard, MasterTag as HulyMasterTag } from "@hcengineering/card"
import {
  type Class,
  type Data,
  type DocumentQuery,
  type DocumentUpdate,
  generateId,
  type MarkupBlobRef,
  type Ref,
  SortingOrder
} from "@hcengineering/core"
import { makeRank } from "@hcengineering/rank"
import { Effect } from "effect"

import type {
  CardDetail,
  CardSummary,
  CardTypeSummary,
  CreateCardParams,
  DeleteCardParams,
  GetCardParams,
  ListCardsParams,
  ListCardsResult,
  ListCardTypesParams,
  ListCardTypesResult,
  UpdateCardParams
} from "../../domain/schemas.js"
import type { CreateCardResult, DeleteCardResult, UpdateCardResult } from "../../domain/schemas/cards.js"
import { CardId, CardTypeId } from "../../domain/schemas/cards.js"
import { HulyClient, type HulyClientError } from "../client.js"
import { CardNotFoundError, CardTypeNotFoundError } from "../errors.js"
import { clampLimit, findByNameOrId, toRef } from "./shared.js"

import { card } from "../huly-plugins.js"

type ListCardTypesError = HulyClientError

type ListCardsError =
  | HulyClientError
  | CardTypeNotFoundError

type GetCardError =
  | HulyClientError
  | CardNotFoundError

type CreateCardError =
  | HulyClientError
  | CardTypeNotFoundError

type UpdateCardError =
  | HulyClientError
  | CardNotFoundError

type DeleteCardError =
  | HulyClientError
  | CardNotFoundError

const findCard = (
  identifier: string
): Effect.Effect<
  { client: HulyClient["Type"]; foundCard: HulyCard },
  CardNotFoundError | HulyClientError,
  HulyClient
> =>
  Effect.gen(function*() {
    const client = yield* HulyClient

    const foundCard = yield* findByNameOrId(
      client,
      card.class.Card,
      { title: identifier },
      { _id: toRef<HulyCard>(identifier) }
    )

    if (foundCard === undefined) {
      return yield* new CardNotFoundError({ identifier })
    }

    return { client, foundCard }
  })

const findMasterTag = (
  client: HulyClient["Type"],
  identifier: string
): Effect.Effect<HulyMasterTag, CardTypeNotFoundError | HulyClientError> =>
  Effect.gen(function*() {
    // MasterTag._id is Ref<Class<Card>>, but findAll matches against string IDs at runtime.
    // Query all non-removed types and filter by ID to avoid a double type assertion.
    const allTypes = yield* client.findAll<HulyMasterTag>(
      card.class.MasterTag,
      { removed: { $ne: true } }
    )

    const byId = allTypes.find((t) => t._id === identifier)
    if (byId !== undefined) return byId

    return yield* new CardTypeNotFoundError({ identifier })
  })

const resolveMasterTagLabel = (masterTag: HulyMasterTag): string =>
  // MasterTag.label is an IntlString (plugin ID ref), not human-readable.
  // Use the _id as a best-effort label since the class name is embedded in it.
  masterTag._id.split(":").pop() ?? masterTag._id

export const listCardTypes = (
  params: ListCardTypesParams
): Effect.Effect<ListCardTypesResult, ListCardTypesError, HulyClient> =>
  Effect.gen(function*() {
    const client = yield* HulyClient

    const limit = clampLimit(params.limit)

    const types = yield* client.findAll<HulyMasterTag>(
      card.class.MasterTag,
      { removed: { $ne: true } },
      { limit }
    )

    const summaries: Array<CardTypeSummary> = types.map((t) => ({
      id: CardTypeId.make(t._id),
      label: resolveMasterTagLabel(t)
    }))

    return { types: summaries, total: types.total }
  })

export const listCards = (
  params: ListCardsParams
): Effect.Effect<ListCardsResult, ListCardsError, HulyClient> =>
  Effect.gen(function*() {
    const client = yield* HulyClient

    const limit = clampLimit(params.limit)

    const query: DocumentQuery<HulyCard> = {}

    if (params.type !== undefined) {
      const masterTag = yield* findMasterTag(client, params.type)
      query._class = masterTag._id
    }

    const cards = yield* client.findAll<HulyCard>(
      card.class.Card,
      query,
      {
        limit,
        sort: { modifiedOn: SortingOrder.Descending }
      }
    )

    // Build a map of class refs to names for display
    const classRefs = [...new Set(cards.map((c) => c._class))]
    const masterTags = classRefs.length > 0
      ? yield* client.findAll<HulyMasterTag>(
        card.class.MasterTag,
        { _id: { $in: classRefs } }
      )
      : []
    const classNameMap = new Map(
      masterTags.map((t) => [t._id, resolveMasterTagLabel(t)])
    )

    const summaries: Array<CardSummary> = cards.map((c) => ({
      id: CardId.make(c._id),
      title: c.title,
      type: classNameMap.get(c._class) ?? c._class,
      modifiedOn: c.modifiedOn
    }))

    return { cards: summaries, total: cards.total }
  })

export const getCard = (
  params: GetCardParams
): Effect.Effect<CardDetail, GetCardError, HulyClient> =>
  Effect.gen(function*() {
    const { client, foundCard: c } = yield* findCard(params.card)

    // Resolve type name
    const masterTag = yield* client.findOne<HulyMasterTag>(
      card.class.MasterTag,
      { _id: c._class }
    )
    const typeName = masterTag ? resolveMasterTagLabel(masterTag) : c._class

    let content: string | undefined
    if (c.content) {
      content = yield* client.fetchMarkup(
        c._class,
        c._id,
        "content",
        c.content,
        "markdown"
      )
    }

    return {
      id: CardId.make(c._id),
      title: c.title,
      type: typeName,
      content,
      modifiedOn: c.modifiedOn,
      createdOn: c.createdOn
    }
  })

export const createCard = (
  params: CreateCardParams
): Effect.Effect<CreateCardResult, CreateCardError, HulyClient> =>
  Effect.gen(function*() {
    const client = yield* HulyClient

    // Resolve the card type
    let masterTagRef: Ref<Class<HulyCard>>
    if (params.type !== undefined) {
      const masterTag = yield* findMasterTag(client, params.type)
      masterTagRef = masterTag._id
    } else {
      // Default to the first available MasterTag
      const defaultType = yield* client.findOne<HulyMasterTag>(
        card.class.MasterTag,
        { removed: { $ne: true } }
      )
      if (defaultType === undefined) {
        return yield* new CardTypeNotFoundError({ identifier: "(default)" })
      }
      masterTagRef = defaultType._id
    }

    const cardId: Ref<HulyCard> = generateId()

    // Get rank for ordering
    const lastCard = yield* client.findOne<HulyCard>(
      card.class.Card,
      {},
      { sort: { rank: SortingOrder.Descending } }
    )
    const rank = makeRank(lastCard?.rank, undefined)

    let contentMarkupRef: MarkupBlobRef | null = null
    if (params.content !== undefined && params.content.trim() !== "") {
      contentMarkupRef = yield* client.uploadMarkup(
        masterTagRef,
        cardId,
        "content",
        params.content,
        "markdown"
      )
    }

    const cardData: Data<HulyCard> = {
      title: params.title,
      content: contentMarkupRef ?? ("" as MarkupBlobRef),
      blobs: {},
      parentInfo: [],
      rank
    }

    yield* client.createDoc(
      masterTagRef,
      card.space.Default,
      cardData,
      cardId
    )

    return { id: CardId.make(cardId), title: params.title }
  })

export const updateCard = (
  params: UpdateCardParams
): Effect.Effect<UpdateCardResult, UpdateCardError, HulyClient> =>
  Effect.gen(function*() {
    const { client, foundCard: c } = yield* findCard(params.card)

    const updateOps: DocumentUpdate<HulyCard> = {}
    let contentUpdatedInPlace = false

    if (params.title !== undefined) {
      updateOps.title = params.title
    }

    if (params.content !== undefined) {
      if (c.content) {
        yield* client.updateMarkup(
          c._class,
          c._id,
          "content",
          params.content,
          "markdown"
        )
        contentUpdatedInPlace = true
      } else {
        const contentMarkupRef = yield* client.uploadMarkup(
          c._class,
          c._id,
          "content",
          params.content,
          "markdown"
        )
        updateOps.content = contentMarkupRef
      }
    }

    if (Object.keys(updateOps).length === 0 && !contentUpdatedInPlace) {
      return { id: CardId.make(c._id), updated: false }
    }

    if (Object.keys(updateOps).length > 0) {
      yield* client.updateDoc(
        c._class,
        c.space,
        c._id,
        updateOps
      )
    }

    return { id: CardId.make(c._id), updated: true }
  })

export const deleteCard = (
  params: DeleteCardParams
): Effect.Effect<DeleteCardResult, DeleteCardError, HulyClient> =>
  Effect.gen(function*() {
    const { client, foundCard: c } = yield* findCard(params.card)

    yield* client.removeDoc(
      c._class,
      c.space,
      c._id
    )

    return { id: CardId.make(c._id), deleted: true }
  })
