import { describe, it } from "@effect/vitest"
import type { MarkupRef } from "@hcengineering/api-client"
import {
  AccountRole,
  type AttachedData,
  type AttachedDoc,
  type Class,
  type Data,
  type Doc,
  type DocumentQuery,
  type PersonUuid,
  type Ref as DocRef,
  type Space,
  toFindResult,
  type WithLookup,
  type WorkspaceMemberInfo
} from "@hcengineering/core"
import { Effect } from "effect"
import { expect } from "vitest"
import { HulyClient } from "../../src/huly/client.js"
import { HulyConnectionError } from "../../src/huly/errors.js"
import { WorkspaceClient } from "../../src/huly/workspace-client.js"

interface TestDoc extends Doc {
  title: string
}

describe("HulyClient.testLayer defaults", () => {
  // test-revizorro: approved
  it.effect("findAll returns empty FindResult", () =>
    Effect.gen(function*() {
      const client = yield* HulyClient.pipe(
        Effect.provide(HulyClient.testLayer({}))
      )
      const results = yield* client.findAll(
        "c" as DocRef<Class<TestDoc>>,
        {} as DocumentQuery<TestDoc>
      )
      expect(results).toHaveLength(0)
      expect(results.total).toBe(0)
    }))

  // test-revizorro: approved
  it.effect("findOne returns undefined", () =>
    Effect.gen(function*() {
      const client = yield* HulyClient.pipe(
        Effect.provide(HulyClient.testLayer({}))
      )
      const result = yield* client.findOne(
        "c" as DocRef<Class<TestDoc>>,
        {} as DocumentQuery<TestDoc>
      )
      expect(result).toBeUndefined()
    }))

  // test-revizorro: approved
  it.effect("fetchMarkup returns empty string", () =>
    Effect.gen(function*() {
      const client = yield* HulyClient.pipe(
        Effect.provide(HulyClient.testLayer({}))
      )
      const result = yield* client.fetchMarkup(
        "c" as DocRef<Class<Doc>>,
        "id" as DocRef<Doc>,
        "attr",
        "ref" as MarkupRef,
        "markdown"
      )
      expect(result).toBe("")
    }))

  // test-revizorro: approved
  it.effect("createDoc fails (not implemented)", () =>
    Effect.gen(function*() {
      const client = yield* HulyClient.pipe(
        Effect.provide(HulyClient.testLayer({}))
      )
      const error = yield* Effect.flip(
        client.createDoc(
          "c" as DocRef<Class<TestDoc>>,
          "s" as DocRef<Space>,
          { title: "t" } as Data<TestDoc>
        )
      )
      expect(error._tag).toBe("HulyConnectionError")
      expect(error.message).toContain("not implemented in test layer")
    }))

  // test-revizorro: approved
  it.effect("updateDoc fails (not implemented)", () =>
    Effect.gen(function*() {
      const client = yield* HulyClient.pipe(
        Effect.provide(HulyClient.testLayer({}))
      )
      const error = yield* Effect.flip(
        client.updateDoc(
          "c" as DocRef<Class<TestDoc>>,
          "s" as DocRef<Space>,
          "id" as DocRef<TestDoc>,
          {}
        )
      )
      expect(error._tag).toBe("HulyConnectionError")
      expect(error.message).toContain("not implemented in test layer")
    }))

  // test-revizorro: approved
  it.effect("addCollection fails (not implemented)", () =>
    Effect.gen(function*() {
      const client = yield* HulyClient.pipe(
        Effect.provide(HulyClient.testLayer({}))
      )
      const error = yield* Effect.flip(
        client.addCollection(
          "c" as DocRef<Class<AttachedDoc>>,
          "s" as DocRef<Space>,
          "parent" as DocRef<Doc>,
          "pc" as DocRef<Class<Doc>>,
          "col",
          {} as AttachedData<AttachedDoc>
        )
      )
      expect(error._tag).toBe("HulyConnectionError")
      expect(error.message).toContain("not implemented in test layer")
    }))

  // test-revizorro: approved
  it.effect("removeDoc fails (not implemented)", () =>
    Effect.gen(function*() {
      const client = yield* HulyClient.pipe(
        Effect.provide(HulyClient.testLayer({}))
      )
      const error = yield* Effect.flip(
        client.removeDoc(
          "c" as DocRef<Class<TestDoc>>,
          "s" as DocRef<Space>,
          "id" as DocRef<TestDoc>
        )
      )
      expect(error._tag).toBe("HulyConnectionError")
      expect(error.message).toContain("not implemented in test layer")
    }))

  // test-revizorro: approved
  it.effect("uploadMarkup fails (not implemented)", () =>
    Effect.gen(function*() {
      const client = yield* HulyClient.pipe(
        Effect.provide(HulyClient.testLayer({}))
      )
      const error = yield* Effect.flip(
        client.uploadMarkup(
          "c" as DocRef<Class<Doc>>,
          "id" as DocRef<Doc>,
          "attr",
          "content",
          "markdown"
        )
      )
      expect(error._tag).toBe("HulyConnectionError")
      expect(error.message).toContain("not implemented in test layer")
    }))

  // test-revizorro: approved
  it.effect("updateMarkup fails (not implemented)", () =>
    Effect.gen(function*() {
      const client = yield* HulyClient.pipe(
        Effect.provide(HulyClient.testLayer({}))
      )
      const error = yield* Effect.flip(
        client.updateMarkup(
          "c" as DocRef<Class<Doc>>,
          "id" as DocRef<Doc>,
          "attr",
          "content",
          "markdown"
        )
      )
      expect(error._tag).toBe("HulyConnectionError")
      expect(error.message).toContain("not implemented in test layer")
    }))
})

