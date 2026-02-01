/**
 * All MCP Tools - Simplified for Vibe Kanban
 * 
 * 6 tools total (down from 13 in original):
 * - get_context: Get current workspace context
 * - list_tasks: List tasks in locked project
 * - create_task: Create task in locked project
 * - get_task: Get task details
 * - update_task: Update task
 * - delete_task: Delete task
 * - start_workspace_session: Start session with locked repo
 */

import { z } from 'zod';
import { getVibeClient } from '../api/client.js';
import { getConfig } from '../config.js';
import type { TaskStatus } from '../api/types.js';

// Helper to create tool result
const result = (data: unknown, isError = false) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  ...(isError && { isError: true }),
});

// ============================================
// get_context
// ============================================
export const getContextTool = {
  name: 'get_context',
  description: 'Get current workspace context (project, task, workspace). Only works if VIBE_WORKSPACE_ID is set.',
  inputSchema: z.object({}),
  
  async handler() {
    const config = getConfig();
    
    if (!config.workspaceId) {
      return result({
        error: 'No active workspace',
        hint: 'Set VIBE_WORKSPACE_ID for active session context',
        project_id: config.projectId,
        repo_id: config.repoId,
      });
    }

    try {
      const client = getVibeClient();
      const ctx = await client.getWorkspaceContext(config.workspaceId);
      return result({
        project: { id: ctx.project.id, name: ctx.project.name },
        task: { id: ctx.task.id, title: ctx.task.title, status: ctx.task.status },
        workspace: { id: ctx.workspace.id },
      });
    } catch (e) {
      return result({ error: 'Failed to get context', message: String(e) }, true);
    }
  },
};

// ============================================
// list_tasks
// ============================================
export const listTasksTool = {
  name: 'list_tasks',
  description: 'List tasks in the project (locked via VIBE_PROJECT_ID). Filter by status and limit results.',
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
      
      return result({
        count: tasks.length,
        project_id: client.getProjectId(),
        filters: { status: args.status || null, limit: args.limit || 50 },
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          updated_at: t.updated_at,
        })),
      });
    } catch (e) {
      return result({ error: 'Failed to list tasks', message: String(e) }, true);
    }
  },
};

// ============================================
// create_task
// ============================================
export const createTaskTool = {
  name: 'create_task',
  description: 'Create a task in the project. Supports @tagname expansion in description.',
  inputSchema: z.object({
    title: z.string().min(1).max(500).describe('Task title (required)'),
    description: z.string().optional().describe('Task description (supports @tag expansion)'),
  }),

  async handler(args: { title: string; description?: string }) {
    try {
      const client = getVibeClient();
      const task = await client.createTask(args.title, args.description);
      
      return result({
        success: true,
        task_id: task.id,
        task: { id: task.id, title: task.title, status: task.status },
      });
    } catch (e) {
      return result({ error: 'Failed to create task', message: String(e) }, true);
    }
  },
};

// ============================================
// get_task
// ============================================
export const getTaskTool = {
  name: 'get_task',
  description: 'Get task details by ID.',
  inputSchema: z.object({
    task_id: z.string().uuid().describe('Task UUID'),
  }),

  async handler(args: { task_id: string }) {
    try {
      const client = getVibeClient();
      const task = await client.getTask(args.task_id);
      
      return result({
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          created_at: task.created_at,
          updated_at: task.updated_at,
        },
      });
    } catch (e) {
      return result({ error: 'Failed to get task', task_id: args.task_id, message: String(e) }, true);
    }
  },
};

// ============================================
// update_task
// ============================================
export const updateTaskTool = {
  name: 'update_task',
  description: 'Update task title, description, or status.',
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
      
      return result({
        success: true,
        task: { id: task.id, title: task.title, status: task.status },
        updated_fields: Object.keys(updates),
      });
    } catch (e) {
      return result({ error: 'Failed to update task', task_id: args.task_id, message: String(e) }, true);
    }
  },
};

// ============================================
// delete_task
// ============================================
export const deleteTaskTool = {
  name: 'delete_task',
  description: 'Delete a task permanently.',
  inputSchema: z.object({
    task_id: z.string().uuid().describe('Task UUID'),
  }),

  async handler(args: { task_id: string }) {
    try {
      const client = getVibeClient();
      await client.deleteTask(args.task_id);
      return result({ success: true, deleted_task_id: args.task_id });
    } catch (e) {
      return result({ error: 'Failed to delete task', task_id: args.task_id, message: String(e) }, true);
    }
  },
};

// ============================================
// start_workspace_session
// ============================================
const EXECUTORS = ['claude_code', 'amp', 'gemini', 'codex', 'opencode', 'cursor', 'qwen_code', 'copilot', 'droid'];

export const startWorkspaceSessionTool = {
  name: 'start_workspace_session',
  description: `Start coding session on a task. Repo is auto-set from VIBE_REPO_ID. Executors: ${EXECUTORS.join(', ')}`,
  inputSchema: z.object({
    task_id: z.string().uuid().describe('Task UUID'),
    executor: z.string().min(1).describe('Coding agent (e.g., claude_code, amp, gemini)'),
    variant: z.string().optional().describe('Executor variant (e.g., PLAN)'),
    base_branch: z.string().optional().describe('Base branch'),
  }),

  async handler(args: { task_id: string; executor: string; variant?: string; base_branch?: string }) {
    try {
      const client = getVibeClient();
      const workspace = await client.startWorkspaceSession(
        args.task_id, args.executor, args.variant, args.base_branch
      );
      
      return result({
        success: true,
        workspace_id: workspace.id,
        task_id: workspace.task_id,
        executor: args.executor,
        repo_id: client.getRepoId(),
      });
    } catch (e) {
      return result({ error: 'Failed to start session', message: String(e) }, true);
    }
  },
};

