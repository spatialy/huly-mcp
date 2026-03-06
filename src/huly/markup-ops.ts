import type { MarkupFormat, MarkupRef } from "@hcengineering/api-client"
import { getClient as getCollaboratorClient } from "@hcengineering/collaborator-client"
import { type Class, type Doc, makeCollabId, type Ref, type WorkspaceUuid } from "@hcengineering/core"
import { htmlToJSON, jsonToHTML, jsonToMarkup, markupToJSON } from "@hcengineering/text"
import { markdownToMarkup, markupToMarkdown } from "@hcengineering/text-markdown"
import { absurd } from "effect"

import { concatLink } from "../utils/url.js"

interface MarkupConvertOptions {
  readonly refUrl: string
  readonly imageUrl: string
}

function toInternalMarkup(
  value: string,
  format: MarkupFormat,
  opts: MarkupConvertOptions
): string {
  switch (format) {
    case "markup":
      return value
    case "html":
      return jsonToMarkup(htmlToJSON(value))
    case "markdown":
      return jsonToMarkup(markdownToMarkup(value, opts))
    default:
      absurd(format)
      throw new Error(`Invalid format: ${format}`)
  }
}

function fromInternalMarkup(
  markup: string,
  format: MarkupFormat,
  opts: MarkupConvertOptions
): string {
  switch (format) {
    case "markup":
      return markup
    case "html":
      return jsonToHTML(markupToJSON(markup))
    case "markdown":
      return markupToMarkdown(markupToJSON(markup), opts)
    default:
      absurd(format)
      throw new Error(`Invalid format: ${format}`)
  }
}

export interface MarkupOperations {
  fetchMarkup: (
    objectClass: Ref<Class<Doc>>,
    objectId: Ref<Doc>,
    objectAttr: string,
    id: MarkupRef,
    format: MarkupFormat
  ) => Promise<string>
  uploadMarkup: (
    objectClass: Ref<Class<Doc>>,
    objectId: Ref<Doc>,
    objectAttr: string,
    markup: string,
    format: MarkupFormat
  ) => Promise<MarkupRef>
  updateMarkup: (
    objectClass: Ref<Class<Doc>>,
    objectId: Ref<Doc>,
    objectAttr: string,
    markup: string,
    format: MarkupFormat
  ) => Promise<void>
}

export function createMarkupOps(
  url: string,
  workspace: WorkspaceUuid,
  token: string,
  collaboratorUrl: string
): MarkupOperations {
  const refUrl = concatLink(url, `/browse?workspace=${workspace}`)
  const imageUrl = concatLink(url, `/files?workspace=${workspace}&file=`)
  const collaborator = getCollaboratorClient(workspace, token, collaboratorUrl)

  return {
    async fetchMarkup(objectClass, objectId, objectAttr, doc, format) {
      const collabId = makeCollabId(objectClass, objectId, objectAttr)
      const markup = await collaborator.getMarkup(collabId, doc)
      return fromInternalMarkup(markup, format, { refUrl, imageUrl })
    },

    async uploadMarkup(objectClass, objectId, objectAttr, value, format) {
      const collabId = makeCollabId(objectClass, objectId, objectAttr)
      return await collaborator.createMarkup(collabId, toInternalMarkup(value, format, { refUrl, imageUrl }))
    },

    async updateMarkup(objectClass, objectId, objectAttr, value, format) {
      const collabId = makeCollabId(objectClass, objectId, objectAttr)
      return await collaborator.updateMarkup(collabId, toInternalMarkup(value, format, { refUrl, imageUrl }))
    }
  }
}
