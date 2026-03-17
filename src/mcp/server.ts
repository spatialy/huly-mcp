/**
 * MCP Server infrastructure for Huly MCP server.

 * @module
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { Config, Context, Effect, Layer, Ref, Schema } from "effect"

import type { HttpServerFactoryService, HttpTransportError } from "./http-transport.js"
import { DEFAULT_HTTP_PORT, startHttpTransport } from "./http-transport.js"

import { HulyClient } from "../huly/client.js"
import { HulyStorageClient } from "../huly/storage.js"
import { WorkspaceClient, type WorkspaceClientOperations } from "../huly/workspace-client.js"
import type { TelemetryOperations } from "../telemetry/telemetry.js"
import { TelemetryService } from "../telemetry/telemetry.js"
import { VERSION } from "../version.js"
import { createErrorResponse, createUnknownToolError, McpErrorCode, toMcpResponse } from "./error-mapping.js"
import type { ToolRegistry } from "./tools/index.js"
import { CATEGORY_NAMES, createFilteredRegistry, resolveAnnotations, toolRegistry } from "./tools/index.js"

export const createConcurrencyLimiter = (maxConcurrent: number) => {
  let active = 0
  const queue: Array<() => void> = []
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= maxConcurrent) {
      await new Promise<void>((resolve) => queue.push(resolve))
    }
    active++
    try {
      return await fn()
    } finally {
      active--
      queue.shift()?.()
    }
  }
}

interface McpInputSchema {
  readonly type: "object"
  readonly properties?: Record<string, unknown>
  readonly required?: Array<string>
  readonly [key: string]: unknown
}

const isObjectSchema = (schema: object): schema is McpInputSchema => "type" in schema && schema.type === "object"

export type McpTransportType = "stdio" | "http"

interface McpServerConfig {
  readonly transport: McpTransportType
  readonly httpPort?: number
  readonly httpHost?: string
  readonly autoExit?: boolean
  readonly authMethod?: "token" | "password"
}

export class McpServerError extends Schema.TaggedError<McpServerError>()(
  "McpServerError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect)
  }
) {}

const parseToolsets = (raw: string | undefined): ReadonlySet<string> | undefined => {
  if (raw === undefined || raw.trim() === "") return undefined
  const requested = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  const enabled = new Set<string>()
  for (const r of requested) {
    if (CATEGORY_NAMES.has(r)) {
      enabled.add(r)
    } else {
      console.error(
        `Warning: unknown toolset category "${r}", ignoring. Valid categories: ${[...CATEGORY_NAMES].join(", ")}`
      )
    }
  }
  return enabled.size > 0 ? enabled : undefined
}

interface McpServerOperations {
  readonly run: () => Effect.Effect<void, McpServerError, HttpServerFactoryService>
  readonly stop: () => Effect.Effect<void, McpServerError>
}

/**
 * Create a configured MCP Server instance with tool handlers.
 * Used for both stdio and HTTP transports.
 */
const MAX_CONCURRENT_TOOLS = 8

const createMcpServer = (
  hulyClient: HulyClient["Type"],
  storageClient: HulyStorageClient["Type"],
  telemetry: TelemetryOperations,
  registry: ToolRegistry,
  workspaceClient?: WorkspaceClientOperations,
  onToolStart?: () => void,
  onToolEnd?: () => void,
  limitConcurrency?: <T>(fn: () => Promise<T>) => Promise<T>
): Server => {
  const server = new Server(
    {
      name: "huly-mcp",
      version: VERSION
    },
    {
      capabilities: {
        tools: {}
      }
    }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    telemetry.firstListTools()
    return {
      tools: registry.definitions.flatMap((tool) => {
        if (!isObjectSchema(tool.inputSchema)) return []
        return [{
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: resolveAnnotations(tool)
        }]
      })
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const execute = async () => {
      onToolStart?.()
      const { arguments: args, name } = request.params
      const start = Date.now()

      try {
        const response = await registry.handleToolCall(
          name,
          args ?? {},
          hulyClient,
          storageClient,
          workspaceClient
        )
        const durationMs = Date.now() - start

        if (response === null) {
          const errorResponse = createUnknownToolError(name)
          telemetry.toolCalled({
            toolName: name,
            status: "error",
            errorTag: errorResponse._meta.errorTag,
            durationMs
          })
          return toMcpResponse(errorResponse)
        }

        const isInternalError = response._meta?.errorCode === McpErrorCode.InternalError
        telemetry.toolCalled({
          toolName: name,
          status: isInternalError ? "error" : "success",
          errorTag: response._meta?.errorTag,
          durationMs
        })

        return toMcpResponse(response)
      } catch {
        const durationMs = Date.now() - start
        telemetry.toolCalled({ toolName: name, status: "error", errorTag: "UnhandledException", durationMs })
        return toMcpResponse(createErrorResponse(
          `Internal error processing ${name}`,
          McpErrorCode.InternalError,
          "UnhandledException"
        ))
      } finally {
        onToolEnd?.()
      }
    }
    return limitConcurrency ? limitConcurrency(execute) : execute()
  })

  return server
}

export class McpServerService extends Context.Tag("@hulymcp/McpServer")<
  McpServerService,
  McpServerOperations
