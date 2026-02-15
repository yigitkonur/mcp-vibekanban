<h1 align="center">📋 Vibe Kanban MCP 📋</h1>

<h3 align="center">Stop context-switching. Start shipping from your AI session.</h3>

<p align="center">
  <strong>
    <em>The MCP bridge between your AI coding assistant and Vibe Kanban. Create tasks, launch workspace sessions, and message coding agents — all without leaving your editor.</em>
  </strong>
</p>

<p align="center">
  <!-- Package Info -->
  <a href="https://www.npmjs.com/package/mcp-vibekanban"><img alt="npm" src="https://img.shields.io/npm/v/mcp-vibekanban.svg?style=flat-square&color=4D87E6"></a>
  <a href="#"><img alt="node" src="https://img.shields.io/badge/node-18+-4D87E6.svg?style=flat-square"></a>
  &nbsp;&nbsp;•&nbsp;&nbsp;
  <!-- Features -->
  <a href="https://opensource.org/licenses/MIT"><img alt="license" src="https://img.shields.io/badge/License-MIT-F9A825.svg?style=flat-square"></a>
  <a href="#"><img alt="platform" src="https://img.shields.io/badge/platform-macOS_|_Linux_|_Windows-2ED573.svg?style=flat-square"></a>
</p>

<p align="center">
  <img alt="tools" src="https://img.shields.io/badge/12_tools-ready_to_use-2ED573.svg?style=for-the-badge">
  <img alt="zero config" src="https://img.shields.io/badge/💪_env--locked-no_IDs_in_every_call-2ED573.svg?style=for-the-badge">
</p>

<div align="center">

### 🧭 Quick Navigation

