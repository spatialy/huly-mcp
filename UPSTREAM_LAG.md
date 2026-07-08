# Upstream Lag Report: Huly Client Packages

**Date of audit:** 2026-07-08
**Audited against:** Huly platform `v0.7.426` (released 2026-07-05), npm packages `0.7.423` (published 2026-05-10)
**MCP version at audit:** `0.1.52`

This document records why this MCP server pins October-2025-era `@hcengineering/*`
packages, what functionality gap that creates, and the exact conditions under which
the pin can be lifted. It exists so future maintenance does not re-derive these facts.

## TL;DR

- **Runtime compatibility with current Huly servers (v0.7.42x): confirmed.** The wire
  protocol is unchanged — self-hosted servers can be updated to the latest release
  without touching this MCP.
- **Dependency upgrade: blocked upstream.** Every `@hcengineering/*` release newer
  than the versions we pin is defective on npm (details below). Our pins are the
  newest usable versions, not an oversight.
- **Functionality lag is additive only:** new Huly features (2FA, workspace
  permissions, processes, guest spaces) have no client API in our pinned packages.
  Nothing we currently expose is broken.

## Compatibility evidence (why servers can be upgraded safely)

Byte-level diff of the packages we bundle vs `0.7.423` (the generation matching
server v0.7.42x), performed 2026-07-08 via `npm pack` + `diff`:

| Package | Ours | Latest | Diff result |
|---|---|---|---|
| `@hcengineering/rpc` (wire serialization) | 0.7.17 | 0.7.423 | **byte-identical** |
| `@hcengineering/client-resources` (WebSocket, handshake, snappy) | 0.7.18 | 0.7.423 | **byte-identical** |
| `@hcengineering/api-client` | 0.7.18 | 0.7.423 | 1 change: Node `require()` loading fix, not protocol |
| `@hcengineering/account-client` | 0.7.20 | 0.7.423 | purely additive: new methods only, existing methods unchanged |

The client performs a `hello` handshake and receives `serverVersion` with no hard
version gate on either side. Conclusion: this MCP works unmodified against
self-hosted Huly v0.7.426.

## Why we cannot upgrade the client packages (upstream npm defects)