>() {
  static layer(
    config: McpServerConfig
  ): Layer.Layer<McpServerService, never, HulyClient | HulyStorageClient | WorkspaceClient | TelemetryService> {
    return Layer.effect(
      McpServerService,
      Effect.gen(function*() {
        const hulyClient = yield* HulyClient
        const storageClient = yield* HulyStorageClient
        const workspaceClient = yield* WorkspaceClient
        const telemetry = yield* TelemetryService

        const toolsetsRaw = yield* Effect.orElseSucceed(Config.string("TOOLSETS"), () => "")
        const enabledCategories = parseToolsets(toolsetsRaw || undefined)

        const toolsets = enabledCategories ? [...enabledCategories] : null
        const registry = enabledCategories
          ? createFilteredRegistry(enabledCategories)
          : toolRegistry

        telemetry.sessionStart({
          transport: config.transport,
          authMethod: config.authMethod ?? "password",
          toolCount: registry.definitions.length,
          toolsets
        })

        console.error(
          `[huly-mcp] v${VERSION} starting (${config.transport} transport, ${registry.definitions.length} tools)`
        )

        const flushTelemetry = Effect.ignore(
          Effect.tryPromise(() => telemetry.shutdown())
        )

        const serverRef = yield* Ref.make<Server | null>(null)
        const isRunning = yield* Ref.make(false)

        const operations: McpServerOperations = {
          run: () =>
            Effect.gen(function*() {
              if (yield* Ref.get(isRunning)) {
                return yield* new McpServerError({
                  message: "MCP server is already running"
                })
              }

              yield* Ref.set(isRunning, true)

              if (config.transport === "stdio") {
                const inFlightCount = yield* Ref.make(0)
                const limitConcurrency = createConcurrencyLimiter(MAX_CONCURRENT_TOOLS)
                const stdioServer = createMcpServer(
                  hulyClient,
                  storageClient,
                  telemetry,
                  registry,
                  workspaceClient,
                  () => Effect.runSync(Ref.update(inFlightCount, (n) => n + 1)),
                  () => Effect.runSync(Ref.update(inFlightCount, (n) => n - 1)),
                  limitConcurrency
                )
                yield* Ref.set(serverRef, stdioServer)
                const transport = new StdioServerTransport()

                yield* Effect.tryPromise({
                  try: () => stdioServer.connect(transport),
                  catch: (e) =>
                    new McpServerError({
                      message: `Failed to connect stdio transport: ${String(e)}`,
                      cause: e
                    })
                })

                yield* Effect.async<void, McpServerError>((resume) => {
                  const cleanup = () => {
                    Effect.runSync(Ref.set(isRunning, false))
                    resume(Effect.void)
                  }

                  process.on("SIGINT", cleanup)
                  process.on("SIGTERM", cleanup)

                  if (config.autoExit) {
                    process.stdin.on("end", cleanup)
                    process.stdin.on("close", cleanup)
                  }

                  return Effect.sync(() => {
                    process.off("SIGINT", cleanup)
                    process.off("SIGTERM", cleanup)
                    if (config.autoExit) {
                      process.stdin.off("end", cleanup)
                      process.stdin.off("close", cleanup)
                    }
                  })
                })

                const DRAIN_TIMEOUT_MS = 10_000
                const DRAIN_POLL_MS = 100
                yield* Effect.gen(function*() {
                  const deadline = Date.now() + DRAIN_TIMEOUT_MS
                  let count = yield* Ref.get(inFlightCount)
                  while (count > 0 && Date.now() < deadline) {
                    yield* Effect.sleep(`${DRAIN_POLL_MS} millis`)
                    count = yield* Ref.get(inFlightCount)
                  }
                  if (count > 0) {
                    console.error(
                      `Shutdown: ${count} tool calls still in-flight after ${DRAIN_TIMEOUT_MS}ms timeout, proceeding`
                    )
                  }
                })

                yield* flushTelemetry

                yield* Effect.tryPromise({
                  try: () => stdioServer.close(),
                  catch: (e) =>
                    new McpServerError({
                      message: `Failed to close server: ${String(e)}`,
                      cause: e
                    })
                })
              } else {
                const port = config.httpPort ?? DEFAULT_HTTP_PORT
                const host = config.httpHost ?? "127.0.0.1"

                yield* startHttpTransport(
                  { port, host },
                  () => createMcpServer(hulyClient, storageClient, telemetry, registry, workspaceClient)
                ).pipe(
                  Effect.scoped,
                  Effect.mapError(
                    (e: HttpTransportError) =>
                      new McpServerError({
                        message: e.message,
                        cause: e.cause
                      })
                  )
                )

                yield* Ref.set(isRunning, false)
                yield* flushTelemetry
              }
            }),

          stop: () =>
            Effect.gen(function*() {
              if (!(yield* Ref.get(isRunning))) {
                return
              }

              yield* Ref.set(isRunning, false)

              yield* flushTelemetry

              const runningServer = yield* Ref.get(serverRef)
              if (runningServer !== null) {
                yield* Effect.tryPromise({
                  try: () => runningServer.close(),
                  catch: (e) =>
                    new McpServerError({
                      message: `Failed to stop server: ${String(e)}`,
                      cause: e
                    })
                })
                yield* Ref.set(serverRef, null)
              }
            })
        }

        return operations
      })
    )
  }

  static testLayer(
    mockOperations: Partial<McpServerOperations>
  ): Layer.Layer<McpServerService> {
    const defaultOps: McpServerOperations = {
      run: () => Effect.void,
      stop: () => Effect.void
    }

    return Layer.succeed(McpServerService, { ...defaultOps, ...mockOperations })
  }
}
