/**
 * Progress Notification Helper
 *
 * Wraps extra.sendNotification to emit MCP progress notifications.
 * No-ops if the client didn't provide a progressToken.
 */

import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

export interface ProgressEmitter {
  emit(progress: number, total: number, message: string): Promise<void>;
}

/**
 * Creates a progress emitter bound to the current request's progressToken.
 * If no progressToken was provided by the client, all emit() calls are no-ops.
 */
export function createProgressEmitter(extra: Extra): ProgressEmitter {
  const progressToken = extra._meta?.progressToken;

  return {
    async emit(progress: number, total: number, message: string): Promise<void> {
      if (progressToken === undefined) return;

      try {
        await extra.sendNotification({
          method: 'notifications/progress',
          params: { progressToken, progress, total, message },
        });
      } catch {
        // Swallow errors — progress is best-effort
      }
    },
  };
}
