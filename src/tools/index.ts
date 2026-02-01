/**
 * MCP Tools for Vibe Kanban - Agent-Optimized
 * 
 * 12 tools with markdown responses following 70/20/10 pattern:
 * - 70% Summary: Key insights, status
 * - 20% Data: Structured lists/tables
 * - 10% Next Steps: Suggested follow-up actions
 */

import { z } from 'zod';
import { getVibeClient } from '../api/client.js';
import { getConfig } from '../config.js';
import type { TaskStatus } from '../api/types.js';
import {
  formatSuccess,
  formatError,
  formatTaskList,
  formatSessionList,
  formatTask,
  formatWorkspaceInfo,
  formatQueueStatus,
  shortId,
} from '../utils/formatter.js';

// ============================================
// get_context
// ============================================
export const getContextTool = {
  name: 'get_context',
  description: `Get current workspace context.

<usecase>Check active project, task, and workspace info.</usecase>

<when_not_to_use>
- To list tasks → use list_tasks
- To get task details → use get_task
</when_not_to_use>

<example>get_context()</example>`,
  inputSchema: z.object({}),
  
  async handler() {
    const config = getConfig();
    
    if (!config.workspaceId) {
      return formatSuccess({
        summary: `📍 **Project Context**
• Project: \`${shortId(config.projectId)}\`
• Repo: ${config.repoId ? `\`${shortId(config.repoId)}\`` : '*auto-detect*'}
• Workspace: *not set*`,
        nextSteps: [
          'Create a task: `create_task(title="My task")`',
          'List existing tasks: `list_tasks()`',
        ],
      });
    }

    try {
      const client = getVibeClient();
      const ctx = await client.getWorkspaceContext(config.workspaceId);
      
      return formatSuccess({
        summary: `📍 **Active Workspace Context**
• Project: **${ctx.project.name}** (\`${shortId(ctx.project.id)}\`)
• Task: **${ctx.task.title}** [${ctx.task.status}]
• Workspace: \`${shortId(ctx.workspace.id)}\``,
        nextSteps: [
          `List sessions: \`list_sessions(workspace_id="${ctx.workspace.id}")\``,
          `Update task: \`update_task(task_id="${ctx.task.id}", status="done")\``,
        ],
      });
    } catch (e) {
      return formatError({
        type: 'CONTEXT_ERROR',
        message: 'Failed to fetch workspace context',
        context: { workspace_id: config.workspaceId },
        howToFix: ['Verify VIBE_WORKSPACE_ID is correct', 'Check if workspace still exists'],
      });
    }
  },
};

// ============================================
// list_tasks
// ============================================
export const listTasksTool = {
  name: 'list_tasks',
  description: `List tasks in the project.

<usecase>View all tasks or filter by status (todo, inprogress, inreview, done, cancelled).</usecase>

<parameters>
- status (optional): Filter by status
- limit (optional, default: 50): Max results
</parameters>

<example>list_tasks(status="inprogress", limit=10)</example>`,
  inputSchema: z.object({
    status: z.enum(['todo', 'inprogress', 'inreview', 'done', 'cancelled']).optional()
      .describe('Filter by status'),
    limit: z.number().int().positive().max(100).optional().default(50)
      .describe('Max results (default: 50)'),
  }),

  async handler(args: { status?: TaskStatus; limit?: number }) {
    try {
      const client = getVibeClient();
      const tasks = await client.listTasks(args.status, args.limit || 50);
      
      // Count by status
      const counts: Record<string, number> = {};
      tasks.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
      
      const statusFilter = args.status ? ` (${args.status})` : '';
      const countSummary = Object.entries(counts)
        .map(([s, c]) => `${s}: ${c}`)
        .join(' • ');
      
      return formatSuccess({
        summary: `📋 **${tasks.length} Tasks**${statusFilter}
${countSummary || 'No tasks yet'}`,
        data: formatTaskList(tasks),
        nextSteps: tasks.length > 0
          ? [
              `Get task details: \`get_task(task_id="TASK_ID")\``,
              `Start working: \`start_workspace_session(task_id="TASK_ID", executor="claude_code")\``,
            ]
          : [`Create first task: \`create_task(title="My task")\``],
      });
    } catch (e) {
      return formatError({
        type: 'LIST_TASKS_FAILED',
        message: String(e),
        howToFix: ['Check VIBE_API_URL is reachable', 'Verify VIBE_PROJECT_ID is valid'],
      });
    }
  },
};

