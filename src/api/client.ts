/**
 * HTTP Client for Vibe Kanban API
 * All requests are scoped to the locked project/repo from config
 */

import { getConfig } from '../config.js';
import type {
  Task,
  TaskWithAttemptStatus,
  Workspace,
  WorkspaceContext,
  ApiResponse,
  Tag,
  TaskStatus,
  Session,
  ExecutionProcess,
  CreateFollowUpRequest,
  QueueMessageRequest,
  QueueStatus,
  ExecutorProfileId,
} from './types.js';

export class VibeClient {
  private baseUrl: string;
  private projectId: string;
  private repoId: string | null;
  private _resolvedRepoId: string | null = null; // Cache for auto-fetched repo

  constructor() {
    const config = getConfig();
    this.baseUrl = config.baseUrl;
    this.projectId = config.projectId;
    this.repoId = config.repoId;
  }

  // Auto-fetch repo if not provided
  private async getRepoId(): Promise<string> {
    if (this.repoId) return this.repoId;
    if (this._resolvedRepoId) return this._resolvedRepoId;

    // Fetch repos for this project
    interface Repo { id: string; name: string; }
    const repos = await this.request<Repo[]>('GET', `/api/projects/${this.projectId}/repositories`);
    
    if (!repos || repos.length === 0) {
      throw new Error(`No repositories found in project ${this.projectId}. Create a repository first.`);
    }

    if (repos.length > 1) {
      throw new Error(
        `Project has ${repos.length} repositories. Please set VIBE_REPO_ID explicitly.\n` +
        `Available repos:\n` +
        repos.map(r => `  - ${r.name} (${r.id})`).join('\n')
      );
    }

    this._resolvedRepoId = repos[0].id;
    return this._resolvedRepoId;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = this.url(path);
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error ${response.status}: ${text}`);
    }

    const json = await response.json() as ApiResponse<T>;
    
    if (!json.success) {
      throw new Error(json.message || 'API returned unsuccessful response');
    }

    return json.data as T;
  }

  // Task Operations
  async listTasks(status?: TaskStatus, limit?: number): Promise<TaskWithAttemptStatus[]> {
    const tasks = await this.request<TaskWithAttemptStatus[]>(
      'GET', 
      `/api/tasks?project_id=${this.projectId}`
    );
    
    let filtered = status ? tasks.filter(t => t.status === status) : tasks;
    return limit ? filtered.slice(0, limit) : filtered;
  }

  async createTask(title: string, description?: string): Promise<Task> {
    const expandedDesc = description ? await this.expandTags(description) : undefined;
    return this.request<Task>('POST', '/api/tasks', {
      project_id: this.projectId,
      title,
      description: expandedDesc,
    });
  }

  async getTask(taskId: string): Promise<Task> {
    return this.request<Task>('GET', `/api/tasks/${taskId}`);
  }

  async updateTask(taskId: string, updates: { title?: string; description?: string; status?: TaskStatus }): Promise<Task> {
    const payload = { ...updates };
    if (updates.description) {
      payload.description = await this.expandTags(updates.description);
    }
    return this.request<Task>('PUT', `/api/tasks/${taskId}`, payload);
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.request<void>('DELETE', `/api/tasks/${taskId}`);
  }

  // Workspace Operations
  async startWorkspaceSession(taskId: string, executor: string, variant?: string, baseBranch?: string): Promise<Workspace> {
    const repoId = await this.getRepoId();
    const normalizedExecutor = executor.trim().replace(/-/g, '_').toUpperCase();
    
    // Build payload - target_branch defaults to "main" if not specified
    const payload: Record<string, unknown> = {
      task_id: taskId,
      executor_profile_id: variant 
        ? { executor: normalizedExecutor, variant }
        : { executor: normalizedExecutor },
      repos: [{ 
        repo_id: repoId, 
        target_branch: baseBranch || 'main' 
      }],
    };
    
    return this.request<Workspace>('POST', '/api/task-attempts', payload);
  }

  async getWorkspaceContext(workspaceId: string): Promise<WorkspaceContext> {
    return this.request<WorkspaceContext>('GET', `/api/workspaces/${workspaceId}/context`);
  }

  // Tag expansion (replaces @tagname with tag content)
  private async expandTags(text: string): Promise<string> {
    const matches = text.match(/@([^\s@]+)/g);
    if (!matches) return text;

    try {
      const tags = await this.request<Tag[]>('GET', '/api/tags');
      const tagMap = new Map(tags.map(t => [t.tag_name, t.content]));
      
      let result = text;
      for (const match of matches) {
        const tagName = match.slice(1);
        const content = tagMap.get(tagName);
        if (content) {
          result = result.replace(new RegExp(`@${tagName}`, 'g'), content);
        }
      }
      return result;
    } catch {
      return text;
    }
  }

  getProjectId(): string { return this.projectId; }
  async getRepoIdResolved(): Promise<string> { return this.getRepoId(); }

  // ============================================
  // Session Operations
  // ============================================

  async listSessions(workspaceId: string): Promise<Session[]> {
    return this.request<Session[]>('GET', `/api/sessions?workspace_id=${workspaceId}`);
  }

  async getSession(sessionId: string): Promise<Session> {
    return this.request<Session>('GET', `/api/sessions/${sessionId}`);
  }

  async sendFollowUp(sessionId: string, request: CreateFollowUpRequest): Promise<ExecutionProcess> {
    return this.request<ExecutionProcess>('POST', `/api/sessions/${sessionId}/follow-up`, request);
  }

  async queueMessage(sessionId: string, request: QueueMessageRequest): Promise<QueueStatus> {
    return this.request<QueueStatus>('POST', `/api/sessions/${sessionId}/queue`, request);
  }

  async getQueueStatus(sessionId: string): Promise<QueueStatus> {
    return this.request<QueueStatus>('GET', `/api/sessions/${sessionId}/queue`);
  }

  async cancelQueue(sessionId: string): Promise<QueueStatus> {
    return this.request<QueueStatus>('DELETE', `/api/sessions/${sessionId}/queue`);
  }

  // Helper to build ExecutorProfileId
  buildExecutorProfile(executor: string, variant?: string): ExecutorProfileId {
    const normalized = executor.trim().replace(/-/g, '_').toUpperCase();
    return variant ? { executor: normalized, variant } : { executor: normalized };
  }
}

let clientInstance: VibeClient | null = null;

export function getVibeClient(): VibeClient {
  if (!clientInstance) {
    clientInstance = new VibeClient();
  }
  return clientInstance;
}