[**⚡ Get Started**](#-get-started-in-60-seconds) •
[**🎯 Why mcp-vibekanban**](#-why-mcp-vibekanban) •
[**🎮 Tools**](#-tool-reference) •
[**⚙️ Configuration**](#%EF%B8%8F-environment-variables) •
[**📚 Workflows**](#-recommended-workflows)

</div>

---

## The Pitch

**`mcp-vibekanban`** is the project management backbone for your AI coding assistant. Instead of alt-tabbing to a Kanban board, your AI creates tasks, launches coding agent sessions, and sends follow-up messages — all through MCP. Project and repo IDs are locked via environment variables, so every tool call is clean and minimal.

<div align="center">
<table>
<tr>
<td align="center">
<h3>📋</h3>
<b>Task Management</b><br/>
<sub>Create, list, update, delete</sub>
</td>
<td align="center">
<h3>🚀</h3>
<b>Workspace Sessions</b><br/>
<sub>Launch any coding agent</sub>
</td>
<td align="center">
<h3>💬</h3>
<b>Session Messaging</b><br/>
<sub>Follow-up + auto-queue</sub>
</td>
<td align="center">
<h3>🔒</h3>
<b>Env-Locked IDs</b><br/>
<sub>No ID juggling per call</sub>
</td>
</tr>
</table>
</div>

Here's how it works:
- **You:** "Create a task for adding OAuth, then start a Claude Code session on it."
- **AI + mcp-vibekanban:** Creates the task, launches a workspace session, and gives you the session ID.
- **You:** "Send a follow-up: add Google as an OAuth provider."
- **Result:** The message is delivered (or auto-queued if the agent is busy). Zero browser tabs opened.

---

## 🎯 Why mcp-vibekanban

The official Vibe Kanban MCP requires passing `project_id` and `repo_id` in every call. `mcp-vibekanban` locks those via env vars and adds session messaging.

<table align="center">
<tr>
<td align="center"><b>❌ Old Way (Official MCP)</b></td>
<td align="center"><b>✅ New Way (mcp-vibekanban)</b></td>
</tr>
<tr>
<td>
<ol>
  <li>Call <code>list_projects</code> to find your project ID.</li>
  <li>Call <code>list_repos</code> to find your repo ID.</li>
  <li>Pass both IDs in every single tool call.</li>
  <li>No way to message active sessions.</li>
  <li>13 tools with boilerplate in each call.</li>
</ol>
</td>
<td>
<ol>
  <li>Set env vars once — IDs are locked.</li>
  <li><code>create_task(title="Add auth")</code> — done.</li>
  <li>Launch sessions, send messages, check queues.</li>
  <li>Auto-queue when executor is busy.</li>
  <li>12 focused tools, zero boilerplate. ☕</li>
</ol>
</td>
</tr>
</table>

---

## 🚀 Get Started in 60 Seconds

### 1. Prerequisites

You need **Vibe Kanban running** (the upstream project):

```bash
npx vibe-kanban              # default port 9119
# or: PORT=1990 npx vibe-kanban
```

### 2. Configure Your MCP Client

<div align="center">

| Client | Config File | Docs |
|:------:|:-----------:|:----:|
| 🖥️ **Claude Desktop** | `claude_desktop_config.json` | [Setup](#claude-desktop) |
| ⌨️ **Claude Code** | CLI or `~/.claude.json` | [Setup](#claude-code-cli) |
| 🎯 **Cursor / 🏄 Windsurf** | `.cursor/mcp.json` | [Setup](#cursorwindsurf) |

</div>

#### Claude Desktop

**Quick install:**

```bash
npx install-mcp mcp-vibekanban --client claude-desktop \
  --env VKB_API_URL=https://your-vibekanban-instance.com \
  --env VKB_PROJECT_SLUG=your-project \
  --env VKB_REPOSITORY_SLUG=your-repo
```

**Manual config** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vibekanban": {
      "command": "npx",
      "args": ["-y", "mcp-vibekanban"],
      "env": {
        "VKB_API_URL": "https://your-vibekanban-instance.com",
        "VKB_PROJECT_SLUG": "your-project",
        "VKB_REPOSITORY_SLUG": "your-repo"
      }
    }
  }
}
```

#### Claude Code CLI

```bash
claude mcp add vibekanban npx \
  --scope user \
  --env VKB_API_URL=https://your-vibekanban-instance.com \
  --env VKB_PROJECT_SLUG=your-project \
  --env VKB_REPOSITORY_SLUG=your-repo \
  -- -y mcp-vibekanban
```

Or manually add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "vibekanban": {
      "command": "npx",
      "args": ["-y", "mcp-vibekanban"],
      "env": {
        "VKB_API_URL": "https://your-vibekanban-instance.com",
        "VKB_PROJECT_SLUG": "your-project",
        "VKB_REPOSITORY_SLUG": "your-repo"
      }
    }
  }
}
```

#### Cursor/Windsurf

Add to `.cursor/mcp.json` (or equivalent):

```json
{
  "mcpServers": {
    "vibekanban": {
      "command": "npx",
      "args": ["-y", "mcp-vibekanban"],
      "env": {
        "VKB_API_URL": "https://your-vibekanban-instance.com",
        "VKB_PROJECT_SLUG": "your-project",
        "VKB_REPOSITORY_SLUG": "your-repo"
      }
    }
  }
}
```

> **Backward Compatibility:** The old package name `vibe-kanban-better-mcp` still works as a binary alias. Existing configs don't need updating.

---

## 🌐 Transport Modes

Vibe Kanban supports three transport modes:

| Mode | Use Case | How to Start |
|------|----------|-------------|
| **STDIO** (default) | Claude Desktop, Cursor, Windsurf | `npx mcp-vibekanban` |
| **HTTP Streamable** | Self-hosted, Docker, LAN sharing | `MCP_TRANSPORT=http npx mcp-vibekanban` |
| **Cloudflare Workers** | Serverless, globally distributed | Already deployed ↓ |

### Remote MCP (Cloudflare Workers)

A remote MCP endpoint is deployed and ready to use:

```
https://mcp-vibekanban.seodoold.workers.dev/mcp
```

Connect from any MCP client that supports HTTP Streamable transport:

```json
{
  "mcpServers": {
    "vibekanban-remote": {
      "type": "streamable-http",
      "url": "https://mcp-vibekanban.seodoold.workers.dev/mcp"
    }
  }
}
```

### Self-Hosted HTTP Streamable

```bash
# Start on default port 3001
MCP_TRANSPORT=http npx mcp-vibekanban

# Custom port
MCP_TRANSPORT=http MCP_PORT=8080 npx mcp-vibekanban
```

```json
{
  "mcpServers": {
    "vibekanban-http": {
      "type": "streamable-http",
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

---

## 🎮 Tool Reference

`mcp-vibekanban` exposes **12 MCP tools** across three categories:

<div align="center">
<table>
<tr>
<td align="center">
<h3>📋</h3>
<b><code>get_context</code></b><br/>
<sub>Workspace info</sub>
</td>
<td align="center">
<h3>📝</h3>
<b><code>list_tasks</code></b><br/>
<sub>Filter & browse</sub>
</td>
<td align="center">
<h3>➕</h3>
<b><code>create_task</code></b><br/>
<sub>New task</sub>
</td>
<td align="center">
<h3>🔍</h3>
<b><code>get_task</code></b><br/>
<sub>Full details</sub>
</td>
<td align="center">
<h3>✏️</h3>
<b><code>update_task</code></b><br/>
<sub>Edit & transition</sub>
</td>
<td align="center">
<h3>🗑️</h3>
<b><code>delete_task</code></b><br/>
<sub>Remove task</sub>
</td>
</tr>
<tr>
<td align="center">
<h3>🚀</h3>
<b><code>start_workspace_session</code></b><br/>
<sub>Launch agent</sub>
</td>
<td align="center">
<h3>📂</h3>
<b><code>list_sessions</code></b><br/>
<sub>All sessions</sub>
</td>
<td align="center">
<h3>📍</h3>
<b><code>get_session</code></b><br/>
<sub>Session info</sub>
</td>
<td align="center">
<h3>💬</h3>
<b><code>send_message</code></b><br/>
<sub>Follow-up</sub>
</td>
<td align="center">
<h3>📤</h3>
<b><code>get_queue_status</code></b><br/>
<sub>Pending check</sub>
</td>
<td align="center">
<h3>🚫</h3>
<b><code>cancel_queue</code></b><br/>
<sub>Clear queue</sub>
</td>
</tr>
</table>
</div>

### Task Management

#### `get_context`

Get current workspace context — project, active task, and workspace info.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | — | — | No parameters needed |

```
get_context()
```

---

#### `list_tasks`

List tasks in the project, optionally filtered by status.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | all | `todo` · `inprogress` · `inreview` · `done` · `cancelled` |
| `limit` | number | No | `50` | Max results (1–100) |

```
list_tasks(status="inprogress", limit=10)
```

---

#### `create_task`

Create a new task. Supports `@tag` expansion in descriptions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Task title (1–500 chars) |
| `description` | string | No | Details, supports `@tag` expansion |

```
create_task(title="Add user auth", description="Implement OAuth with @google-auth")
```

---

#### `get_task`

Get full task details by ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task_id` | string (UUID) | Yes | Task UUID |

```
get_task(task_id="abc123...")
```

---

#### `update_task`

Update task title, description, or status. At least one field required.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task_id` | string (UUID) | Yes | Task UUID |
| `title` | string | No | New title |
| `description` | string | No | New description |
| `status` | string | No | `todo` · `inprogress` · `inreview` · `done` · `cancelled` |

```
update_task(task_id="abc123...", status="done")
```

---

#### `delete_task`

Permanently delete a task. Cannot be undone.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task_id` | string (UUID) | Yes | Task UUID |

```
delete_task(task_id="abc123...")
```

---

### Session Management

#### `start_workspace_session`

Launch a coding agent session for a task. Creates workspace + session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task_id` | string (UUID) | Yes | Task UUID |
| `executor` | string | Yes | `claude_code` · `amp` · `gemini` · `codex` · `opencode` · `cursor` · `qwen_code` · `copilot` · `droid` |
| `variant` | string | No | e.g., `PLAN`, `IMPLEMENT` |
| `base_branch` | string | No | Branch to work from (default: `main`) |

```
start_workspace_session(task_id="abc123...", executor="claude_code")
```

---

#### `list_sessions`

List all sessions for a workspace.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspace_id` | string (UUID) | Yes | Workspace UUID |

```
list_sessions(workspace_id="xyz789...")
```

---

#### `get_session`

Get session details including assigned executor.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_id` | string (UUID) | Yes | Session UUID |

```
get_session(session_id="sess123...")
```

---

### Messaging

#### `send_message`

Send a follow-up message to an active coding agent session. Auto-queues if the executor is busy.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `session_id` | string (UUID) | Yes | — | Session UUID |
| `prompt` | string | Yes | — | Message to send |
| `executor` | string | No | auto | Auto-detected from session |
| `variant` | string | No | — | e.g., `PLAN` |
| `auto_queue` | boolean | No | `true` | Queue message if executor is busy |

```
send_message(session_id="sess123...", prompt="Add error handling for edge cases")
```

---

#### `get_queue_status`

Check if a message is queued for a session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_id` | string (UUID) | Yes | Session UUID |

```
get_queue_status(session_id="sess123...")
```

---

#### `cancel_queue`

Cancel a pending queued message.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_id` | string (UUID) | Yes | Session UUID |

```
cancel_queue(session_id="sess123...")
```

---

## ⚙️ Environment Variables

<div align="center">

| Variable | Required | Default | Description |
|:--------:|:--------:|:-------:|:------------|
| `VKB_API_URL` | ✅ Yes | — | Vibe Kanban instance URL (e.g., `https://your-instance.com`) |
| `VKB_PROJECT_SLUG` | ✅ Yes | — | Project slug or UUID — locked for all tool calls |
| `VKB_REPOSITORY_SLUG` | ✅ Yes | — | Repository slug or UUID — locked for all tool calls |

</div>

All three variables are **required** and lock the project/repository context so you never need to pass IDs in individual tool calls.

---

## 📚 Recommended Workflows

### Create → Launch → Message

The most common pattern: create a task, start a session, and iterate with follow-ups.

```
1. create_task(title="Add OAuth login")
   → Returns task_id

2. start_workspace_session(task_id="...", executor="claude_code")
   → Returns workspace_id

3. list_sessions(workspace_id="...")
   → Returns session_id

4. send_message(session_id="...", prompt="Add Google as a provider")
   → Sent (or auto-queued if busy)

5. get_queue_status(session_id="...")
   → Check pending messages
```

### Triage & Prioritize

Review existing tasks and move them through your pipeline.

```
1. list_tasks(status="todo")
   → See all pending work

2. get_task(task_id="...")
   → Read full details

3. update_task(task_id="...", status="inprogress")
   → Move to active

4. start_workspace_session(task_id="...", executor="amp")
   → Hand off to a coding agent
```

### Multi-Agent Orchestration

Run different agents on different tasks simultaneously.

```
1. create_task(title="Refactor auth module")
2. create_task(title="Write API tests")
3. create_task(title="Update migration guide")

4. start_workspace_session(task_id="task1", executor="claude_code")
5. start_workspace_session(task_id="task2", executor="gemini")
6. start_workspace_session(task_id="task3", executor="copilot")
```

---

## 🛠️ Development

```bash
git clone https://github.com/yigitkonur/mcp-vibekanban.git
cd mcp-vibekanban
pnpm install
pnpm dev        # Run with tsx (hot reload)
pnpm build      # Compile TypeScript
pnpm start          # Run compiled output
```

### Project Structure

```
src/
├── index.ts          # Server entry point
├── config.ts         # Env var loader & validation
├── tools/
│   └── index.ts      # All 12 tool definitions
├── api/              # Vibe Kanban HTTP client
├── resources.ts      # MCP resource handlers
├── tasks.ts          # Task primitive integration
└── utils/            # Formatter & progress helpers
```

---

## 🔧 Troubleshooting

<details>
<summary><b>Expand for troubleshooting tips</b></summary>

| Problem | Solution |
| :--- | :--- |
| **Server exits with "VKB_PROJECT_SLUG is required"** | Set all three required env vars: `VKB_API_URL`, `VKB_PROJECT_SLUG`, `VKB_REPOSITORY_SLUG`. |
| **Connection refused / ECONNREFUSED** | Make sure your Vibe Kanban instance is running and `VKB_API_URL` is correct. |
| **EHOSTUNREACH on Apple Silicon** | The HTTP client uses `curl` subprocess to work around ARM64 macOS network issues with Node.js native clients. Ensure `curl` is available. |
| **"Unknown tool" error** | Verify you're on the latest version: `npx mcp-vibekanban@latest`. |
| **Send message returns "executor busy"** | This is normal. With `auto_queue: true` (default), the message is automatically queued and will execute when the current process completes. |
| **Task ID format error** | All IDs must be valid UUIDs (e.g., `123e4567-e89b-12d3-a456-426614174000`). |
| **Old binary name still works?** | Yes — `vibe-kanban-better-mcp` and `vkb-mcp` are kept as binary aliases for backward compatibility. |

</details>

---

<div align="center">

MIT © [Yiğit Konur](https://github.com/yigitkonur)

**[Vibe Kanban](https://github.com/BloopAI/vibe-kanban)** · **[MCP Protocol](https://modelcontextprotocol.io)** · **[install-mcp](https://github.com/anthropics/install-mcp)**

</div>
