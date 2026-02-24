# Project Instructions

Rules are reflexive: when adding a rule, apply it immediately.

## Design Principle: LLM-First API

The primary consumer of this MCP server is an LLM coding agent, not a human developer. All design decisions — tool naming, parameter shapes, description writing, error messages, defaults — must optimize for LLM comprehension and single-call correctness. Prefer fewer tool calls with clear semantics over multi-step protocols. Auto-resolve identifiers where possible rather than requiring the caller to decompose them. Write tool descriptions as if the reader has no documentation beyond the schema and the description string.

## Package Manager

Use `pnpm`, not npm. Prefer package.json scripts over raw commands (e.g., `pnpm typecheck` not `pnpm tsc --noEmit`).

## Verification

Run before considering work complete:
1. `pnpm build && pnpm typecheck && pnpm lint && pnpm test`
2. Integration tests against local Huly (Docker) — **required** for any new feature, major change, or pre-release. Do not defer to the user; run them yourself. See `INTEGRATION_TESTING.md` for test patterns and `CLAUDE.local.md` for credentials/setup.

## Code Style

No comments that repeat the code. If the code says what it does, don't add a comment saying the same thing.

## No Dead Code

Every function, type, and export must have at least one call site at time of writing. Never write code "for future use" unless the user explicitly requests it.

## Tests

Don't write tests that only verify compile-time guarantees (type assignments, interface conformance). If the compiler already checks it, a test adds nothing.

## Type Safety

Type casts (`as T`) are a sin. Avoid them. When unavoidable:
1. Add a comment explaining WHY the cast is necessary
2. Document what evidence/API docs support the cast being safe
3. Consider if a generic type parameter or type guard could eliminate the cast

All data crossing system boundaries (APIs etc.) must be strongly typed — both inbound (decoding) and outbound (encoding), with Effect Schema.

<!-- effect-solutions:start -->
## Effect Best Practices

**IMPORTANT:** Always consult effect-solutions before writing Effect code.

1. Run `effect-solutions list` to see available guides
2. Run `effect-solutions show <topic>...` for relevant patterns (supports multiple topics)

Topics: quick-start, project-setup, tsconfig, basics, services-and-layers, data-modeling, error-handling, config, testing, cli.

Never guess at Effect patterns - check the guide first.
<!-- effect-solutions:end -->

## Huly API Reference

**Source**: https://github.com/hcengineering/huly-examples/tree/main/platform-api

Key examples to reference:
- Issue management: `examples/issue-*.ts`
- Document operations: `examples/documents/document-*.ts`
- Contact/person handling: `examples/person-*.ts`

Search examples for real usage patterns when implementing MCP tools.

## Manual Testing (stdio)

```bash
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_projects","arguments":{}},"id":2}' | \
HULY_URL=... HULY_EMAIL=... HULY_PASSWORD=... HULY_WORKSPACE=... timeout 5 node dist/index.cjs
```

Use short timeouts (5s) - MCP keeps connection open.

## Worktrees

Worktrees symlink `node_modules` to the main tree. `.gitignore` must use `node_modules` (no trailing slash) — trailing slash only matches directories, not symlinks, so `git add .` will commit the symlink.

Before deleting a worktree or branch, always check for uncommitted changes (`git status`) and unmerged commits (`git log <branch> --not master`) first. Never force-delete without verifying all work is integrated.

After merging a worktree branch, verify the merge commit actually landed (`git log --oneline -1`) and that CODE_SMELLS.md updates are staged — don't leave integration work uncommitted.

## Publishing

```bash
pnpm build && pnpm version patch && pnpm publish && git push
```

Package: `@spatialy/huly-mcp` on npm.
