/**
 * Configuration module for Huly MCP server.
 *
 * Loads config from environment variables and optional .hulyrc.json file.
 * Credentials (email, password) only from env vars for security.
 * Non-sensitive config (url, workspace, timeout) can come from file.
 * Env vars always override file config.
 *
 * @module
 */
import { Config, Context, Effect, Layer, Option, Redacted, Schema } from "effect"
import * as fs from "node:fs"
import * as path from "node:path"

// --- Schemas ---

/**
 * Schema for URL validation - must be valid http/https URL.
 */
const UrlSchema = Schema.String.pipe(
  Schema.filter((s) => {
    try {
      const url = new URL(s)
      return url.protocol === "http:" || url.protocol === "https:"
    } catch {
      return false
    }
  }, { message: () => "Must be a valid http or https URL" })
)

/**
 * Schema for non-empty string.
 */
const NonEmptyString = Schema.String.pipe(
  Schema.filter((s) => s.trim().length > 0, { message: () => "Must not be empty" })
)

/**
 * Schema for positive integer (timeout in ms).
 */
const PositiveInt = Schema.Number.pipe(
  Schema.int({ message: () => "Must be an integer" }),
  Schema.positive({ message: () => "Must be positive" })
)

/**
 * Schema for optional config file content (.hulyrc.json).
 * Only non-sensitive values allowed.
 */
export const FileConfigSchema = Schema.Struct({
  url: Schema.optional(UrlSchema),
  workspace: Schema.optional(NonEmptyString),
  connectionTimeout: Schema.optional(PositiveInt),
})

export type FileConfig = Schema.Schema.Type<typeof FileConfigSchema>

/**
 * Full configuration schema after merging sources.
 */
export const HulyConfigSchema = Schema.Struct({
  url: UrlSchema,
  email: NonEmptyString,
  password: Schema.Redacted(NonEmptyString),
  workspace: NonEmptyString,
  connectionTimeout: PositiveInt,
})

export type HulyConfig = Schema.Schema.Type<typeof HulyConfigSchema>

// --- Config Errors ---

/**
 * Configuration validation error.
 */
export class ConfigValidationError extends Schema.TaggedError<ConfigValidationError>()(
  "ConfigValidationError",
  {
    message: Schema.String,
    field: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Defect),
  }
) {}

/**
 * Configuration file read error.
 */
export class ConfigFileError extends Schema.TaggedError<ConfigFileError>()(
  "ConfigFileError",
  {
    message: Schema.String,
    path: Schema.String,
    cause: Schema.optional(Schema.Defect),
  }
) {}

export type HulyConfigError = ConfigValidationError | ConfigFileError

// --- Internal Functions ---

/**
 * Default connection timeout (30 seconds).
 */
const DEFAULT_TIMEOUT = 30000

/**
 * Config file name.
 */
const CONFIG_FILE_NAME = ".hulyrc.json"

/**
 * Load and parse config file if it exists.
 */
const loadConfigFile = (
  filePath: string
): Effect.Effect<FileConfig | null, ConfigFileError> =>
  Effect.gen(function* () {
    const exists = yield* Effect.try({
      try: () => fs.existsSync(filePath),
      catch: () => new ConfigFileError({
        message: "Failed to check config file existence",
        path: filePath,
      }),
    })

    if (!exists) {
      return null
    }

    const content = yield* Effect.try({
      try: () => fs.readFileSync(filePath, "utf-8"),
      catch: (e) => new ConfigFileError({
        message: "Failed to read config file",
        path: filePath,
        cause: e as Error,
      }),
    })

    const parsed = yield* Effect.try({
      try: () => JSON.parse(content) as unknown,
      catch: (e) => new ConfigFileError({
        message: "Config file is not valid JSON",
        path: filePath,
        cause: e as Error,
      }),
    })

    const decoded = yield* Schema.decodeUnknown(FileConfigSchema)(parsed).pipe(
      Effect.mapError((e) => new ConfigFileError({
        message: `Config file validation failed: ${e.message}`,
        path: filePath,
      }))
    )

    return decoded
  })

/**
 * Get env var value, returning undefined if not set.
 */
const getEnvVar = (key: string): Effect.Effect<string | undefined> =>
  Config.string(key).pipe(
    Config.option,
    Effect.map((opt) => Option.isSome(opt) ? opt.value : undefined),
    // Ignore config errors (missing key), just return undefined
    Effect.catchAll(() => Effect.succeed(undefined))
  )

/**
 * Load config value from env with fallback to file config.
 */
