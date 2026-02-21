MCP server that bridges your AI coding assistant to [Vibe Kanban](https://github.com/vibe-kanban). manage tasks, start sessions, send follow-ups, monitor execution — all without leaving Claude Code, Cursor, Amp, or whatever you're using.

```bash
VIBE_PROJECT_ID=<uuid> npx mcp-better-vibe-kanban
```

locks to a single project at startup so every tool call is zero-boilerplate. no project IDs in every request.

[![node](https://img.shields.io/badge/node-18+-93450a.svg?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-ESM-93450a.svg?style=flat-square)](https://www.typescriptlang.org/)
[![license](https://img.shields.io/badge/license-MIT-grey.svg?style=flat-square)](https://opensource.org/licenses/MIT)

---

## what it does

12 MCP tools and 5 MCP resources exposed over STDIO, HTTP, or Cloudflare Workers.

### tools

**task management:**

| tool | what it does |
|:---|:---|
| `get_context` | project name, active task, workspace info |
| `list_tasks` | filter by status, configurable limit |
| `create_task` | create with `@tag` expansion in descriptions |
| `get_task` | full task details by ID |
| `update_task` | title, description, status — any combination |
| `delete_task` | irreversible delete |

**session management:**

| tool | what it does |
|:---|:---|
| `start_workspace_session` | spin up a session for any executor (Claude Code, Amp, Gemini, Codex, Cursor, etc.) |
| `list_sessions` | all sessions in a workspace |
| `get_session` | session details by ID |
| `send_message` | follow-up with auto-queue fallback if session is busy. supports MCP task primitives for async tracking |

**monitoring:**

| tool | what it does |
|:---|:---|
| `get_queue_status` | check if a message is queued |
| `cancel_queue` | drop the queued message |

### resources

| URI | description |
|:---|:---|
| `vibe://tasks` | all tasks in the project |
| `vibe://context` | workspace context (when `VIBE_WORKSPACE_ID` is set) |
| `vibe://tasks/{taskId}` | single task details |
| `vibe://sessions/{sessionId}` | session details |
| `vibe://sessions/{sessionId}/queue` | queue status |

resources support subscriptions — polls on a configurable interval, emits updates on change via SHA-256 diffing.

## install

```bash
# run directly
VIBE_PROJECT_ID=<uuid> npx mcp-better-vibe-kanban

# legacy aliases still work
npx vibe-kanban-better-mcp
npx vkb-mcp
```

or build from source:

```bash
git clone https://github.com/yigitkonur/mcp-better-vibe-kanban.git
cd mcp-better-vibe-kanban
pnpm install && pnpm build
```

requires Node.js 18+ and a running Vibe Kanban instance (default: `npx vibe-kanban` on port 9119).

## configuration

| variable | default | description |
|:---|:---|:---|
| `VIBE_PROJECT_ID` | — | **required.** UUID of the project to lock onto |
| `VIBE_REPO_ID` | auto-detected | repo UUID. auto-fetched if project has exactly one repo |
| `VIBE_API_URL` | `http://localhost:9119` | Vibe Kanban API base URL |
| `VIBE_WORKSPACE_ID` | — | enables `vibe://context` resource and `get_context` tool |
| `VIBE_RESOURCE_POLL_INTERVAL` | `10000` | resource subscription poll interval (ms) |
| `MCP_TRANSPORT` | `stdio` | `stdio` or `http` |
| `MCP_PORT` | `3000` | port for HTTP transport |

## client setup

### Claude Desktop

```json
{
  "mcpServers": {
    "mcp-better-vibe-kanban": {
      "command": "npx",
      "args": ["-y", "mcp-better-vibe-kanban"],
      "env": {
        "VIBE_PROJECT_ID": "your-project-uuid",
        "VIBE_REPO_ID": "your-repo-uuid",
        "VIBE_API_URL": "http://localhost:9119"
      }
    }
  }
}
```

### Cursor

same structure, drop it in your Cursor MCP config.

### HTTP transport

```bash
MCP_TRANSPORT=http MCP_PORT=3000 VIBE_PROJECT_ID=<uuid> npx mcp-better-vibe-kanban
```

health check at `GET /health`, MCP endpoint at `POST /mcp`. each HTTP session gets its own isolated server instance.

### Cloudflare Workers

```bash
wrangler deploy
```

uses Durable Objects with SQLite migrations. progress notifications and task primitives don't work in the Workers runtime.

## transports

| transport | use case | command |
|:---|:---|:---|
| STDIO (default) | Claude Desktop, Cursor, local clients | `VIBE_PROJECT_ID=<uuid> npx mcp-better-vibe-kanban` |
| HTTP | remote/multi-session | `MCP_TRANSPORT=http MCP_PORT=3000 ...` |
| Cloudflare Workers | edge deployment | `wrangler deploy` |

## internals

single API client (`src/api/client.ts`) that uses `curl` via `spawnSync` instead of native `fetch` — works around an ARM64 macOS socket issue where Node.js `fetch` gets `EHOSTUNREACH` on LAN IPs. blocks the event loop, but reliable.

```
src/
  index.ts            — MCP server factory, transport setup
  config.ts           — env var loading, UUID validation
  tools/
    index.ts          — all 12 tool definitions (Zod schemas + handlers)
  api/
    client.ts         — VibeClient singleton, curl-based HTTP
    types.ts          — TypeScript interfaces for API responses
  resources.ts        — MCP resources, subscription manager with SHA-256 change detection
  tasks.ts            — MCP task primitive integration (experimental)
  utils/
    formatter.ts      — response formatting
    progress.ts       — progress notification emitter

worker.ts             — Cloudflare Workers entry point (compiled by Wrangler, excluded from tsconfig)
```

## dev

```bash
pnpm dev              # hot reload via tsx
pnpm build            # compile to dist/
pnpm start            # run dist/index.js
pnpm clean            # remove dist/
```

## license

MIT
