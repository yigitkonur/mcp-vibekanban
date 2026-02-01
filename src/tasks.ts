/**
 * Task Primitive Integration for send_message
 *
 * When the MCP client supports tasks (extra.taskStore is available),
 * send_message creates an MCP task that tracks the Vibe execution process.
 * A background poller monitors the process and updates the task status.
 *
 * Status mapping:
 *   Vibe running   → MCP working
 *   Vibe completed → MCP completed
 *   Vibe failed    → MCP failed
 *   Vibe killed    → MCP cancelled
 */

import type { ServerNotification, ServerRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ExecutionProcess, ExecutionProcessStatus } from './api/types.js';
import { getVibeClient } from './api/client.js';
import { createProgressEmitter } from './utils/progress.js';
import { shortId, formatSuccess } from './utils/formatter.js';

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ITERATIONS = 120; // 10 minutes max

/**
 * Maps Vibe execution process status to MCP task status.
 */
function mapStatus(vibeStatus: ExecutionProcessStatus): 'working' | 'completed' | 'failed' | 'cancelled' {
  switch (vibeStatus) {
    case 'running': return 'working';
    case 'completed': return 'completed';
    case 'failed': return 'failed';
    case 'killed': return 'cancelled';
    default: return 'working';
  }
}

/**
 * Called by send_message when extra.taskStore is available.
 * Creates an MCP task that tracks the Vibe execution process.
 */
export async function taskAwareSendMessage(
  sessionId: string,
  executor: string,
  process: ExecutionProcess,
  extra: Extra,
): Promise<CallToolResult> {
  const taskStore = extra.taskStore!;

  const task = await taskStore.createTask({
    ttl: 300000,
    pollInterval: POLL_INTERVAL_MS,
  });

  // Start background polling (non-blocking)
  pollExecutionProcess(process.id, sessionId, task.taskId, extra).catch(err => {
    console.error('[vibe-kanban-mcp] Task poll error:', err);
  });

  return {
    content: [{
      type: 'text',
      text: [
        `✅ **Message Sent** (task-tracked)`,
        `• Executor: **${executor.toUpperCase()}**`,
        `• Process: \`${shortId(process.id)}\``,
        `• MCP Task: \`${task.taskId}\``,
        `• Status: 🔵 Working`,
        '',
        'The execution process is being tracked as an MCP task.',
        'Poll `tasks/get` to check status, or wait for completion.',
      ].join('\n'),
    }],
  };
}

/**
 * Background poller that monitors a Vibe execution process
 * and updates the corresponding MCP task.
 */
async function pollExecutionProcess(
  processId: string,
  sessionId: string,
  mcpTaskId: string,
  extra: Extra,
): Promise<void> {
  const client = getVibeClient();
  const taskStore = extra.taskStore!;
  const p = createProgressEmitter(extra);
  const startTime = Date.now();

  for (let i = 0; i < MAX_POLL_ITERATIONS; i++) {
    // Check for cancellation
    if (extra.signal.aborted) {
      await taskStore.updateTaskStatus(mcpTaskId, 'cancelled', 'Cancelled by client');
      return;
    }

    await sleep(POLL_INTERVAL_MS);

    try {
      let process: ExecutionProcess;
      try {
        process = await client.getExecutionProcess(processId);
      } catch {
        // Fall back to listing by session
        const processes = await client.listExecutionProcesses(sessionId);
        const found = processes.find(p => p.id === processId);
        if (!found) {
          await taskStore.updateTaskStatus(mcpTaskId, 'failed', 'Execution process not found');
          return;
        }
        process = found;
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const mcpStatus = mapStatus(process.status);

      // Emit progress notification
      await p.emit(i + 1, MAX_POLL_ITERATIONS, `Execution ${process.status} (${elapsed}s elapsed)`);

      // Check for terminal states
      if (mcpStatus === 'completed') {
        await taskStore.storeTaskResult(mcpTaskId, 'completed', {
          content: [{
            type: 'text',
            text: [
              `✅ **Execution Completed**`,
              `• Process: \`${shortId(processId)}\``,
              `• Duration: ${elapsed}s`,
              `• Exit code: ${process.exit_code ?? 'N/A'}`,
            ].join('\n'),
          }],
        });
        return;
      }

      if (mcpStatus === 'failed') {
        await taskStore.storeTaskResult(mcpTaskId, 'failed', {
          content: [{
            type: 'text',
            text: [
              `❌ **Execution Failed**`,
              `• Process: \`${shortId(processId)}\``,
              `• Duration: ${elapsed}s`,
              `• Exit code: ${process.exit_code ?? 'N/A'}`,
            ].join('\n'),
          }],
        });
        return;
      }

      if (mcpStatus === 'cancelled') {
        await taskStore.updateTaskStatus(mcpTaskId, 'cancelled', 'Execution killed');
        return;
      }
    } catch (err) {
      // Log but continue polling on transient errors
      console.error('[vibe-kanban-mcp] Poll iteration error:', err);
    }
  }

  // Timed out
  await taskStore.updateTaskStatus(mcpTaskId, 'failed', 'Timed out after 10 minutes');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