// ============================================
// create_task
// ============================================
export const createTaskTool = {
  name: 'create_task',
  description: `Create a new task.

<usecase>Add a task to the project. Supports @tagname expansion in description.</usecase>

<parameters>
- title (required): Task title
- description (optional): Details, supports @tag expansion
</parameters>

<example>create_task(title="Add user auth", description="Implement OAuth with @google-auth")</example>`,
  inputSchema: z.object({
    title: z.string().min(1).max(500).describe('Task title (required)'),
    description: z.string().optional().describe('Task description (supports @tag expansion)'),
  }),

  async handler(args: { title: string; description?: string }) {
    try {
      const client = getVibeClient();
      const task = await client.createTask(args.title, args.description);
      
      return formatSuccess({
        summary: `✅ **Task Created**
• Title: **${task.title}**
• ID: \`${task.id}\`
• Status: ⬜ todo`,
        nextSteps: [
          `Start working: \`start_workspace_session(task_id="${task.id}", executor="claude_code")\``,
          `Add details: \`update_task(task_id="${task.id}", description="...")\``,
        ],
      });
    } catch (e) {
      return formatError({
        type: 'CREATE_FAILED',
        message: String(e),
        context: { title: args.title },
        howToFix: ['Check API connectivity', 'Verify project has write access'],
      });
    }
  },
};

// ============================================
// get_task
// ============================================
export const getTaskTool = {
  name: 'get_task',
  description: `Get task details.

<usecase>View full task information including description.</usecase>

<example>get_task(task_id="abc123...")</example>`,
  inputSchema: z.object({
    task_id: z.string().uuid().describe('Task UUID'),
  }),

  async handler(args: { task_id: string }) {
    try {
      const client = getVibeClient();
      const task = await client.getTask(args.task_id);
      
      return formatSuccess({
        summary: formatTask(task),
        nextSteps: [
          `Update: \`update_task(task_id="${task.id}", status="inprogress")\``,
          `Start session: \`start_workspace_session(task_id="${task.id}", executor="claude_code")\``,
          `Delete: \`delete_task(task_id="${task.id}")\``,
        ],
      });
    } catch (e) {
      return formatError({
        type: 'TASK_NOT_FOUND',
        message: String(e),
        context: { task_id: args.task_id },
        howToFix: ['Verify task ID is correct', 'Task may have been deleted'],
        alternatives: ['List all tasks: `list_tasks()`'],
      });
    }
  },
};

// ============================================
// update_task
// ============================================
export const updateTaskTool = {
  name: 'update_task',
  description: `Update task properties.

<usecase>Change task title, description, or status.</usecase>

<parameters>
- task_id (required): Task UUID
- title (optional): New title
- description (optional): New description
- status (optional): todo | inprogress | inreview | done | cancelled
</parameters>

<example>update_task(task_id="abc123...", status="done")</example>`,
  inputSchema: z.object({
    task_id: z.string().uuid().describe('Task UUID'),
    title: z.string().min(1).max(500).optional().describe('New title'),
    description: z.string().optional().describe('New description'),
    status: z.enum(['todo', 'inprogress', 'inreview', 'done', 'cancelled']).optional()
      .describe('New status'),
  }).refine(d => d.title || d.description || d.status, {
    message: 'At least one of title, description, or status required',
  }),

  async handler(args: { task_id: string; title?: string; description?: string; status?: TaskStatus }) {
    try {
      const client = getVibeClient();
      const updates: { title?: string; description?: string; status?: TaskStatus } = {};
      if (args.title) updates.title = args.title;
      if (args.description) updates.description = args.description;
      if (args.status) updates.status = args.status;

      const task = await client.updateTask(args.task_id, updates);
      const fields = Object.keys(updates).join(', ');
      
      return formatSuccess({
        summary: `✅ **Task Updated** (${fields})
• Title: **${task.title}**
• Status: ${task.status}
• ID: \`${shortId(task.id)}\``,
        nextSteps: [
          `View full task: \`get_task(task_id="${task.id}")\``,
          task.status !== 'done' 
            ? `Mark done: \`update_task(task_id="${task.id}", status="done")\``
            : `Reopen: \`update_task(task_id="${task.id}", status="inprogress")\``,
        ],
      });
    } catch (e) {
      return formatError({
        type: 'UPDATE_FAILED',
        message: String(e),
        context: { task_id: args.task_id },
        howToFix: ['Verify task exists', 'Check status value is valid'],
      });
    }
  },
};

