# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

MCP server bridging AI coding assistants with Vibe Kanban project management. Locks project/repo IDs via environment variables so every tool call doesn't need boilerplate. Supports STDIO, HTTP Streamable, and Cloudflare Workers transports. Node.js >= 18.0.0.

## Build & Run

```bash
pnpm build       # Compile TypeScript → dist/
pnpm start           # Run compiled dist/index.js
pnpm dev         # Run with tsx hot reload
pnpm clean       # Remove dist/
```

Running requires Vibe Kanban to be up first (`npx vibe-kanban`), then:
```bash
VIBE_PROJECT_ID=<uuid> npx mcp-better-vibe-kanban
# HTTP transport (default port 3000):
MCP_TRANSPORT=http npx mcp-better-vibe-kanban
```

No test or lint frameworks are configured.

## Environment Variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `VIBE_PROJECT_ID` | Yes | — | Must be valid UUID |
| `VIBE_REPO_ID` | No | auto-detect | Auto-fetched from project; errors if multiple repos |
| `VIBE_API_URL` | No | `http://localhost:9119` | Vibe Kanban instance URL |
| `VIBE_WORKSPACE_ID` | No | — | For get_context tool |
| `VIBE_RESOURCE_POLL_INTERVAL` | No | `10000` | Resource subscription poll interval in ms |
| `MCP_TRANSPORT` | No | `stdio` | `stdio` or `http` |
| `MCP_PORT` | No | `3000` | HTTP server port |

## Architecture

```
bin/
└── cli.js                # Executable entry point (imports dist/index.js)
src/
├── index.ts              # Server init, STDIO + HTTP transport setup
├── config.ts             # Env var loading & UUID validation
├── tools/index.ts        # All 12 MCP tool definitions (Zod schemas + handlers)
├── api/
│   ├── client.ts         # VibeClient - HTTP wrapper using curl spawnSync
│   └── types.ts          # TypeScript interfaces for API responses
├── resources.ts          # MCP resource handlers + polling subscriptions (SHA-256 change detection)
├── tasks.ts              # MCP task primitive: polls execution process status every 5s for up to 10min
├── utils/
│   ├── formatter.ts      # Response formatting (70/20/10 pattern)
│   └── progress.ts       # Progress notification helper (best-effort, swallowed on failure)
└── worker.ts             # Cloudflare Workers entry point (excluded from tsconfig.json, compiled by Wrangler only)
examples/
├── claude-desktop-config.json
└── cursor-mcp-config.json
```

**Key architectural decisions:**
- **curl spawnSync instead of fetch** — ARM64 macOS has socket issues with Node.js native fetch for LAN IPs. `src/api/client.ts` spawns curl synchronously (`--max-time 30`, 10MB maxBuffer). This blocks the event loop during API calls — a known trade-off for ARM64 compatibility.
- **70/20/10 response format** — All tool responses follow: 70% summary, 20% structured data, 10% next steps. Handlers use `formatSuccess({ summary, data?, nextSteps? })` and `formatError({ type, message, context?, howToFix?, alternatives? })`.
- **Singleton VibeClient** — `getVibeClient()` returns a cached instance.
- **Resource polling** — Resources use SHA-256 hash change detection with configurable poll interval (default 10s).
- **Tag expansion** — `@tagname` in descriptions auto-expands via `/api/tags` endpoint.
- **Executor normalization** — Executor strings are trimmed, hyphens replaced with underscores, and uppercased (e.g., `claude-code` → `CLAUDE_CODE`). Valid executors: `claude_code`, `amp`, `gemini`, `codex`, `opencode`, `cursor`, `qwen_code`, `copilot`, `droid`.
- **send_message auto-queue** — If sending a follow-up fails with "running"/"busy"/"409"/"conflict" in the error, and `auto_queue` is not explicitly false, the message is automatically queued.

## MCP Resources

| URI | Content |
|-----|---------|
| `vibe://tasks` | All project tasks |
| `vibe://context` | Workspace context (only when `VIBE_WORKSPACE_ID` set) |
| `vibe://tasks/{taskId}` | Individual task details |
| `vibe://sessions/{sessionId}` | Session info |
| `vibe://sessions/{sessionId}/queue` | Queue status |

## The 12 MCP Tools

Task management: `get_context`, `list_tasks`, `create_task`, `get_task`, `update_task`, `delete_task`
Session management: `start_workspace_session`, `list_sessions`, `get_session`, `send_message`
Monitoring: `get_queue_status`, `cancel_queue`

## Gotchas

- **ESM project** (`"type": "module"`) — all TypeScript imports must use `.js` extensions (e.g., `import { foo } from './bar.js'`).
- **Version sync** — `SERVER_VERSION` in `src/index.ts` and `src/worker.ts` is hardcoded and NOT auto-synced with `package.json`. When bumping versions, update all three locations.
- **worker.ts excluded from tsconfig** — only compiled by Wrangler for Cloudflare Workers. Progress notifications and task primitives do not work in the Workers deployment (the `extra` parameter is passed as `{} as any`).
- **HTTP transport** serves on `/mcp` path (not root). `/health` endpoint for health checks. Sessions managed via `mcp-session-id` header. DELETE to `/mcp` closes a session.
- **MCP tasks are experimental** — uses `InMemoryTaskStore` from `@modelcontextprotocol/sdk/experimental/tasks`.

## CI/CD

GitHub Actions (`.github/workflows/npm-publish.yml`): pushes to main auto-publish to npm with OIDC provenance. Auto-bumps version if current version already exists on npm. Binary names: `mcp-better-vibe-kanban`, `vibe-kanban-better-mcp`, `vkb-mcp`. Ignores pushes that only change `*.md`, `docs/**`, `LICENSE`, or `.gitignore`. Commits containing `[skip ci]` skip the build.
