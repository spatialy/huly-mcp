import { describe, it, expect } from "vitest"
import { Effect, Exit } from "effect"
import type {
  Class,
  Data,
  Doc,
  DocumentQuery,
  FindOptions,
  FindResult,
  Ref as DocRef,
  Space,
  TxResult,
  WithLookup,
} from "@hcengineering/core"
import type { MarkupRef } from "@hcengineering/api-client"
import {
  HulyClient,
  type HulyClientError,
} from "../../src/huly/client.js"
import { HulyConnectionError, HulyAuthError } from "../../src/huly/errors.js"

// Mock doc for testing
interface TestDoc extends Doc {
  title: string
}

describe("HulyClient Service", () => {
  describe("testLayer", () => {
    // test-revizorro: approved
    it("provides default noop operations", async () => {
      const testLayer = HulyClient.testLayer({})

      const program = Effect.gen(function* () {
        const client = yield* HulyClient
        return client
      })

      const client = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      )

      expect(client.findAll).toBeDefined()
      expect(client.findOne).toBeDefined()
      expect(client.createDoc).toBeDefined()
      expect(client.updateDoc).toBeDefined()
      expect(client.addCollection).toBeDefined()
      expect(client.uploadMarkup).toBeDefined()
      expect(client.fetchMarkup).toBeDefined()
    })

    // test-revizorro: approved
    it("allows overriding specific operations", async () => {
      const mockResults: FindResult<TestDoc> = [
        { _id: "1", _class: "class" as DocRef<Class<TestDoc>>, space: "space" as DocRef<Space>, title: "Test", modifiedBy: "user" as DocRef<Doc>, modifiedOn: 0, createdBy: "user" as DocRef<Doc>, createdOn: 0 },
      ] as unknown as FindResult<TestDoc>

      const testLayer = HulyClient.testLayer({
        findAll: <T extends Doc>() =>
          Effect.succeed(mockResults as unknown as FindResult<T>),
      })

      const program = Effect.gen(function* () {
        const client = yield* HulyClient
        const results = yield* client.findAll(
          "class" as DocRef<Class<TestDoc>>,
          {} as DocumentQuery<TestDoc>
        )
        return results
      })

      const results = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      )

      expect(results).toHaveLength(1)
    })

    // test-revizorro: approved
    it("default findAll returns empty array", async () => {
      const testLayer = HulyClient.testLayer({})

      const program = Effect.gen(function* () {
        const client = yield* HulyClient
        return yield* client.findAll(
          "class" as DocRef<Class<TestDoc>>,
          {} as DocumentQuery<TestDoc>
        )
      })

      const results = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      )

      expect(results).toHaveLength(0)
    })

    // test-revizorro: approved
    it("default findOne returns undefined", async () => {
      const testLayer = HulyClient.testLayer({})

      const program = Effect.gen(function* () {
        const client = yield* HulyClient
        return yield* client.findOne(
          "class" as DocRef<Class<TestDoc>>,
          {} as DocumentQuery<TestDoc>
        )
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      )

      expect(result).toBeUndefined()
    })

    // test-revizorro: approved
    it("default uploadMarkup returns empty string", async () => {
      const testLayer = HulyClient.testLayer({})

      const program = Effect.gen(function* () {
        const client = yield* HulyClient
        return yield* client.uploadMarkup(
          "class" as DocRef<Class<Doc>>,
          "id" as DocRef<Doc>,
          "attr",
          "content",
          "markdown"
        )
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      )

      expect(result).toBe("")
    })

    // test-revizorro: approved
    it("default fetchMarkup returns empty string", async () => {
      const testLayer = HulyClient.testLayer({})

      const program = Effect.gen(function* () {
        const client = yield* HulyClient
        return yield* client.fetchMarkup(
          "class" as DocRef<Class<Doc>>,
          "id" as DocRef<Doc>,
          "attr",
          "markupId" as MarkupRef,
          "markdown"
        )
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      )

      expect(result).toBe("")
    })
  })

  describe("mock operations with errors", () => {
    // test-revizorro: approved
    it("can mock operations to return HulyConnectionError", async () => {
      const testLayer = HulyClient.testLayer({
        findAll: () =>
          Effect.fail(
            new HulyConnectionError({
              message: "Network error",
            })
          ),
      })

      const program = Effect.gen(function* () {
        const client = yield* HulyClient
        return yield* client.findAll(
          "class" as DocRef<Class<TestDoc>>,
          {} as DocumentQuery<TestDoc>
        )
      })

      const exit = await Effect.runPromiseExit(
        program.pipe(Effect.provide(testLayer))
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = exit.cause
        expect(error._tag).toBe("Fail")
        if (error._tag === "Fail") {
          expect((error.error as HulyConnectionError)._tag).toBe("HulyConnectionError")
          expect((error.error as HulyConnectionError).message).toBe("Network error")
        }
      }
    })

    // test-revizorro: approved
    it("can mock operations to return HulyAuthError", async () => {
      const testLayer = HulyClient.testLayer({
        findOne: () =>
          Effect.fail(
            new HulyAuthError({
              message: "Invalid credentials",
            })
          ),
      })

      const program = Effect.gen(function* () {
        const client = yield* HulyClient
        return yield* client.findOne(
          "class" as DocRef<Class<TestDoc>>,
          {} as DocumentQuery<TestDoc>
        )
      })

      const exit = await Effect.runPromiseExit(
        program.pipe(Effect.provide(testLayer))
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = exit.cause
        expect(error._tag).toBe("Fail")
        if (error._tag === "Fail") {
          expect((error.error as HulyAuthError)._tag).toBe("HulyAuthError")
          expect((error.error as HulyAuthError).message).toBe("Invalid credentials")
        }
      }
    })
  })

  describe("error handling patterns", () => {
    // test-revizorro: approved
    it("can catch HulyConnectionError with catchTag", async () => {
      const testLayer = HulyClient.testLayer({
        findAll: () =>
          Effect.fail(
            new HulyConnectionError({
              message: "Connection timeout",
            })
          ),
      })

      const program = Effect.gen(function* () {
        const client = yield* HulyClient
        return yield* client.findAll(
          "class" as DocRef<Class<TestDoc>>,
          {} as DocumentQuery<TestDoc>
        )
      }).pipe(
        Effect.catchTag("HulyConnectionError", (e) =>
          Effect.succeed(`Recovered from: ${e.message}`)
        )
      )

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      )

      expect(result).toBe("Recovered from: Connection timeout")
    })

    // test-revizorro: approved
    it("can catch HulyAuthError with catchTag", async () => {
      const testLayer = HulyClient.testLayer({
        createDoc: () =>
          Effect.fail(
            new HulyAuthError({
              message: "Session expired",
            })
          ),
      })

      const program = Effect.gen(function* () {
        const client = yield* HulyClient
        return yield* client.createDoc(
          "class" as DocRef<Class<TestDoc>>,
          "space" as DocRef<Space>,
          { title: "Test" } as Data<TestDoc>
        )
      }).pipe(
        Effect.catchTag("HulyAuthError", (e) =>
          Effect.succeed(`Auth error: ${e.message}`)
        )
      )

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      )

      expect(result).toBe("Auth error: Session expired")
    })

    // test-revizorro: approved
    it("can handle both error types with catchTags", async () => {
      const connectionErrorLayer = HulyClient.testLayer({
        findAll: () =>
          Effect.fail(
            new HulyConnectionError({ message: "Network down" })
          ),
      })

      const handleErrors = <A>(
        effect: Effect.Effect<A, HulyClientError, HulyClient>
      ) =>
        effect.pipe(
          Effect.catchTags({
            HulyConnectionError: (e) =>
              Effect.succeed(`Connection: ${e.message}`),
            HulyAuthError: (e) =>
              Effect.succeed(`Auth: ${e.message}`),
          })
        )

      const program = Effect.gen(function* () {
        const client = yield* HulyClient
        return yield* handleErrors(
          client.findAll(
            "class" as DocRef<Class<TestDoc>>,
            {} as DocumentQuery<TestDoc>
          )
        )
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(connectionErrorLayer))
      )

      expect(result).toBe("Connection: Network down")
    })
  })

  describe("service composition", () => {
    // test-revizorro: approved
    it("can be composed with other services", async () => {
      // Mock a higher-level service that uses HulyClient
      const mockFindAll = <T extends Doc>() =>
        Effect.succeed([
          { _id: "1", title: "Issue 1" },
          { _id: "2", title: "Issue 2" },
        ] as unknown as FindResult<T>)

      const testLayer = HulyClient.testLayer({
        findAll: mockFindAll,
      })

      // Higher-level program using the client
      const listIssues = Effect.gen(function* () {
        const client = yield* HulyClient
        const issues = yield* client.findAll(
          "tracker.class.Issue" as DocRef<Class<TestDoc>>,
          { space: "project-1" } as DocumentQuery<TestDoc>,
          { limit: 50 } as FindOptions<TestDoc>
        )
        return issues.map((i) => (i as unknown as { title: string }).title)
      })

      const result = await Effect.runPromise(
        listIssues.pipe(Effect.provide(testLayer))
      )

      expect(result).toEqual(["Issue 1", "Issue 2"])
    })

    // test-revizorro: approved
    it("multiple operations reuse same mock layer", async () => {
      const callCount = { findAll: 0, findOne: 0 }

      const testLayer = HulyClient.testLayer({
        findAll: <T extends Doc>() => {
          callCount.findAll++
          return Effect.succeed([] as unknown as FindResult<T>)
        },
        findOne: <T extends Doc>() => {
          callCount.findOne++
          return Effect.succeed({ _id: "1", title: "Found" } as unknown as WithLookup<T>)
        },
      })

      const program = Effect.gen(function* () {
        const client = yield* HulyClient

        // Call both operations
        const all = yield* client.findAll(
          "class" as DocRef<Class<TestDoc>>,
          {} as DocumentQuery<TestDoc>
        )
        const one = yield* client.findOne(
          "class" as DocRef<Class<TestDoc>>,
          { _id: "1" } as DocumentQuery<TestDoc>
        )

        return { allCount: all.length, found: one !== undefined }
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      )

      expect(result.allCount).toBe(0)
      expect(result.found).toBe(true)
      expect(callCount.findAll).toBe(1)
      expect(callCount.findOne).toBe(1)
    })
  })

  describe("HulyClientError type", () => {
    // test-revizorro: approved
    it("is union of HulyConnectionError and HulyAuthError", async () => {
      // Type test - this should compile
      const handleError = (error: HulyClientError): string => {
        switch (error._tag) {
          case "HulyConnectionError":
            return `Connection: ${error.message}`
          case "HulyAuthError":
            return `Auth: ${error.message}`
        }
      }

      const connErr = new HulyConnectionError({ message: "timeout" })
      const authErr = new HulyAuthError({ message: "invalid" })

      expect(handleError(connErr)).toBe("Connection: timeout")
      expect(handleError(authErr)).toBe("Auth: invalid")
    })
  })

  describe("operation tracking", () => {
    // test-revizorro: approved
    it("tracks operation calls for testing", async () => {
      const operations: string[] = []

      const testLayer = HulyClient.testLayer({
        findAll: <T extends Doc>() => {
          operations.push("findAll")
          return Effect.succeed([] as unknown as FindResult<T>)
        },
        findOne: <T extends Doc>() => {
          operations.push("findOne")
          return Effect.succeed(undefined as WithLookup<T> | undefined)
        },
        createDoc: <T extends Doc>() => {
          operations.push("createDoc")
          return Effect.succeed("new-id" as DocRef<T>)
        },
        updateDoc: () => {
          operations.push("updateDoc")
          return Effect.succeed({} as TxResult)
        },
      })

      const program = Effect.gen(function* () {
        const client = yield* HulyClient
        yield* client.findAll("c" as DocRef<Class<TestDoc>>, {} as DocumentQuery<TestDoc>)
        yield* client.findOne("c" as DocRef<Class<TestDoc>>, {} as DocumentQuery<TestDoc>)
        yield* client.createDoc("c" as DocRef<Class<TestDoc>>, "s" as DocRef<Space>, { title: "test" } as Data<TestDoc>)
        yield* client.updateDoc("c" as DocRef<Class<TestDoc>>, "s" as DocRef<Space>, "id" as DocRef<TestDoc>, {})
        return operations
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(testLayer))
      )

      expect(result).toEqual(["findAll", "findOne", "createDoc", "updateDoc"])
    })
  })
})

describe("Connection error classification", () => {
  describe("HulyConnectionError", () => {
    // test-revizorro: approved
    it("has correct tag", () => {
      const error = new HulyConnectionError({ message: "timeout" })
      expect(error._tag).toBe("HulyConnectionError")
    })

    // test-revizorro: approved
    it("includes cause", () => {
      const cause = new Error("underlying")
      const error = new HulyConnectionError({
        message: "failed",
        cause,
      })
      expect(error.cause).toBe(cause)
    })

    // test-revizorro: approved
    it("has mcpErrorCode", () => {
      const error = new HulyConnectionError({ message: "timeout" })
      expect(error.mcpErrorCode).toBe(-32603)
    })
  })

  describe("HulyAuthError", () => {
    // test-revizorro: approved
    it("has correct tag", () => {
      const error = new HulyAuthError({ message: "invalid credentials" })
      expect(error._tag).toBe("HulyAuthError")
    })

    // test-revizorro: approved
    it("has mcpErrorCode", () => {
      const error = new HulyAuthError({ message: "invalid credentials" })
      expect(error.mcpErrorCode).toBe(-32603)
    })
  })
})
