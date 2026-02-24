import {
  createCardParamsJsonSchema,
  deleteCardParamsJsonSchema,
  getCardParamsJsonSchema,
  listCardsParamsJsonSchema,
  listCardTypesParamsJsonSchema,
  parseCreateCardParams,
  parseDeleteCardParams,
  parseGetCardParams,
  parseListCardsParams,
  parseListCardTypesParams,
  parseUpdateCardParams,
  updateCardParamsJsonSchema
} from "../../domain/schemas.js"
import { createCard, deleteCard, getCard, listCards, listCardTypes, updateCard } from "../../huly/operations/cards.js"
import { createToolHandler, type RegisteredTool } from "./registry.js"

const CATEGORY = "cards" as const

export const cardTools: ReadonlyArray<RegisteredTool> = [
  {
    name: "list_card_types",
    description:
      "List available card types (MasterTags) in the Huly workspace. Use this to discover what card types exist before creating or filtering cards.",
    category: CATEGORY,
    inputSchema: listCardTypesParamsJsonSchema,
    handler: createToolHandler(
      "list_card_types",
      parseListCardTypesParams,
      listCardTypes
    )
  },
  {
    name: "list_cards",
    description:
      "List cards in the Huly workspace. Optionally filter by card type ID. Returns cards sorted by modification date (newest first).",
    category: CATEGORY,
    inputSchema: listCardsParamsJsonSchema,
    handler: createToolHandler(
      "list_cards",
      parseListCardsParams,
      listCards
    )
  },
  {
    name: "get_card",
    description: "Get full details of a Huly card including markdown content. Look up by title or ID.",
    category: CATEGORY,
    inputSchema: getCardParamsJsonSchema,
    handler: createToolHandler(
      "get_card",
      parseGetCardParams,
      getCard
    )
  },
  {
    name: "create_card",
    description:
      "Create a new card in the Huly workspace. Optionally specify a card type (MasterTag ID from list_card_types). Content supports markdown.",
    category: CATEGORY,
    inputSchema: createCardParamsJsonSchema,
    handler: createToolHandler(
      "create_card",
      parseCreateCardParams,
      createCard
    )
  },
  {
    name: "update_card",
    description:
      "Update fields on an existing Huly card. Only provided fields are modified. Content updates support markdown.",
    category: CATEGORY,
    inputSchema: updateCardParamsJsonSchema,
    handler: createToolHandler(
      "update_card",
      parseUpdateCardParams,
      updateCard
    )
  },
  {
    name: "delete_card",
    description: "Permanently delete a Huly card. This action cannot be undone.",
    category: CATEGORY,
    inputSchema: deleteCardParamsJsonSchema,
    handler: createToolHandler(
      "delete_card",
      parseDeleteCardParams,
      deleteCard
    )
  }
]
