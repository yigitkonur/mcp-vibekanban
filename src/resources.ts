/**
 * MCP Resource Handlers + Subscription Manager
 *
 * Exposes Vibe Kanban data as MCP resources:
 *   vibe://tasks           - All project tasks
 *   vibe://context         - Workspace context (if VIBE_WORKSPACE_ID set)
 *   vibe://tasks/{taskId}  - Individual task details
 *   vibe://sessions/{sessionId}       - Session info
 *   vibe://sessions/{sessionId}/queue - Queue status
 *
 * Supports subscribe/unsubscribe with polling-based change detection.
 */

import { createHash } from 'crypto';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getVibeClient } from './api/client.js';
import { getConfig, type Config } from './config.js';
import { formatResourceContent } from './utils/formatter.js';

// ============================================
// URI Parsing
// ============================================

type ParsedUri =
  | { type: 'tasks' }
  | { type: 'task'; taskId: string }
  | { type: 'session'; sessionId: string }
  | { type: 'queue'; sessionId: string }
  | { type: 'context' }
  | null;

export function parseResourceUri(uri: string): ParsedUri {
  if (uri === 'vibe://tasks') return { type: 'tasks' };
  if (uri === 'vibe://context') return { type: 'context' };

  const taskMatch = uri.match(/^vibe:\/\/tasks\/([0-9a-f-]+)$/i);
  if (taskMatch) return { type: 'task', taskId: taskMatch[1] };

  const queueMatch = uri.match(/^vibe:\/\/sessions\/([0-9a-f-]+)\/queue$/i);
  if (queueMatch) return { type: 'queue', sessionId: queueMatch[1] };

  const sessionMatch = uri.match(/^vibe:\/\/sessions\/([0-9a-f-]+)$/i);
  if (sessionMatch) return { type: 'session', sessionId: sessionMatch[1] };

  return null;
}

// ============================================
// Fetch resource data by parsed URI
// ============================================

async function fetchResourceData(parsed: NonNullable<ParsedUri>): Promise<unknown> {
  const client = getVibeClient();
  switch (parsed.type) {
    case 'tasks':
      return client.listTasks();
    case 'context': {
      const config = getConfig();
      if (!config.workspaceId) {
        return { error: 'VIBE_WORKSPACE_ID not set' };
      }
      return client.getWorkspaceContext(config.workspaceId);
    }
    case 'task':
      return client.getTask(parsed.taskId);
    case 'session':
      return client.getSession(parsed.sessionId);
    case 'queue':
      return client.getQueueStatus(parsed.sessionId);
  }
}

// ============================================
// Subscription Manager
// ============================================

export class SubscriptionManager {
  private subscriptions = new Set<string>();
  private lastHashes = new Map<string, string>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private server: Server;
  private pollIntervalMs: number;

  constructor(server: Server, config: Config) {
    this.server = server;
    this.pollIntervalMs = config.resourcePollIntervalMs;
  }

  subscribe(uri: string): void {
    this.subscriptions.add(uri);
    if (!this.pollTimer) {
      this.startPolling();
    }
  }

  unsubscribe(uri: string): void {
    this.subscriptions.delete(uri);
    this.lastHashes.delete(uri);
    if (this.subscriptions.size === 0) {
      this.stopPolling();
    }
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      this.checkForChanges().catch(err => {
        console.error('[vibe-kanban-mcp] Subscription poll error:', err);
      });
    }, this.pollIntervalMs);
  }

  private async checkForChanges(): Promise<void> {
    for (const uri of this.subscriptions) {
      try {
        const parsed = parseResourceUri(uri);
        if (!parsed) continue;

        const data = await fetchResourceData(parsed);
        const json = JSON.stringify(data);
        const hash = createHash('sha256').update(json).digest('hex');

        const lastHash = this.lastHashes.get(uri);
        if (lastHash && lastHash !== hash) {
          await this.server.sendResourceUpdated({ uri });
        }
        this.lastHashes.set(uri, hash);
      } catch {
        // Skip failed URIs silently
      }
    }
  }
}

// ============================================
// Register Resource Handlers
// ============================================

export function registerResourceHandlers(
  server: Server,
  subMgr: SubscriptionManager,
): void {
  // List static resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources: Array<{ uri: string; name: string; description: string; mimeType: string }> = [
      {
        uri: 'vibe://tasks',
        name: 'Project Tasks',
        description: 'All tasks in the current project',
        mimeType: 'application/json',
      },
    ];

    const config = getConfig();
    if (config.workspaceId) {
      resources.push({
        uri: 'vibe://context',
        name: 'Workspace Context',
        description: 'Current workspace context (project, task, workspace)',
        mimeType: 'application/json',
      });
    }

    return { resources };
  });

  // List resource templates
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [
      {
        uriTemplate: 'vibe://tasks/{taskId}',
        name: 'Task Details',
        description: 'Individual task by ID',
        mimeType: 'application/json',
      },
      {
        uriTemplate: 'vibe://sessions/{sessionId}',
        name: 'Session Details',
        description: 'Session info by ID',
        mimeType: 'application/json',
      },
      {
        uriTemplate: 'vibe://sessions/{sessionId}/queue',
        name: 'Queue Status',
        description: 'Queue status for a session',
        mimeType: 'application/json',
      },
    ],
  }));

  // Read a resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const parsed = parseResourceUri(uri);

    if (!parsed) {
      throw new Error(`Unknown resource URI: ${uri}`);
    }

    const data = await fetchResourceData(parsed);
    return formatResourceContent(uri, data);
  });

  // Subscribe to a resource
  server.setRequestHandler(SubscribeRequestSchema, async (request) => {
    subMgr.subscribe(request.params.uri);
    return {};
  });

  // Unsubscribe from a resource
  server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
    subMgr.unsubscribe(request.params.uri);
    return {};
  });
}

// ============================================
// Factory
// ============================================

export function createSubscriptionManager(server: Server, config: Config): SubscriptionManager {
  return new SubscriptionManager(server, config);
}