Packages moved from `hcengineering/platform` to the
[`hcengineering/huly.core`](https://github.com/hcengineering/huly.core) monorepo
(Rush) around March 2026 and are now version-locked per release. Every release
since the move is broken for consumers in one of two ways:

### Defect 1: `0.7.382` (2026-03-16) — uninstallable

Published with unsubstituted `workspace:` protocol dependencies, e.g.
`@hcengineering/account-client@0.7.382` depends on
`"@hcengineering/core": "workspace:^0.7.382"`. npm/pnpm cannot resolve
`workspace:` outside the source monorepo; install fails with
`ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`. Affects at least `account-client`,
`api-client`, `core` (verified via `npm view <pkg>@0.7.382 dependencies`).

### Defect 2: `0.7.411`, `0.7.413`, `0.7.423` (2026-04/05) — no TypeScript declarations

The `workspace:` leakage was fixed, but the tarballs ship **zero `.d.ts` files**
while `package.json` still declares `"types": "types/index.d.ts"`. Verified across
`core`, `api-client`, `tracker`, `contact`, `text`. Our codebase (strict
`typecheck`, Effect Schema at boundaries) fails with ~100 `TS7016` errors.
An upgrade test on 2026-07-08 confirmed **`pnpm build` succeeds** at `0.7.423`
(the JS is fine) — only typing is missing.

Declaration file count by version (`npm pack <pkg>@<v> --dry-run`):

| `@hcengineering/core` version | `.d.ts` files |
|---|---|
| 0.7.23 (ours) | 86 |
| 0.7.382 | 88 (but uninstallable, see Defect 1) |
| 0.7.411 / 0.7.413 / 0.7.423 | **0** |

### Defect 3: `@hcengineering/document` never republished

Latest on npm is `0.7.0` (2025-10). All other domain plugins got a `0.7.423`
(typeless) release; `document` did not. Any future bulk pin to a single version
must exempt it.

### Upstream tracking

- [hcengineering/platform#10767](https://github.com/hcengineering/platform/issues/10767) —
  original missing-declarations report for 0.7.413 (closed via PR
  [#10768](https://github.com/hcengineering/platform/pull/10768), merged 2026-04-15).
- [hcengineering/platform#10881](https://github.com/hcengineering/platform/issues/10881) —
  **open** (2026-05-24): 0.7.423 still ships without declarations despite the fix.
  This is the issue to watch.
- The `workspace:` leakage in 0.7.382 (Defect 1) is **not** reported anywhere we
  could find. It is moot for future releases (fixed in ≥0.7.411) but worth a
  comment on #10881 because that issue names 0.7.382 as the "last usable version",
  which is wrong — 0.7.382 is uninstallable, making the 0.7.19-era packages
  (exactly what we pin) the true ceiling.
- Note: **issue creation is disabled on `hcengineering/huly.core`** — file against
  `hcengineering/platform` instead.

## Functionality gaps (features we cannot expose until the pin lifts)

Server-side features added between our package generation (Oct 2025 / Feb 2026)
and v0.7.426, with no client API in our pinned packages:

| Feature (server release) | Missing client API | MCP impact |
|---|---|---|
| Two-factor authentication (v0.7.411) | `account-client`: `verify2fa`, `generate2faSecret`, `enable2fa`, `disable2fa`, `checkHasPassword`, `requestPasswordSetup` | **Operational caveat:** email/password login by this MCP may fail for accounts with 2FA enabled. Use a non-2FA service account or `HULY_TOKEN`. This is the most likely future forcing-function for an upgrade. |
| Workspace permission management (v0.7.423+) | `account-client`: `batchAssignWorkspacePermission`, `batchRevokeWorkspacePermission`, `hasWorkspacePermission`, `getWorkspacePermissions`, `getWorkspaceUsersWithPermission` | No permission-management tools possible. |
| Invite/join flows | `account-client`: `joinByToken`, `getInviteInfo` | No invite tools possible. |
| Processes / process functions (v0.7.382–0.7.426) | newer `card`/process plugin models | Cards CRUD works (`list_cards`, `create_card`, …) but process definitions/executions are unreachable. |
| Card grid layout, required attributes, reference versioning (v0.7.423) | newer `card` plugin model | New card attributes not surfaced; existing card tools unaffected. |
| Guest spaces / configurable guest permissions (v0.7.423) | newer core/space models | Not exposable. |
| User statuses (v0.7.423) | newer contact/presence models | Not exposable. |
| Product versioning, backup/restore APIs (v0.7.426) | not in any published client package generation we can consume | Not exposable. |

Everything currently exposed (174 tools: tracker, documents, contacts, chunter,
calendar, time, tags, activity, cards, …) targets APIs that are unchanged in
v0.7.426.

## Unblock criteria and upgrade procedure

The pin can be lifted when a release **newer than 0.7.423** ships with declaration
files. Re-check (cheap, no install):

```bash
V=$(npm view @hcengineering/core version)
npm pack @hcengineering/core@$V --dry-run 2>&1 | grep -c '\.d\.ts'
# > 0  → upgrade is unblocked
```

Also confirm no `workspace:` leakage:

```bash
npm view @hcengineering/api-client@$V dependencies --json | grep -c 'workspace:'
# must be 0
```

When unblocked:

1. Pin all `@hcengineering/*` to the new version, **except**
   `@hcengineering/document` (keep `^0.7.0` unless it was republished too).
2. `pnpm install --no-frozen-lockfile && pnpm build && pnpm typecheck && pnpm lint && pnpm test`.
3. Run integration tests against a local Huly at the matching server version
   (see `INTEGRATION_TESTING.md`).
4. Evaluate exposing the gap features above (2FA-aware auth first — it removes
   the service-account caveat).
5. Delete this file or update it to reflect the new state.

## Context: Huly hosting landscape (2026-07)

- Hosted `huly.app` shuts down ~2026-07-20 (hosting defunded; login already
  redirects toward huly.io). Self-hosted deployments are unaffected and are the
  actively maintained path (`hcengineering/huly-selfhost` tracks platform releases
  same-day, currently v0.7.426).
- No official first-party Huly MCP server exists as of this audit; all known Huly
  MCP servers, including this one, are community-built.