const getConfigValue = <T>(
  envKey: string,
  fileValue: T | undefined,
  defaultValue: T | undefined,
  parser: (s: string) => T
): Effect.Effect<T | undefined, ConfigValidationError> =>
  Effect.gen(function* () {
    const envValue = yield* getEnvVar(envKey)

    if (envValue !== undefined) {
      return yield* Effect.try({
        try: () => parser(envValue),
        catch: () => new ConfigValidationError({
          message: `Invalid value for ${envKey}`,
          field: envKey,
        }),
      })
    }

    if (fileValue !== undefined) {
      return fileValue
    }

    return defaultValue
  })

/**
 * Load required config value.
 */
const getRequiredConfigValue = <T>(
  envKey: string,
  fileValue: T | undefined,
  parser: (s: string) => T
): Effect.Effect<T, ConfigValidationError> =>
  Effect.gen(function* () {
    const value = yield* getConfigValue(envKey, fileValue, undefined, parser)
    if (value === undefined) {
      return yield* new ConfigValidationError({
        message: `Missing required config: ${envKey}`,
        field: envKey,
      })
    }
    return value
  })

/**
 * Load the full configuration.
 */
const loadConfig = (): Effect.Effect<HulyConfig, HulyConfigError> =>
  Effect.gen(function* () {
    // Try to load config file from current working directory
    const configPath = path.resolve(process.cwd(), CONFIG_FILE_NAME)
    const fileConfig = yield* loadConfigFile(configPath)

    // Load each config value with proper fallback chain
    const url = yield* getRequiredConfigValue(
      "HULY_URL",
      fileConfig?.url,
      (s) => s
    )

    // Credentials only from env vars (security)
    const email = yield* getRequiredConfigValue("HULY_EMAIL", undefined, (s) => s)
    const passwordStr = yield* getRequiredConfigValue("HULY_PASSWORD", undefined, (s) => s)

    const workspace = yield* getRequiredConfigValue(
      "HULY_WORKSPACE",
      fileConfig?.workspace,
      (s) => s
    )

    const connectionTimeout = yield* getConfigValue(
      "HULY_CONNECTION_TIMEOUT",
      fileConfig?.connectionTimeout,
      DEFAULT_TIMEOUT,
      (s) => {
        const n = parseInt(s, 10)
        if (isNaN(n) || n <= 0) {
          throw new Error("Must be a positive integer")
        }
        return n
      }
    )

    // Validate the assembled config
    const config: HulyConfig = {
      url,
      email,
      password: Redacted.make(passwordStr),
      workspace,
      connectionTimeout: connectionTimeout ?? DEFAULT_TIMEOUT,
    }

    // Validate URL format
    yield* Schema.decodeUnknown(UrlSchema)(config.url).pipe(
      Effect.mapError(() => new ConfigValidationError({
        message: "HULY_URL must be a valid http or https URL",
        field: "HULY_URL",
      }))
    )

    // Validate non-empty strings
    if (config.email.trim().length === 0) {
      return yield* new ConfigValidationError({
        message: "HULY_EMAIL must not be empty",
        field: "HULY_EMAIL",
      })
    }

    if (Redacted.value(config.password).trim().length === 0) {
      return yield* new ConfigValidationError({
        message: "HULY_PASSWORD must not be empty",
        field: "HULY_PASSWORD",
      })
    }

    if (config.workspace.trim().length === 0) {
      return yield* new ConfigValidationError({
        message: "HULY_WORKSPACE must not be empty",
        field: "HULY_WORKSPACE",
      })
    }

    if (config.connectionTimeout <= 0) {
      return yield* new ConfigValidationError({
        message: "HULY_CONNECTION_TIMEOUT must be positive",
        field: "HULY_CONNECTION_TIMEOUT",
      })
    }

    return config
  })

// --- Config Service ---

/**
 * HulyConfig service tag.
 */
export class HulyConfigService extends Context.Tag("@hulymcp/HulyConfig")<
  HulyConfigService,
  HulyConfig
>() {
  /**
   * Default connection timeout (30 seconds).
   */
  static readonly DEFAULT_TIMEOUT = DEFAULT_TIMEOUT

  /**
   * Config file name.
   */
  static readonly CONFIG_FILE_NAME = CONFIG_FILE_NAME

  /**
   * Load config from env vars, with optional file fallback.
   * This is the production layer.
   */
  static readonly layer: Layer.Layer<HulyConfigService, HulyConfigError> = Layer.effect(
    HulyConfigService,
    loadConfig()
  )

  /**
   * Create a test layer with explicit config values.
   */
  static testLayer(config: {
    url: string
    email: string
    password: string
    workspace: string
    connectionTimeout?: number
  }): Layer.Layer<HulyConfigService> {
    return Layer.succeed(
      HulyConfigService,
      {
        url: config.url,
        email: config.email,
        password: Redacted.make(config.password),
        workspace: config.workspace,
        connectionTimeout: config.connectionTimeout ?? DEFAULT_TIMEOUT,
      }
    )
  }
}