// ============================================
// delete_task
// ============================================
export const deleteTaskTool = {
  name: 'delete_task',
  description: `Delete a task permanently.

<usecase>Remove a task from the project. Cannot be undone.</usecase>

<example>delete_task(task_id="abc123...")</example>`,
  inputSchema: z.object({
    task_id: z.string().uuid().describe('Task UUID'),
  }),

  async handler(args: { task_id: string }) {
    try {
      const client = getVibeClient();
      await client.deleteTask(args.task_id);
      
      return formatSuccess({
        summary: `🗑️ **Task Deleted**
• ID: \`${args.task_id}\`
• This action cannot be undone`,
        nextSteps: [
          `Create new task: \`create_task(title="...")\``,
          `List remaining tasks: \`list_tasks()\``,
        ],
      });
    } catch (e) {
      return formatError({
        type: 'DELETE_FAILED',
        message: String(e),
        context: { task_id: args.task_id },
        howToFix: ['Verify task exists', 'Task may already be deleted'],
      });
    }
  },
};

// ============================================
// start_workspace_session
// ============================================
const EXECUTORS = ['claude_code', 'amp', 'gemini', 'codex', 'opencode', 'cursor', 'qwen_code', 'copilot', 'droid'];

export const startWorkspaceSessionTool = {
  name: 'start_workspace_session',
  description: `Start a coding session for a task.

<usecase>Launch a coding agent to work on a task. Creates workspace + session.</usecase>

<parameters>
- task_id (required): Task UUID
- executor (required): ${EXECUTORS.join(' | ')}
- variant (optional): e.g., PLAN, IMPLEMENT
- base_branch (optional): Branch to work from (default: main)
</parameters>

<example>start_workspace_session(task_id="abc123...", executor="claude_code")</example>`,
  inputSchema: z.object({
    task_id: z.string().uuid().describe('Task UUID'),
    executor: z.string().min(1).describe(`Executor: ${EXECUTORS.join(', ')}`),
    variant: z.string().optional().describe('Variant (e.g., PLAN)'),
    base_branch: z.string().optional().describe('Base branch (default: main)'),
  }),

  async handler(args: { task_id: string; executor: string; variant?: string; base_branch?: string }) {
    try {
      const client = getVibeClient();
      const workspace = await client.startWorkspaceSession(
        args.task_id, args.executor, args.variant, args.base_branch
      );
      
      const repoId = await client.getRepoIdResolved();
      
      return formatSuccess({
        summary: formatWorkspaceInfo({
          workspace_id: workspace.id,
          task_id: workspace.task_id,
          executor: args.executor.toUpperCase(),
          repo_id: repoId,
        }),
        nextSteps: [
          `List sessions: \`list_sessions(workspace_id="${workspace.id}")\``,
          `Send message: \`send_message(session_id="SESSION_ID", prompt="...")\``,
        ],
      });
    } catch (e) {
      return formatError({
        type: 'SESSION_START_FAILED',
        message: String(e),
        context: { task_id: args.task_id, executor: args.executor },
        howToFix: [
          'Verify task exists',
          `Check executor is valid: ${EXECUTORS.join(', ')}`,
          'Ensure repo is configured in project',
        ],
      });
    }
  },
};