describe("HulyClient.testLayer with custom operations", () => {
  // test-revizorro: approved
  it.effect("custom findAll returns provided data", () =>
    Effect.gen(function*() {
      const asDoc = (v: unknown): Doc => v as Doc
      const docs = [asDoc({ _id: "d1", title: "A" }), asDoc({ _id: "d2", title: "B" })]
      const layer = HulyClient.testLayer({
        findAll: <T extends Doc>() => Effect.succeed(toFindResult<T>(docs as Array<T>))
      })
      const client = yield* HulyClient.pipe(Effect.provide(layer))
      const results = yield* client.findAll(
        "c" as DocRef<Class<TestDoc>>,
        {} as DocumentQuery<TestDoc>
      )
      expect(results).toHaveLength(2)
    }))

  // test-revizorro: approved
  it.effect("custom findOne returns provided value", () =>
    Effect.gen(function*() {
      const doc = { _id: "d1", title: "Found" }
      const layer = HulyClient.testLayer({
        // eslint-disable-next-line no-restricted-syntax -- partial mock object doesn't overlap with WithLookup<T>
        findOne: <T extends Doc>() => Effect.succeed(doc as unknown as WithLookup<T>)
      })
      const client = yield* HulyClient.pipe(Effect.provide(layer))
      const result = yield* client.findOne(
        "c" as DocRef<Class<TestDoc>>,
        {} as DocumentQuery<TestDoc>
      )
      expect(result).toBeDefined()
      expect(result!._id).toBe("d1")
      expect((result as TestDoc).title).toBe("Found")
    }))

  // test-revizorro: approved
  it.effect("custom operation can return error", () =>
    Effect.gen(function*() {
      const layer = HulyClient.testLayer({
        findAll: () =>
          Effect.fail(
            new HulyConnectionError({ message: "mock connection error" })
          )
      })
      const client = yield* HulyClient.pipe(Effect.provide(layer))
      const err = yield* Effect.flip(
        client.findAll(
          "c" as DocRef<Class<TestDoc>>,
          {} as DocumentQuery<TestDoc>
        )
      )
      expect(err._tag).toBe("HulyConnectionError")
    }))

  // test-revizorro: approved
  it.effect("overriding one op does not affect others", () =>
    Effect.gen(function*() {
      const asDoc = (v: unknown): Doc => v as Doc
      const layer = HulyClient.testLayer({
        findAll: <T extends Doc>() => {
          const docs = [asDoc({ _id: "x" })] as Array<T>
          return Effect.succeed(toFindResult(docs))
        }
      })
      const client = yield* HulyClient.pipe(Effect.provide(layer))

      const all = yield* client.findAll(
        "c" as DocRef<Class<TestDoc>>,
        {} as DocumentQuery<TestDoc>
      )
      expect(all).toHaveLength(1)

      const one = yield* client.findOne(
        "c" as DocRef<Class<TestDoc>>,
        {} as DocumentQuery<TestDoc>
      )
      expect(one).toBeUndefined()
    }))
})

