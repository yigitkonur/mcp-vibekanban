/**
 * Configuration loader for Vibe Kanban MCP Server
 * Reads required project/repo IDs from environment variables
 */

export interface Config {
  projectId: string;
  repoId: string | null; // null if not provided (will be auto-fetched)
  baseUrl: string;
  workspaceId?: string;
  resourcePollIntervalMs: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function loadConfig(): Config {
  const projectId = process.env.VIBE_PROJECT_ID;
  const repoId = process.env.VIBE_REPO_ID || null;
  const baseUrl = process.env.VIBE_API_URL || 'http://localhost:9119';
  const workspaceId = process.env.VIBE_WORKSPACE_ID;
  const resourcePollIntervalMs = parseInt(process.env.VIBE_RESOURCE_POLL_INTERVAL || '10000', 10);

  if (!projectId) {
    console.error('[vibe-kanban-mcp] Error: VIBE_PROJECT_ID is required');
    console.error('[vibe-kanban-mcp] Example: VIBE_PROJECT_ID=123e4567-e89b-12d3-a456-426614174000');
    process.exit(1);
  }

  if (!UUID_REGEX.test(projectId)) {
    console.error(`[vibe-kanban-mcp] Error: VIBE_PROJECT_ID must be a valid UUID. Got: ${projectId}`);
    process.exit(1);
  }
  
  if (repoId && !UUID_REGEX.test(repoId)) {
    console.error(`[vibe-kanban-mcp] Error: VIBE_REPO_ID must be a valid UUID. Got: ${repoId}`);
    process.exit(1);
  }

  return {
    projectId,
    repoId,
    baseUrl: baseUrl.replace(/\/$/, ''),
    workspaceId,
    resourcePollIntervalMs: isNaN(resourcePollIntervalMs) ? 10000 : resourcePollIntervalMs,
  };
}

let globalConfig: Config | null = null;

export function getConfig(): Config {
  if (!globalConfig) {
    globalConfig = loadConfig();
  }
  return globalConfig;
}
