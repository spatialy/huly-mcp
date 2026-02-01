import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Effect, Layer, Exit, Cause, Config } from "effect"
import { HulyConfigService } from "../src/config/config.js"
import { HulyClient } from "../src/huly/client.js"
import { McpServerService, McpServerError } from "../src/mcp/server.js"
import { buildAppLayer, main } from "../src/index.js"

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

  describe("buildAppLayer", () => {
    // test-revizorro: suspect [Only checks toBeDefined, doesn't build layer or verify services wired - compare line 129-140 proper test]
    it("builds layer stack for stdio transport", () => {
      // We can verify the layer builds successfully by checking it compiles
      const layer = buildAppLayer("stdio", 3000)

      // Layer type should include McpServerService
      expect(layer).toBeDefined()
    })

    // test-revizorro: suspect [Only checks toBeDefined, doesn't verify layer builds or http/8080 params wired - compare line 129-140 which tests Layer.build works]
    it("builds layer stack for http transport", () => {
      const layer = buildAppLayer("http", 8080)
      expect(layer).toBeDefined()
    })
  })

  describe("main program", () => {
    // test-revizorro: suspect [Only checks error._tag=Some (Option wrapper), doesn't verify ConfigValidationError type or which field missing - compare line 221-242 which properly validates error type/message]
    it("fails on missing config", async () => {
      // Don't set any env vars - config should fail
      const exit = await Effect.runPromiseExit(main)

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const error = Cause.failureOption(exit.cause)
        expect(error._tag).toBe("Some")
      }
    })

    // test-revizorro: suspect [Test name claims to verify stdio transport default, but only tests HulyConfigService loads - doesn't call getTransportType or verify buildAppLayer receives "stdio". Would pass even if transport selection broken]
    it("uses stdio transport by default", async () => {
      // Set up config env vars
      process.env["HULY_URL"] = "https://test.huly.app"
      process.env["HULY_EMAIL"] = "test@example.com"
      process.env["HULY_PASSWORD"] = "test-password"
      process.env["HULY_WORKSPACE"] = "test-workspace"

      // We can't easily test the full flow without mocking deeply,
      // but we can verify the config parsing works
      const exit = await Effect.runPromiseExit(
        Effect.gen(function* () {
          // Just verify config loads successfully
          yield* Effect.provide(
            HulyConfigService,
            HulyConfigService.layer
          )
        })
      )

      expect(Exit.isSuccess(exit)).toBe(true)
    })

    // test-revizorro: suspect [Tests wrong service - sets MCP_TRANSPORT/PORT but only tests HulyConfigService which doesn't read those vars. Would pass without env vars set. Doesn't test getTransportType/getHttpPort/buildAppLayer at all]
    it("respects MCP_TRANSPORT env var", async () => {
      process.env["HULY_URL"] = "https://test.huly.app"
      process.env["HULY_EMAIL"] = "test@example.com"
      process.env["HULY_PASSWORD"] = "test-password"
      process.env["HULY_WORKSPACE"] = "test-workspace"
      process.env["MCP_TRANSPORT"] = "http"
      process.env["MCP_HTTP_PORT"] = "8080"

      // Verify config is valid
      const exit = await Effect.runPromiseExit(
        Effect.provide(
          HulyConfigService,
          HulyConfigService.layer
        )
      )

      expect(Exit.isSuccess(exit)).toBe(true)
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

    // test-revizorro: suspect [Uses Layer.mergeAll with testLayers instead of real buildAppLayer. Bypasses actual dependency wiring (Layer.provide chains in src/index.ts:81-97), would pass even if buildAppLayer broken]
    it("full layer stack builds successfully", async () => {
      // Create test layers
      const configLayer = createTestConfigLayer()
      const hulyClientLayer = HulyClient.testLayer({})
      const mcpServerLayer = McpServerService.testLayer({})

      // Build the full stack
      const fullLayer = Layer.mergeAll(
        configLayer,
        hulyClientLayer,
        mcpServerLayer
      )

      const exit = await Effect.runPromiseExit(
        Layer.build(fullLayer).pipe(Effect.scoped)
      )

      expect(Exit.isSuccess(exit)).toBe(true)
    })
  })

  describe("error handling", () => {
    // test-revizorro: suspect [Only checks Exit.isFailure, doesn't verify error type/message. Would pass for any failure (network, crash). Compare line 221-242 which properly checks error._tag and message]
    it("reports config validation errors clearly", async () => {
      // Invalid URL
      process.env["HULY_URL"] = "not-a-valid-url"
      process.env["HULY_EMAIL"] = "test@example.com"
      process.env["HULY_PASSWORD"] = "test-password"
      process.env["HULY_WORKSPACE"] = "test-workspace"

      const exit = await Effect.runPromiseExit(main)

      expect(Exit.isFailure(exit)).toBe(true)
    })

    // test-revizorro: suspect [Test name claims to verify error "reporting" but only checks Exit.isFailure (any failure passes). Doesn't verify ConfigValidationError type, missing 'password' field mentioned, or message clarity - compare line 221-242 for proper error validation]
    it("reports missing required config", async () => {
      // Missing HULY_PASSWORD
      process.env["HULY_URL"] = "https://test.huly.app"
      process.env["HULY_EMAIL"] = "test@example.com"
      process.env["HULY_WORKSPACE"] = "test-workspace"

      const exit = await Effect.runPromiseExit(main)

      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe("McpServerService integration", () => {
    // test-revizorro: suspect [Mock bypasses all actual server logic (state management, transport connection, async blocking via Effect.async). Only verifies Effect service injection works, not real run/stop behavior - compare real implementation lines 196-253 in server.ts]
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

describe("Environment variable defaults", () => {
  const originalEnv: Record<string, string | undefined> = {}
  const envVars = ["MCP_TRANSPORT", "MCP_HTTP_PORT"]

  beforeEach(() => {
    for (const key of envVars) {
      originalEnv[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of envVars) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key]
      } else {
        delete process.env[key]
      }
    }
  })

  // test-revizorro: suspect [Tests inline reimplemented Config instead of actual getTransportType from src/index.ts - missing Effect.map normalization logic, wouldn't catch bugs in real code]
  it("MCP_TRANSPORT defaults to stdio", async () => {
    // Not setting MCP_TRANSPORT
    const transportConfig = Config.string("MCP_TRANSPORT").pipe(
      Config.withDefault("stdio")
    )

    const result = await Effect.runPromise(transportConfig)

    expect(result).toBe("stdio")
  })

  // test-revizorro: suspect [Reimplements getHttpPort inline instead of importing/testing real src/index.ts code - would pass if real default changed to 8080]
  it("MCP_HTTP_PORT defaults to 3000", async () => {
    const portConfig = Config.integer("MCP_HTTP_PORT").pipe(
      Config.withDefault(3000)
    )

    const result = await Effect.runPromise(portConfig)

    expect(result).toBe(3000)
  })

  // test-revizorro: suspect [Tests inline reimplemented Config instead of actual getTransportType from src/index.ts - missing Effect.map normalization logic (line 63-66), wouldn't catch invalid transport values]
  it("MCP_TRANSPORT can be overridden", async () => {
    process.env["MCP_TRANSPORT"] = "http"

    const transportConfig = Config.string("MCP_TRANSPORT").pipe(
      Config.withDefault("stdio")
    )

    const result = await Effect.runPromise(transportConfig)

    expect(result).toBe("http")
  })

  // test-revizorro: suspect [Tests inline reimplemented Config instead of actual getHttpPort from src/index.ts - same issue as lines 267-301, wouldn't catch if real implementation changed]
  it("MCP_HTTP_PORT can be overridden", async () => {
    process.env["MCP_HTTP_PORT"] = "8080"

    const portConfig = Config.integer("MCP_HTTP_PORT").pipe(
      Config.withDefault(3000)
    )

    const result = await Effect.runPromise(portConfig)

    expect(result).toBe(8080)
  })
})