describe("WorkspaceClient.testLayer defaults", () => {
  // test-revizorro: approved
  it.effect("getWorkspaceMembers returns empty array", () =>
    Effect.gen(function*() {
      const client = yield* WorkspaceClient.pipe(
        Effect.provide(WorkspaceClient.testLayer({}))
      )
      const members = yield* client.getWorkspaceMembers()
      expect(members).toEqual([])
    }))

  // test-revizorro: approved
  it.effect("getUserWorkspaces returns empty array", () =>
    Effect.gen(function*() {
      const client = yield* WorkspaceClient.pipe(
        Effect.provide(WorkspaceClient.testLayer({}))
      )
      const workspaces = yield* client.getUserWorkspaces()
      expect(workspaces).toEqual([])
    }))

  // test-revizorro: approved
  it.effect("getUserProfile returns null", () =>
    Effect.gen(function*() {
      const client = yield* WorkspaceClient.pipe(
        Effect.provide(WorkspaceClient.testLayer({}))
      )
      const profile = yield* client.getUserProfile()
      expect(profile).toBeNull()
    }))

  // test-revizorro: approved
  it.effect("getRegionInfo returns empty array", () =>
    Effect.gen(function*() {
      const client = yield* WorkspaceClient.pipe(
        Effect.provide(WorkspaceClient.testLayer({}))
      )
      const regions = yield* client.getRegionInfo()
      expect(regions).toEqual([])
    }))

  // test-revizorro: approved
  it.effect("getPersonInfo fails (not implemented)", () =>
    Effect.gen(function*() {
      const client = yield* WorkspaceClient.pipe(
        Effect.provide(WorkspaceClient.testLayer({}))
      )
      const error = yield* Effect.flip(
        client.getPersonInfo("person-uuid" as PersonUuid)
      )
      expect(error._tag).toBe("HulyConnectionError")
      expect(error.message).toContain("not implemented in test layer")
    }))

  // test-revizorro: approved
  it.effect("updateWorkspaceRole fails (not implemented)", () =>
    Effect.gen(function*() {
      const client = yield* WorkspaceClient.pipe(
        Effect.provide(WorkspaceClient.testLayer({}))
      )
      const error = yield* Effect.flip(
        client.updateWorkspaceRole("account", AccountRole.Guest)
      )
      expect(error._tag).toBe("HulyConnectionError")
      expect(error.message).toContain("not implemented in test layer")
    }))

  // test-revizorro: approved
  it.effect("getWorkspaceInfo fails (not implemented)", () =>
    Effect.gen(function*() {
      const client = yield* WorkspaceClient.pipe(
        Effect.provide(WorkspaceClient.testLayer({}))
      )
      const error = yield* Effect.flip(client.getWorkspaceInfo())
      expect(error._tag).toBe("HulyConnectionError")
      expect(error.message).toContain("not implemented in test layer")
    }))

  // test-revizorro: approved
  it.effect("createWorkspace fails (not implemented)", () =>
    Effect.gen(function*() {
      const client = yield* WorkspaceClient.pipe(
        Effect.provide(WorkspaceClient.testLayer({}))
      )
      const error = yield* Effect.flip(client.createWorkspace("new-ws"))
      expect(error._tag).toBe("HulyConnectionError")
      expect(error.message).toContain("not implemented in test layer")
    }))

  // test-revizorro: approved
  it.effect("deleteWorkspace fails (not implemented)", () =>
    Effect.gen(function*() {
      const client = yield* WorkspaceClient.pipe(
        Effect.provide(WorkspaceClient.testLayer({}))
      )
      const error = yield* Effect.flip(client.deleteWorkspace())
      expect(error._tag).toBe("HulyConnectionError")
      expect(error.message).toContain("not implemented in test layer")
    }))

  // test-revizorro: approved
  it.effect("setMyProfile fails (not implemented)", () =>
    Effect.gen(function*() {
      const client = yield* WorkspaceClient.pipe(
        Effect.provide(WorkspaceClient.testLayer({}))
      )
      const error = yield* Effect.flip(client.setMyProfile({}))
      expect(error._tag).toBe("HulyConnectionError")
      expect(error.message).toContain("not implemented in test layer")
    }))

  // test-revizorro: approved
  it.effect("updateAllowReadOnlyGuests fails (not implemented)", () =>
    Effect.gen(function*() {
      const client = yield* WorkspaceClient.pipe(
        Effect.provide(WorkspaceClient.testLayer({}))
      )
      const error = yield* Effect.flip(client.updateAllowReadOnlyGuests(true))
      expect(error._tag).toBe("HulyConnectionError")
      expect(error.message).toContain("not implemented in test layer")
    }))

  // test-revizorro: approved
  it.effect("updateAllowGuestSignUp fails (not implemented)", () =>
    Effect.gen(function*() {
      const client = yield* WorkspaceClient.pipe(
        Effect.provide(WorkspaceClient.testLayer({}))
      )
      const error = yield* Effect.flip(client.updateAllowGuestSignUp(true))
      expect(error._tag).toBe("HulyConnectionError")
      expect(error.message).toContain("not implemented in test layer")
    }))
})

