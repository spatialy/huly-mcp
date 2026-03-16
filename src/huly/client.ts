/**
 * HulyClient - Data operations within a workspace.
 *
 * Uses WebSocket transport (TxOperations) for CRUD on documents:
 * issues, projects, milestones, documents, contacts, comments, etc.
 *
 * For workspace/account management (members, settings, workspace lifecycle),
 * see WorkspaceClient in workspace-client.ts.
 *
 * @module
 */
import { getClient as getAccountClient } from "@hcengineering/account-client"
import {
  getWorkspaceToken,
  loadServerConfig,
  type MarkupFormat,
  type MarkupRef,
  NodeWebSocketFactory
} from "@hcengineering/api-client"
import {
  type AttachedData,
  type AttachedDoc,
  type Class,
  type Client,
  type Data,
  type Doc,
  type DocumentQuery,
  type DocumentUpdate,
  type FindOptions,
  type FindResult,
  pickPrimarySocialId,
  type Ref,
  type Space,
  toFindResult,
  TxOperations,
  type TxResult,
  type WithLookup
} from "@hcengineering/core"
import { Context, Effect, Layer, Schedule } from "effect"
import * as MutableRef from "effect/Ref"

import { HulyConfigService } from "../config/config.js"
import { authToOptions, type ConnectionConfig, type ConnectionError, connectWithRetry } from "./auth-utils.js"
import { HulyAuthError, HulyConnectionError } from "./errors.js"
import { createMarkupOps, type MarkupOperations } from "./markup-ops.js"

const CONNECTION_DEAD_PATTERNS = [
  "Connection closed",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "socket hang up",
  "WebSocket is not open"
]

const isConnectionDead = (error: HulyConnectionError): boolean => {
  const msg = String(error.cause ?? error.message)
  return CONNECTION_DEAD_PATTERNS.some((p) => msg.includes(p))
}

export type HulyClientError = ConnectionError

export interface HulyClientOperations {
  readonly findAll: <T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ) => Effect.Effect<FindResult<T>, HulyClientError>

  readonly findOne: <T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ) => Effect.Effect<WithLookup<T> | undefined, HulyClientError>

  readonly createDoc: <T extends Doc>(
    _class: Ref<Class<T>>,
    space: Ref<Space>,
    attributes: Data<T>,
    id?: Ref<T>
  ) => Effect.Effect<Ref<T>, HulyClientError>

  readonly updateDoc: <T extends Doc>(
    _class: Ref<Class<T>>,
    space: Ref<Space>,
    objectId: Ref<T>,
    operations: DocumentUpdate<T>,
    retrieve?: boolean
  ) => Effect.Effect<TxResult, HulyClientError>

  readonly addCollection: <T extends Doc, P extends AttachedDoc>(
    _class: Ref<Class<P>>,
    space: Ref<Space>,
    attachedTo: Ref<T>,
    attachedToClass: Ref<Class<T>>,
    collection: string,
    attributes: AttachedData<P>,
    id?: Ref<P>
  ) => Effect.Effect<Ref<P>, HulyClientError>

  readonly removeDoc: <T extends Doc>(
    _class: Ref<Class<T>>,
    space: Ref<Space>,
    objectId: Ref<T>
  ) => Effect.Effect<TxResult, HulyClientError>

  readonly uploadMarkup: (
    objectClass: Ref<Class<Doc>>,
    objectId: Ref<Doc>,
    objectAttr: string,
    markup: string,
    format: MarkupFormat
  ) => Effect.Effect<MarkupRef, HulyClientError>

  readonly fetchMarkup: (
    objectClass: Ref<Class<Doc>>,
    objectId: Ref<Doc>,
    objectAttr: string,
    id: MarkupRef,
    format: MarkupFormat
  ) => Effect.Effect<string, HulyClientError>

  readonly updateMarkup: (
    objectClass: Ref<Class<Doc>>,
    objectId: Ref<Doc>,
    objectAttr: string,
    markup: string,
    format: MarkupFormat
  ) => Effect.Effect<void, HulyClientError>
}

export class HulyClient extends Context.Tag("@hulymcp/HulyClient")<
  HulyClient,
  HulyClientOperations
