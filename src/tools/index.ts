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

// Export all tools as array
export const allTools = [
  getContextTool,
  listTasksTool,
  createTaskTool,
  getTaskTool,
  updateTaskTool,
  deleteTaskTool,
  startWorkspaceSessionTool,
];