// ============================================
// list_sessions
// ============================================
export const listSessionsTool = {
  name: 'list_sessions',
  description: 'List all sessions for a workspace. Each session tracks a conversation with a specific executor.',
  inputSchema: z.object({
    workspace_id: z.string().uuid().describe('Workspace UUID'),
  }),

  async handler(args: { workspace_id: string }) {
    try {
      const client = getVibeClient();
      const sessions = await client.listSessions(args.workspace_id);
      
      return result({
        count: sessions.length,
        workspace_id: args.workspace_id,
        sessions: sessions.map(s => ({
          id: s.id,
          executor: s.executor,
          created_at: s.created_at,
          updated_at: s.updated_at,
        })),
      });
    } catch (e) {
      return result({ error: 'Failed to list sessions', workspace_id: args.workspace_id, message: String(e) }, true);
    }
  },
};

// ============================================
// get_session
// ============================================
export const getSessionTool = {
  name: 'get_session',
  description: 'Get session details including executor info. Use this to check which executor is assigned to a session.',
  inputSchema: z.object({
    session_id: z.string().uuid().describe('Session UUID'),
  }),

  async handler(args: { session_id: string }) {
    try {
      const client = getVibeClient();
      const session = await client.getSession(args.session_id);
      
      return result({
        session: {
          id: session.id,
          workspace_id: session.workspace_id,
          executor: session.executor,
          created_at: session.created_at,
          updated_at: session.updated_at,
        },
      });
    } catch (e) {
      return result({ error: 'Failed to get session', session_id: args.session_id, message: String(e) }, true);
    }
  },
};

// ============================================
// send_message
// ============================================
export const sendMessageTool = {
  name: 'send_message',
  description: `Send a follow-up message to an active session. The message will be sent to the coding agent (e.g., Claude Code). If the executor is busy, the message will be queued automatically (unless auto_queue is false). Executors: ${EXECUTORS.join(', ')}`,
  inputSchema: z.object({
    session_id: z.string().uuid().describe('Session UUID'),
    prompt: z.string().min(1).describe('Message to send to the coding agent'),
    executor: z.string().optional().describe('Executor name (auto-detected from session if omitted)'),
    variant: z.string().optional().describe('Executor variant (e.g., PLAN)'),
    auto_queue: z.boolean().optional().default(true).describe('If true, queue message when executor is busy instead of failing'),
  }),

  async handler(args: { session_id: string; prompt: string; executor?: string; variant?: string; auto_queue?: boolean }) {
    try {
      const client = getVibeClient();
      
      // Get session to determine executor if not provided
      const session = await client.getSession(args.session_id);
      const executor = args.executor || session.executor;
      
      if (!executor) {
        return result({ 
          error: 'Executor required', 
          hint: 'Session has no prior executions. Provide executor parameter.',
          session_id: args.session_id,
        }, true);
      }

      const executorProfile = client.buildExecutorProfile(executor, args.variant);
      
      try {
        // Try sending follow-up directly
        const process = await client.sendFollowUp(args.session_id, {
          prompt: args.prompt,
          executor_profile_id: executorProfile,
        });
        
        return result({
          success: true,
          action: 'sent',
          execution_process: {
            id: process.id,
            status: process.status,
            started_at: process.started_at,
          },
          session_id: args.session_id,
          executor: executor,
        });
      } catch (e) {
        // If auto_queue enabled and error suggests busy, try queueing
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
          
          return result({
            success: true,
            action: 'queued',
            queue_status: queueResult,
            session_id: args.session_id,
            executor: executor,
            hint: 'Message queued. Will execute when current process completes.',
          });
        }
        
        throw e;
      }
    } catch (e) {
      return result({ error: 'Failed to send message', session_id: args.session_id, message: String(e) }, true);
    }
  },
};

// ============================================
// get_queue_status
// ============================================
export const getQueueStatusTool = {
  name: 'get_queue_status',
  description: 'Check if a message is queued for a session. Returns the queued message content if present.',
  inputSchema: z.object({
    session_id: z.string().uuid().describe('Session UUID'),
  }),

  async handler(args: { session_id: string }) {
    try {
      const client = getVibeClient();
      const status = await client.getQueueStatus(args.session_id);
      
      if (status.type === 'Queued') {
        return result({
          has_queued_message: true,
          queued_message: status.message.message,
          executor: status.message.executor_profile_id.executor,
          variant: status.message.executor_profile_id.variant,
        });
      } else {
        return result({
          has_queued_message: false,
        });
      }
    } catch (e) {
      return result({ error: 'Failed to get queue status', session_id: args.session_id, message: String(e) }, true);
    }
  },
};

// ============================================
// cancel_queue
// ============================================
export const cancelQueueTool = {
  name: 'cancel_queue',
  description: 'Cancel a queued message for a session.',
  inputSchema: z.object({
    session_id: z.string().uuid().describe('Session UUID'),
  }),

  async handler(args: { session_id: string }) {
    try {
      const client = getVibeClient();
      await client.cancelQueue(args.session_id);
      
      return result({
        success: true,
        message: 'Queued message cancelled',
        session_id: args.session_id,
      });
    } catch (e) {
      return result({ error: 'Failed to cancel queue', session_id: args.session_id, message: String(e) }, true);
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