>() {
  // Lazy connection: deferred until first tool call.
  // MCP server responds to initialize/tools/list instantly without waiting for WebSocket.
  static readonly layer: Layer.Layer<
    HulyClient,
    HulyClientError,
    HulyConfigService
  > = Layer.scoped(
    HulyClient,
    Effect.gen(function*() {
      const config = yield* HulyConfigService

      const CONNECT_TIMEOUT = "30 seconds"
      const connRef = yield* MutableRef.make<WsConnection | null>(null)
      const connectLock = yield* Effect.makeSemaphore(1)

      const doConnect = Effect.tap(
        connectWebSocketWithRetry({ url: config.url, auth: config.auth, workspace: config.workspace }).pipe(
          Effect.timeoutFail({
            duration: CONNECT_TIMEOUT,
            onTimeout: () => new HulyConnectionError({ message: `Connection timed out after ${CONNECT_TIMEOUT}` })
          })
        ),
        (conn) => MutableRef.set(connRef, conn)
      )

      const ensureConnection: Effect.Effect<WsConnection, HulyClientError> = Effect.gen(function*() {
        const existing = yield* MutableRef.get(connRef)
        if (existing !== null) return existing

        return yield* connectLock.withPermits(1)(
          Effect.gen(function*() {
            const afterLock = yield* MutableRef.get(connRef)
            if (afterLock !== null) return afterLock
            return yield* doConnect
          })
        )
      })

      yield* Effect.addFinalizer(() =>
        Effect.flatMap(MutableRef.get(connRef), (conn) =>
          conn !== null
            ? Effect.tryPromise({ try: () => conn.wsClient.close(), catch: () => undefined }).pipe(Effect.ignore)
            : Effect.void)
      )

      const operationRetrySchedule = Schedule.exponential("100 millis").pipe(
        Schedule.compose(Schedule.recurs(2))
      )

      const withConnection = <A>(
        op: (conn: WsConnection) => Promise<A>,
        errorMsg: string
      ): Effect.Effect<A, HulyClientError> =>
        Effect.gen(function*() {
          const conn = yield* ensureConnection
          return yield* Effect.tryPromise({
            try: () => op(conn),
            catch: (e) =>
              new HulyConnectionError({
                message: `${errorMsg}: ${String(e)}`,
                cause: e
              })
          })
        }).pipe(
          Effect.tapError((e) =>
            e instanceof HulyConnectionError && isConnectionDead(e)
              ? MutableRef.set(connRef, null)
              : Effect.void
          ),
          Effect.retry({
            schedule: operationRetrySchedule,
            while: (e) => !(e instanceof HulyAuthError)
          })
        )

      const withClient = <A>(
        op: (client: TxOperations) => Promise<A>,
        errorMsg: string
      ): Effect.Effect<A, HulyClientError> => withConnection((conn) => op(conn.client), errorMsg)

      const operations: HulyClientOperations = {
        findAll: <T extends Doc>(
          _class: Ref<Class<T>>,
          query: DocumentQuery<T>,
          options?: FindOptions<T>
        ) =>
          withClient(
            (client) => client.findAll(_class, query, options),
            "findAll failed"
          ),

        findOne: <T extends Doc>(
          _class: Ref<Class<T>>,
          query: DocumentQuery<T>,
          options?: FindOptions<T>
        ) =>
          withClient(
            (client) => client.findOne(_class, query, options),
            "findOne failed"
          ),

        createDoc: <T extends Doc>(
          _class: Ref<Class<T>>,
          space: Ref<Space>,
          attributes: Data<T>,
          id?: Ref<T>
        ) =>
          withClient(
            (client) => client.createDoc(_class, space, attributes, id),
            "createDoc failed"
          ),

        updateDoc: <T extends Doc>(
          _class: Ref<Class<T>>,
          space: Ref<Space>,
          objectId: Ref<T>,
          ops: DocumentUpdate<T>,
          retrieve?: boolean
        ) =>
          withClient(
            (client) => client.updateDoc(_class, space, objectId, ops, retrieve),
            "updateDoc failed"
          ),

        addCollection: <T extends Doc, P extends AttachedDoc>(
          _class: Ref<Class<P>>,
          space: Ref<Space>,
          attachedTo: Ref<T>,
          attachedToClass: Ref<Class<T>>,
          collection: string,
          attributes: AttachedData<P>,
          id?: Ref<P>
        ) =>
          withClient(
            (client) =>
              client.addCollection(
                _class,
                space,
                attachedTo,
                attachedToClass,
                collection,
                attributes,
                id
              ),
            "addCollection failed"
          ),

        removeDoc: <T extends Doc>(
          _class: Ref<Class<T>>,
          space: Ref<Space>,
          objectId: Ref<T>
        ) =>
          withClient(
            (client) => client.removeDoc(_class, space, objectId),
            "removeDoc failed"
          ),

        uploadMarkup: (objectClass, objectId, objectAttr, markup, format) =>
          withConnection(
            (conn) => conn.markupOps.uploadMarkup(objectClass, objectId, objectAttr, markup, format),
            "uploadMarkup failed"
          ),

        fetchMarkup: (objectClass, objectId, objectAttr, id, format) =>
          withConnection(
            (conn) => conn.markupOps.fetchMarkup(objectClass, objectId, objectAttr, id, format),
            "fetchMarkup failed"
          ),

        updateMarkup: (objectClass, objectId, objectAttr, markup, format) =>
          withConnection(
            (conn) => conn.markupOps.updateMarkup(objectClass, objectId, objectAttr, markup, format),
            "updateMarkup failed"
          )
      }

      return operations
    })
  )

  static testLayer(
    mockOperations: Partial<HulyClientOperations>
  ): Layer.Layer<HulyClient> {
    const noopFindAll = <T extends Doc>(): Effect.Effect<
      FindResult<T>,
      HulyClientError
    > => Effect.succeed(toFindResult<T>([]))

    const noopFindOne = <T extends Doc>(): Effect.Effect<
      WithLookup<T> | undefined,
      HulyClientError
    > => Effect.succeed(undefined)

    const notImplemented = (name: string) => (): Effect.Effect<never, HulyClientError> =>
      Effect.fail(new HulyConnectionError({ message: `${name} not implemented in test layer` }))

    const noopFetchMarkup = (): Effect.Effect<string, HulyClientError> => Effect.succeed("")

    const defaultOps: HulyClientOperations = {
      findAll: noopFindAll,
      findOne: noopFindOne,
      createDoc: notImplemented("createDoc"),
      updateDoc: notImplemented("updateDoc"),
      addCollection: notImplemented("addCollection"),
      removeDoc: notImplemented("removeDoc"),
      uploadMarkup: notImplemented("uploadMarkup"),
      fetchMarkup: noopFetchMarkup,
      updateMarkup: notImplemented("updateMarkup")
    }

    return Layer.succeed(HulyClient, { ...defaultOps, ...mockOperations })
  }
}

