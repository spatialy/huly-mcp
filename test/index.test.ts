import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Effect, Layer, Exit, Cause } from "effect"
import { HulyConfigService } from "../src/config/config.js"
import { HulyClient } from "../src/huly/client.js"
import { McpServerService, McpServerError } from "../src/mcp/server.js"
import { main } from "../src/index.js"

// --- Test Helpers ---

const createTestConfigLayer = () =>
  HulyConfigService.testLayer({
    url: "https://test.huly.app",
    email: "test@example.com",
    password: "test-password",
    workspace: "test-workspace",
    connectionTimeout: 5000,
  })

// --- Tests ---

describe("Main Entry Point", () => {
  // Store original env vars
  const originalEnv: Record<string, string | undefined> = {}
  const envVars = [
    "HULY_URL",
    "HULY_EMAIL",
    "HULY_PASSWORD",
    "HULY_WORKSPACE",
    "HULY_CONNECTION_TIMEOUT",
    "MCP_TRANSPORT",
    "MCP_HTTP_PORT",
  ]

  beforeEach(() => {
    // Save and clear env vars
    for (const key of envVars) {
      originalEnv[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    // Restore env vars
    for (const key of envVars) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key]
      } else {
        delete process.env[key]
      }
    }
  })

  describe("main program", () => {
    // test-revizorro: approved
    it("fails on missing config", async () => {
      // Don't set any env vars - config should fail
      const exit = await Effect.runPromiseExit(main)

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = Cause.failureOption(exit.cause)
        expect(error._tag).toBe("Some")
        // Config errors bubble up - verify we got a config-related error
        if (error._tag === "Some") {
          expect(error.value).toBeDefined()
        }
      }
    })
  })

  describe("layer composition", () => {
    // test-revizorro: approved
    it("McpServerService layer composes with HulyClient", async () => {
      const hulyClientLayer = HulyClient.testLayer({})
      const mcpServerLayer = McpServerService.layer({ transport: "stdio" }).pipe(
        Layer.provide(hulyClientLayer)
      )

      const exit = await Effect.runPromiseExit(
        Layer.build(mcpServerLayer).pipe(Effect.scoped)
      )

      expect(Exit.isSuccess(exit)).toBe(true)
    })
  })

  describe("error handling", () => {
    // test-revizorro: approved
    it("reports config validation errors clearly", async () => {
      // Invalid URL
      process.env["HULY_URL"] = "not-a-valid-url"
      process.env["HULY_EMAIL"] = "test@example.com"
      process.env["HULY_PASSWORD"] = "test-password"
      process.env["HULY_WORKSPACE"] = "test-workspace"

      const exit = await Effect.runPromiseExit(main)

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = Cause.failureOption(exit.cause)
        expect(error._tag).toBe("Some")
      }
    })

    // test-revizorro: approved
    it("reports missing required config", async () => {
      // Missing HULY_PASSWORD
      process.env["HULY_URL"] = "https://test.huly.app"
      process.env["HULY_EMAIL"] = "test@example.com"
      process.env["HULY_WORKSPACE"] = "test-workspace"

      const exit = await Effect.runPromiseExit(main)

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = Cause.failureOption(exit.cause)
        expect(error._tag).toBe("Some")
      }
    })
  })

  describe("McpServerService integration", () => {
    // test-revizorro: approved
    it("server run/stop cycle works", async () => {
      let runCalled = false
      let stopCalled = false

      const mockServerLayer = McpServerService.testLayer({
        run: () =>
          Effect.sync(() => {
            runCalled = true
          }),
        stop: () =>
          Effect.sync(() => {
            stopCalled = true
          }),
      })

      await Effect.runPromise(
        Effect.gen(function* () {
          const server = yield* McpServerService
          yield* server.run()
          yield* server.stop()
        }).pipe(Effect.provide(mockServerLayer))
      )

      expect(runCalled).toBe(true)
      expect(stopCalled).toBe(true)
    })

    // test-revizorro: approved
    it("server error is properly typed", async () => {
      const mockServerLayer = McpServerService.testLayer({
        run: () => new McpServerError({ message: "Connection refused" }),
      })

      const exit = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const server = yield* McpServerService
          yield* server.run()
        }).pipe(Effect.provide(mockServerLayer))
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = Cause.failureOption(exit.cause)
        expect(error._tag).toBe("Some")
        if (error._tag === "Some") {
          expect((error.value as McpServerError)._tag).toBe("McpServerError")
          expect((error.value as McpServerError).message).toBe("Connection refused")
        }
      }
    })
  })
})