// ============================================
// list_sessions
// ============================================
export const listSessionsTool = {
  name: 'list_sessions',
  description: `List sessions in a workspace.

<usecase>See all executor sessions for a workspace. Each session tracks conversation with one executor.</usecase>

<example>list_sessions(workspace_id="xyz789...")</example>`,
  inputSchema: z.object({
    workspace_id: z.string().uuid().describe('Workspace UUID'),
  }),

  async handler(args: { workspace_id: string }) {
    try {
      const client = getVibeClient();
      const sessions = await client.listSessions(args.workspace_id);
      
      return formatSuccess({
        summary: `📂 **${sessions.length} Session${sessions.length !== 1 ? 's' : ''}** in workspace \`${shortId(args.workspace_id)}\``,
        data: formatSessionList(sessions.map(s => ({
          id: s.id,
          executor: s.executor || 'unknown',
          created_at: s.created_at,
        }))),
        nextSteps: sessions.length > 0
          ? [
              `Send message: \`send_message(session_id="${sessions[0].id}", prompt="...")\``,
              `Get session details: \`get_session(session_id="${sessions[0].id}")\``,
            ]
          : ['Start a session first with `start_workspace_session`'],
      });
    } catch (e) {
      return formatError({
        type: 'LIST_SESSIONS_FAILED',
        message: String(e),
        context: { workspace_id: args.workspace_id },
        howToFix: ['Verify workspace ID is correct'],
      });
    }
  },
};

// ============================================
// get_session
// ============================================
export const getSessionTool = {
  name: 'get_session',
  description: `Get session details.

<usecase>Check which executor is assigned and session state.</usecase>

<example>get_session(session_id="sess123...")</example>`,
  inputSchema: z.object({
    session_id: z.string().uuid().describe('Session UUID'),
  }),

  async handler(args: { session_id: string }) {
    try {
      const client = getVibeClient();
      const session = await client.getSession(args.session_id);
      
      return formatSuccess({
        summary: `📍 **Session Details**
• ID: \`${session.id}\`
• Executor: **${session.executor}**
• Workspace: \`${shortId(session.workspace_id)}\``,
        nextSteps: [
          `Send message: \`send_message(session_id="${session.id}", prompt="...")\``,
          `Check queue: \`get_queue_status(session_id="${session.id}")\``,
        ],
      });
    } catch (e) {
      return formatError({
        type: 'SESSION_NOT_FOUND',
        message: String(e),
        context: { session_id: args.session_id },
        howToFix: ['Verify session ID', 'Session may have ended'],
      });
    }
  },
};

// ============================================
// send_message
// ============================================
export const sendMessageTool = {
  name: 'send_message',
  description: `Send a message to a coding agent session.

<usecase>Send follow-up instructions to an active session. Auto-queues if executor is busy.</usecase>

<parameters>
- session_id (required): Session UUID
- prompt (required): Message to send
- executor (optional): Auto-detected from session
- auto_queue (optional, default: true): Queue if busy
</parameters>

<example>send_message(session_id="sess123...", prompt="Add error handling")</example>`,
  inputSchema: z.object({
    session_id: z.string().uuid().describe('Session UUID'),
    prompt: z.string().min(1).describe('Message to send'),
    executor: z.string().optional().describe('Executor (auto-detected if omitted)'),
    variant: z.string().optional().describe('Variant (e.g., PLAN)'),
    auto_queue: z.boolean().optional().default(true).describe('Queue if busy (default: true)'),
  }),

  async handler(args: { session_id: string; prompt: string; executor?: string; variant?: string; auto_queue?: boolean }) {
    try {
      const client = getVibeClient();
      
      const session = await client.getSession(args.session_id);
      const executor = args.executor || session.executor;
      
      if (!executor) {
        return formatError({
          type: 'EXECUTOR_REQUIRED',
          message: 'Session has no prior executions. Provide executor parameter.',
          context: { session_id: args.session_id },
          howToFix: ['Specify executor: `send_message(..., executor="claude_code")`'],
        });
      }

      const executorProfile = client.buildExecutorProfile(executor, args.variant);
      
      try {
        const process = await client.sendFollowUp(args.session_id, {
          prompt: args.prompt,
          executor_profile_id: executorProfile,
        });
        
        return formatSuccess({
          summary: `✅ **Message Sent**
• Executor: **${executor.toUpperCase()}**
• Status: 🔵 Running
• Process: \`${shortId(process.id)}\``,
          nextSteps: [
            `Check queue: \`get_queue_status(session_id="${args.session_id}")\``,
            `Send another: \`send_message(session_id="${args.session_id}", prompt="...")\``,
          ],
        });
      } catch (e) {
        const errorStr = String(e);
        const shouldQueue = args.auto_queue !== false && (
          errorStr.includes('running') || 
          errorStr.includes('busy') ||
          errorStr.includes('409') ||
          errorStr.includes('conflict')
        );
        
        if (shouldQueue) {
          const queueResult = await client.queueMessage(args.session_id, {
            message: args.prompt,
            executor_profile_id: executorProfile,
          });
          
          return formatSuccess({
            summary: `📤 **Message Queued**
• Executor: **${executor.toUpperCase()}** (busy)
• Message will execute when current process completes`,
            nextSteps: [
              `Check queue: \`get_queue_status(session_id="${args.session_id}")\``,
              `Cancel queue: \`cancel_queue(session_id="${args.session_id}")\``,
            ],
          });
        }
        
        throw e;
      }
    } catch (e) {
      return formatError({
        type: 'SEND_FAILED',
        message: String(e),
        context: { session_id: args.session_id },
        howToFix: ['Check session is active', 'Verify executor name'],
      });
    }
  },
};

