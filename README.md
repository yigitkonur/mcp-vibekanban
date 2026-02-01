# vibe-kanban-better-mcp

🚀 **Enhanced MCP server for [Vibe Kanban](https://github.com/BloopAI/vibe-kanban)** - Simplified tools with environment-based project/repo locking + session messaging.

## Why This Exists

The official Vibe Kanban MCP server has 13 tools that require passing `project_id` and `repo_id` in every call. This package simplifies it to **12 focused tools** with IDs locked via environment variables, plus adds **session messaging** capabilities.

| Official MCP (13 tools) | This MCP (12 tools) |
|-------------------------|-------------------|
| `list_projects` | ❌ Removed (locked via env) |
| `list_repos` | ❌ Removed (locked via env) |
| `get_repo` | ❌ Removed |
| `update_setup_script` | ❌ Removed |
| `update_cleanup_script` | ❌ Removed |
| `update_dev_server_script` | ❌ Removed |
| `create_task(project_id, ...)` | ✅ `create_task(title, description)` |
| `list_tasks(project_id, ...)` | ✅ `list_tasks(status?, limit?)` |
| `get_task`, `update_task`, `delete_task` | ✅ Same |
| `start_workspace_session(repos[], ...)` | ✅ `start_workspace_session(task_id, executor)` |
| `get_context` | ✅ Same |
| - | ✅ **NEW:** `list_sessions` |
| - | ✅ **NEW:** `get_session` |
| - | ✅ **NEW:** `send_message` |
| - | ✅ **NEW:** `get_queue_status` |
| - | ✅ **NEW:** `cancel_queue` |

## Quick Install

### Option 1: Using install-mcp CLI (Recommended)

```bash
# For Claude Desktop
npx install-mcp vibe-kanban-better-mcp --client claude-desktop \
  --env VIBE_PROJECT_ID=your-project-uuid \
  --env VIBE_REPO_ID=your-repo-uuid

# For other MCP clients
npx install-mcp vibe-kanban-better-mcp --client cursor
```

### Option 2: Manual Configuration

Add to your MCP client config:

**Claude Desktop** (`~/.config/claude/claude_desktop_config.json` or `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "vibe-kanban": {
      "command": "npx",
      "args": ["-y", "vibe-kanban-better-mcp"],
      "env": {
        "VIBE_PROJECT_ID": "your-project-uuid-here",
        "VIBE_REPO_ID": "your-repo-uuid-here"
      }
    }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "vibe-kanban": {
      "command": "npx",
      "args": ["-y", "vibe-kanban-better-mcp"],
      "env": {
        "VIBE_PROJECT_ID": "your-project-uuid-here",
        "VIBE_REPO_ID": "your-repo-uuid-here"
      }
    }
  }
}
```

### Option 3: Run Directly

```bash
# Set environment variables
export VIBE_PROJECT_ID=your-project-uuid
export VIBE_REPO_ID=your-repo-uuid

# Run the MCP server
npx vibe-kanban-better-mcp
```

## Finding Your UUIDs

Open Vibe Kanban (http://localhost:9119) and use the API:

```bash
# List projects
curl -s http://localhost:9119/api/projects | jq '.data[] | {id, name}'

# List repos in a project
curl -s "http://localhost:9119/api/projects/YOUR_PROJECT_ID/repositories" | jq '.data[] | {id, name}'
```

Or check the URL when viewing a project/repo in the UI.

## Available Tools

### Task Management

| Tool | Description |
|------|-------------|
| `get_context` | Get current workspace context (project, task, workspace info) |
| `list_tasks` | List tasks with optional status filter and limit |
| `create_task` | Create a new task (supports @tag expansion) |
| `get_task` | Get task details by ID |
| `update_task` | Update task title/description/status |
| `delete_task` | Delete a task |

### Session Management

| Tool | Description |
|------|-------------|
| `start_workspace_session` | Start a coding agent session for a task |
| `list_sessions` | List all sessions for a workspace |
| `get_session` | Get session details (including assigned executor) |

### Messaging (NEW in v1.1.0)

| Tool | Description |
|------|-------------|
| `send_message` | Send a follow-up message to an active coding agent session |
| `get_queue_status` | Check if a message is queued (when executor is busy) |
| `cancel_queue` | Cancel a queued message |

## Session Messaging Workflow

```
1. Create task        → create_task(title: "Add auth")
2. Start session      → start_workspace_session(task_id, executor: "claude_code")
3. List sessions      → list_sessions(workspace_id) → get session_id
4. Send message       → send_message(session_id, prompt: "Add OAuth support")
5. If busy, auto-queues → get_queue_status(session_id)
6. Cancel if needed   → cancel_queue(session_id)
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VIBE_PROJECT_ID` | ✅ Yes | - | UUID of your Vibe Kanban project |
| `VIBE_REPO_ID` | ✅ Yes | - | UUID of the repository |
| `VIBE_API_URL` | No | `http://localhost:9119` | Vibe Kanban API URL |
| `VIBE_WORKSPACE_ID` | No | - | For `get_context` in active sessions |

## Remote Access

Use an MCP proxy for remote access:

```bash
# Install proxy
npm install -g @anthropic-ai/mcp-proxy

# Run with HTTP endpoint
VIBE_PROJECT_ID=xxx VIBE_REPO_ID=yyy \
  mcp-proxy --stdio "npx vibe-kanban-better-mcp" --port 8080

# Now accessible at http://localhost:8080/mcp
```

## Works With Original Vibe Kanban

This is a **drop-in replacement** for the MCP server only. You still get:
- ✅ All Vibe Kanban UI features
- ✅ All coding agents (Claude Code, Amp, Gemini, etc.)
- ✅ Workspace management
- ✅ Git operations
- ✅ PR creation

The only difference is how the MCP tools work - simpler and cleaner.

## Example Workflows

### Create and Start Task

```
AI: "Create a task to add user authentication"
→ create_task(title: "Add user authentication")
→ Returns: { task_id: "abc123" }

AI: "Start working on it with Claude Code"
→ start_workspace_session(task_id: "abc123", executor: "claude_code")
→ Returns: { workspace_id: "xyz789" }
```

### List and Update Tasks

```
AI: "Show me all in-progress tasks"
→ list_tasks(status: "inprogress")
→ Returns: [{ id, title, status }...]

AI: "Mark task abc123 as done"
→ update_task(task_id: "abc123", status: "done")
```

### Send Message to Active Session (NEW)

```
AI: "Send a message to the coding agent"
→ list_sessions(workspace_id: "xyz789")
→ Returns: [{ id: "session123", executor: "CLAUDE_CODE" }]

→ send_message(session_id: "session123", prompt: "Add OAuth support")
→ Returns: { action: "sent", execution_process: { id, status: "running" } }
```

## Supported Executors

- `claude_code` - Claude Code (Anthropic)
- `amp` - Amp
- `gemini` - Gemini CLI
- `codex` - OpenAI Codex
- `opencode` - OpenCode
- `cursor` - Cursor Agent
- `qwen_code` - Qwen Code
- `copilot` - GitHub Copilot
- `droid` - Droid

## License

MIT

## Links

- [Vibe Kanban](https://github.com/BloopAI/vibe-kanban) - The main project
- [MCP Protocol](https://modelcontextprotocol.io) - Model Context Protocol docs
- [install-mcp](https://github.com/anthropics/install-mcp) - Easy MCP installation
