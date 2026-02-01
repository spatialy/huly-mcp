#!/usr/bin/env node
/**
 * Main entry point for Huly MCP server.
 *
 * Loads configuration, builds Layer stack, and starts the MCP server.
 * Handles graceful shutdown on SIGTERM/SIGINT.
 *
 * Usage:
 *   npm start
 *
 * Environment variables:
 *   HULY_URL           - Huly platform URL (required)
 *   HULY_EMAIL         - User email (required)
 *   HULY_PASSWORD      - User password (required)
 *   HULY_WORKSPACE     - Default workspace (required)
 *   HULY_CONNECTION_TIMEOUT - Connection timeout in ms (default: 30000)
 *   MCP_TRANSPORT      - Transport mode: stdio (default: stdio)
 *
 * @module
 */

// Polyfill browser globals for Node.js (required by @hcengineering packages)
import fakeIndexedDB from "fake-indexeddb"
;(globalThis as any).indexedDB = fakeIndexedDB

// Mock window with basic event handling
const mockWindow: any = {
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { href: '' },
  document: {},
}
;(globalThis as any).window = mockWindow

if (!(globalThis as any).navigator) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'node' },
    writable: true,
    configurable: true
  })
}

import { Effect, Layer, Cause, Console, Config, ConfigError, Option } from "effect"
import { HulyConfigService, type HulyConfigError } from "./config/config.js"
import { HulyClient, type HulyClientError } from "./huly/client.js"
import { McpServerService, McpServerError, type McpTransportType } from "./mcp/server.js"

// --- Types ---

/**
 * Application error - wraps all startup/runtime errors.
 */
export type AppError = HulyConfigError | HulyClientError | McpServerError | ConfigError.ConfigError

// --- Main Program ---

/**
 * Get transport type from environment.
 * Defaults to "stdio" if not set.
 */
const getTransportType = Config.string("MCP_TRANSPORT").pipe(
  Config.withDefault("stdio"),
  Effect.map((t): McpTransportType => {
    if (t === "http") return "http"
    return "stdio"
  })
)

/**
 * Get HTTP port from environment.
 * Defaults to 3000 if not set.
 */
const getHttpPort = Config.integer("MCP_HTTP_PORT").pipe(
  Config.withDefault(3000)
)

/**
 * Build the full application layer stack.
 * Config → HulyClient → McpServer
 */
export const buildAppLayer = (
  transport: McpTransportType,
  httpPort: number
): Layer.Layer<McpServerService, HulyConfigError | HulyClientError, never> => {
  // HulyClient requires HulyConfig
  const hulyClientLayer = HulyClient.layer.pipe(
    Layer.provide(HulyConfigService.layer)
  )

  // McpServer requires HulyClient
  const mcpServerLayer = McpServerService.layer({
    transport,
    httpPort,
  }).pipe(Layer.provide(hulyClientLayer))

  return mcpServerLayer
}

/**
 * Main program that starts the MCP server.
 * Runs until shutdown signal is received.
 */
export const main: Effect.Effect<void, AppError> = Effect.gen(function* () {
  // Get transport configuration
  const transport = yield* getTransportType
  const httpPort = yield* getHttpPort

  // Note: No console output here - stdout reserved for MCP protocol in stdio mode

  // Build layer stack
  const appLayer = buildAppLayer(transport, httpPort)

  // Get server service and run
  yield* Effect.gen(function* () {
    const server = yield* McpServerService
    yield* server.run()
  }).pipe(
    Effect.provide(appLayer),
    Effect.scoped
  )
})

/**
 * Format error for display.
 */
const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    const tagged = error as { _tag?: string; field?: string }
    if (tagged._tag) {
      if (tagged._tag === "ConfigValidationError") {
        const field = tagged.field ? ` (${tagged.field})` : ""
        return `Configuration error${field}: ${error.message}`
      }
      if (tagged._tag === "ConfigFileError") {
        return `Config file error: ${error.message}`
      }
      if (tagged._tag === "HulyConnectionError") {
        return `Connection error: ${error.message}`
      }
      if (tagged._tag === "HulyAuthError") {
        return `Authentication error: ${error.message}`
      }
      if (tagged._tag === "McpServerError") {
        return `Server error: ${error.message}`
      }
    }
    return error.message
  }
  return String(error)
}

/**
 * Handle program failure by logging and exiting.
 */
const handleFailure = (cause: Cause.Cause<AppError>): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (Cause.isFailure(cause)) {
      const error = Cause.failureOption(cause)
      if (Option.isSome(error)) {
        yield* Console.error(`Error: ${formatError(error.value)}`)
      }
    } else if (Cause.isDie(cause)) {
      const defect = Cause.dieOption(cause)
      if (Option.isSome(defect)) {
        yield* Console.error(`Fatal error: ${formatError(defect.value)}`)
      }
    } else if (Cause.isInterrupted(cause)) {
      yield* Console.log("Server interrupted")
    } else {
      yield* Console.error(`Unexpected error: ${Cause.pretty(cause)}`)
    }
  })

/**
 * Run the main program with error handling.
 */
export const run = (): Promise<void> =>
  Effect.runPromise(
    main.pipe(
      Effect.catchAllCause((cause) =>
        handleFailure(cause).pipe(
          Effect.flatMap(() => Effect.fail(cause))
        )
      ),
      Effect.catchAll(() => Effect.void)
    )
  )

// Always run when executed (works in both ESM and CommonJS after bundling)
if (typeof require !== 'undefined' && require.main === module) {
  // CommonJS entry point (bundled)
  run().catch((error) => {
    console.error("Unhandled error:", error)
    process.exit(1)
  })
} else if (typeof import.meta !== 'undefined') {
  // ESM entry point
  try {
    const moduleUrl = new URL(import.meta.url)
    const argPath = process.argv[1]

    if (argPath) {
      const modulePath = moduleUrl.pathname
      const normalizedArgPath = argPath.startsWith("file://")
        ? new URL(argPath).pathname
        : argPath

      if (modulePath === normalizedArgPath ||
          modulePath.endsWith(normalizedArgPath) ||
          normalizedArgPath.endsWith(modulePath.split("/").pop() ?? "")) {
        run().catch((error) => {
          console.error("Unhandled error:", error)
          process.exit(1)
        })
      }
    }
  } catch {
    // Not main module
  }
}