describe("WorkspaceClient.testLayer with custom operations", () => {
  // test-revizorro: approved
  it.effect("custom getWorkspaceMembers returns provided data", () =>
    Effect.gen(function*() {
      const mockMembers = [{ person: "p1" }]
      const layer = WorkspaceClient.testLayer({
        getWorkspaceMembers: () =>
          Effect.succeed(
            mockMembers as Array<WorkspaceMemberInfo>
          )
      })
      const client = yield* WorkspaceClient.pipe(Effect.provide(layer))
      const members = yield* client.getWorkspaceMembers()
      expect(members).toHaveLength(1)
      expect(members[0].person).toBe("p1")
    }))

  // test-revizorro: approved
  it.effect("custom operation can return error", () =>
    Effect.gen(function*() {
      const layer = WorkspaceClient.testLayer({
        getWorkspaceMembers: () =>
          Effect.fail(
            new HulyConnectionError({ message: "workspace unavailable" })
          )
      })
      const client = yield* WorkspaceClient.pipe(Effect.provide(layer))
      const err = yield* Effect.flip(client.getWorkspaceMembers())
      expect(err._tag).toBe("HulyConnectionError")
    }))

  // test-revizorro: approved
  it.effect("overriding one op preserves other defaults", () =>
    Effect.gen(function*() {
      const layer = WorkspaceClient.testLayer({
        getWorkspaceMembers: () =>
          Effect.succeed(
            [{ person: "p1" }] as Array<WorkspaceMemberInfo>
          )
      })
      const client = yield* WorkspaceClient.pipe(Effect.provide(layer))

      const members = yield* client.getWorkspaceMembers()
      expect(members).toHaveLength(1)

      const profile = yield* client.getUserProfile()
      expect(profile).toBeNull()
    }))
})
