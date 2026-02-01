/**
 * Response Formatter - Agent-Optimized Markdown Responses
 * 
 * Follows the 70/20/10 pattern:
 * - 70% Summary: Key insights, status, actionable info
 * - 20% Data: Structured data (tables, lists)
 * - 10% Next Steps: Suggested follow-up actions
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Format a successful response with the 70/20/10 pattern
 */
export function formatSuccess(sections: {
  summary: string;
  data?: string;
  nextSteps?: string[];
}): CallToolResult {
  const parts: string[] = [];
  
  // 70% - Summary (always present)
  parts.push(sections.summary);
  
  // 20% - Data (optional)
  if (sections.data) {
    parts.push('');
    parts.push('---');
    parts.push(sections.data);
  }
  
  // 10% - Next Steps (optional)
  if (sections.nextSteps && sections.nextSteps.length > 0) {
    parts.push('');
    parts.push('**Next Steps:**');
    sections.nextSteps.forEach(step => {
      parts.push(`→ ${step}`);
    });
  }
  
  return {
    content: [{ type: 'text', text: parts.join('\n') }],
  };
}

/**
 * Format an error response with recovery hints
 */
export function formatError(error: {
  type: string;
  message: string;
  context?: Record<string, unknown>;
  howToFix?: string[];
  alternatives?: string[];
}): CallToolResult {
  const parts: string[] = [];
  
  parts.push(`❌ **${error.type}**`);
  parts.push(error.message);
  
  if (error.context && Object.keys(error.context).length > 0) {
    parts.push('');
    for (const [key, value] of Object.entries(error.context)) {
      parts.push(`• ${key}: \`${value}\``);
    }
  }
  
  if (error.howToFix && error.howToFix.length > 0) {
    parts.push('');
    parts.push('**How to fix:**');
    error.howToFix.forEach((fix, i) => {
      parts.push(`${i + 1}. ${fix}`);
    });
  }
  
  if (error.alternatives && error.alternatives.length > 0) {
    parts.push('');
    parts.push('**Alternatives:**');
    error.alternatives.forEach(alt => {
      parts.push(`• ${alt}`);
    });
  }
  
  return {
    content: [{ type: 'text', text: parts.join('\n') }],
    isError: true,
  };
}

/**
 * Format a task list as clean markdown
 */
export function formatTaskList(tasks: Array<{
  id: string;
  title: string;
  status: string;
  updated_at?: string;
}>): string {
  if (tasks.length === 0) {
    return '*No tasks found*';
  }
  
  const statusEmoji: Record<string, string> = {
    todo: '⬜',
    inprogress: '🔵',
    inreview: '🟡',
    done: '✅',
    cancelled: '🚫',
  };
  
  const lines = tasks.map(t => {
    const emoji = statusEmoji[t.status] || '•';
    const shortId = t.id.slice(0, 8);
    return `${emoji} **${t.title}** (\`${shortId}\`)`;
  });
  
  return lines.join('\n');
}

/**
 * Format sessions as a list
 */
export function formatSessionList(sessions: Array<{
  id: string;
  executor: string;
  created_at?: string;
}>): string {
  if (sessions.length === 0) {
    return '*No sessions found*';
  }
  
  return sessions.map(s => {
    const shortId = s.id.slice(0, 8);
    return `• **${s.executor}** session: \`${shortId}\``;
  }).join('\n');
}

/**
 * Format a task for display
 */
export function formatTask(task: {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}): string {
  const statusEmoji: Record<string, string> = {
    todo: '⬜ To Do',
    inprogress: '🔵 In Progress',
    inreview: '🟡 In Review',
    done: '✅ Done',
    cancelled: '🚫 Cancelled',
  };
  
  const lines: string[] = [];
  lines.push(`**${task.title}**`);
  lines.push(`Status: ${statusEmoji[task.status] || task.status}`);
  lines.push(`ID: \`${task.id}\``);
  
  if (task.description) {
    lines.push('');
    // Truncate long descriptions
    const desc = task.description.length > 300 
      ? task.description.slice(0, 300) + '…' 
      : task.description;
    lines.push(`> ${desc.replace(/\n/g, '\n> ')}`);
  }
  
  return lines.join('\n');
}

/**
 * Shorten a UUID for display
 */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

/**
 * Format workspace/session info
 */
export function formatWorkspaceInfo(info: {
  workspace_id: string;
  task_id: string;
  executor: string;
  repo_id?: string;
  branch?: string;
}): string {
  const lines: string[] = [];
  lines.push(`✓ **Workspace Started**`);
  lines.push(`• Workspace: \`${shortId(info.workspace_id)}\``);
  lines.push(`• Task: \`${shortId(info.task_id)}\``);
  lines.push(`• Executor: **${info.executor}**`);
  if (info.repo_id) lines.push(`• Repo: \`${shortId(info.repo_id)}\``);
  if (info.branch) lines.push(`• Branch: \`${info.branch}\``);
  return lines.join('\n');
}

/**
 * Format data for a resource read response
 */
export function formatResourceContent(uri: string, data: unknown): {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
} {
  return {
    contents: [{
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(data, null, 2),
    }],
  };
}

/**
 * Format queue status
 */
export function formatQueueStatus(hasQueued: boolean, message?: string, executor?: string): string {
  if (!hasQueued) {
    return '✓ **Queue Empty** - No pending messages';
  }
  
  const lines: string[] = [];
  lines.push('📤 **Message Queued**');
  if (executor) lines.push(`• Executor: **${executor}**`);
  if (message) {
    const truncated = message.length > 100 ? message.slice(0, 100) + '…' : message;
    lines.push(`• Message: "${truncated}"`);
  }
  return lines.join('\n');
}