type ClientFactory = (token: string, endpoint: string, opt?: { socketFactory?: unknown }) => Promise<Client>

// @hcengineering/client-resources is CJS with a default export. Under NodeNext + verbatimModuleSyntax,
// dynamic import wraps CJS as { default: { default: fn, connect: fn } }, making the types non-callable.
// We navigate the wrapper at runtime and assert through unknown since the shape is verified by the await call.

const getClientFactory = async (): Promise<ClientFactory> => {
  const mod: unknown = await import("@hcengineering/client-resources")
  type Resources = { function: { GetClient: ClientFactory } }
  type Factory = () => Promise<Resources>
  const wrapper = mod as { default: { default: Factory } | Factory }
  const factory = typeof wrapper.default === "function" ? wrapper.default : wrapper.default.default
  const resources = await factory()
  return resources.function.GetClient
}

interface WsConnection {
  client: TxOperations
  wsClient: Client
  markupOps: MarkupOperations
}

const connectWebSocket = async (
  config: ConnectionConfig
): Promise<WsConnection> => {
  const serverConfig = await loadServerConfig(config.url)
  const authOptions = authToOptions(config.auth, config.workspace)
  const { endpoint, token, workspaceId } = await getWorkspaceToken(config.url, authOptions, serverConfig)

  const accountClient = getAccountClient(serverConfig.ACCOUNTS_URL, token)
  const socialIds = await accountClient.getSocialIds(true)
  const primarySocialId = pickPrimarySocialId(socialIds)._id

  const createWsClient = await getClientFactory()
  const wsClient = await createWsClient(token, endpoint, {
    socketFactory: NodeWebSocketFactory
  })

  const client = new TxOperations(wsClient, primarySocialId)
  const markupOps = createMarkupOps(config.url, workspaceId, token, serverConfig.COLLABORATOR_URL)

  return { client, wsClient, markupOps }
}

const connectWebSocketWithRetry = (
  config: ConnectionConfig
): Effect.Effect<WsConnection, ConnectionError> => connectWithRetry(() => connectWebSocket(config), "Connection failed")