// ============================================
// get_queue_status
// ============================================
export const getQueueStatusTool = {
  name: 'get_queue_status',
  description: `Check if a message is queued for a session.

<usecase>See pending message when executor is busy.</usecase>

<example>get_queue_status(session_id="sess123...")</example>`,
  inputSchema: z.object({
    session_id: z.string().uuid().describe('Session UUID'),
  }),

  async handler(args: { session_id: string }) {
    try {
      const client = getVibeClient();
      const status = await client.getQueueStatus(args.session_id);
      
      if (status.type === 'Queued') {
        return formatSuccess({
          summary: formatQueueStatus(
            true,
            status.message.message,
            status.message.executor_profile_id.executor
          ),
          nextSteps: [
            `Cancel queue: \`cancel_queue(session_id="${args.session_id}")\``,
            'Wait for current process to complete',
          ],
        });
      } else {
        return formatSuccess({
          summary: formatQueueStatus(false),
          nextSteps: [
            `Send message: \`send_message(session_id="${args.session_id}", prompt="...")\``,
          ],
        });
      }
    } catch (e) {
      return formatError({
        type: 'QUEUE_STATUS_FAILED',
        message: String(e),
        context: { session_id: args.session_id },
        howToFix: ['Verify session ID'],
      });
    }
  },
};

// ============================================
// cancel_queue
// ============================================
export const cancelQueueTool = {
  name: 'cancel_queue',
  description: `Cancel a queued message.

<usecase>Remove pending message from queue.</usecase>

<example>cancel_queue(session_id="sess123...")</example>`,
  inputSchema: z.object({
    session_id: z.string().uuid().describe('Session UUID'),
  }),

  async handler(args: { session_id: string }) {
    try {
      const client = getVibeClient();
      await client.cancelQueue(args.session_id);
      
      return formatSuccess({
        summary: `✅ **Queue Cancelled**
• Session: \`${shortId(args.session_id)}\`
• Pending message removed`,
        nextSteps: [
          `Send new message: \`send_message(session_id="${args.session_id}", prompt="...")\``,
          `Check status: \`get_queue_status(session_id="${args.session_id}")\``,
        ],
      });
    } catch (e) {
      return formatError({
        type: 'CANCEL_FAILED',
        message: String(e),
        context: { session_id: args.session_id },
        howToFix: ['Queue may already be empty', 'Verify session ID'],
      });
    }
  },
};

// Export all tools as array
export const allTools = [
  getContextTool,
  listTasksTool,
  createTaskTool,
  getTaskTool,
  updateTaskTool,
  deleteTaskTool,
  startWorkspaceSessionTool,
  listSessionsTool,
  getSessionTool,
  sendMessageTool,
  getQueueStatusTool,
  cancelQueueTool,
];
