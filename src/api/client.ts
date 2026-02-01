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
} from './types.js';

export class VibeClient {
  private baseUrl: string;
  private projectId: string;
  private repoId: string;

  constructor() {
    const config = getConfig();
    this.baseUrl = config.baseUrl;
    this.projectId = config.projectId;
    this.repoId = config.repoId;
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
    const normalizedExecutor = executor.trim().replace(/-/g, '_').toUpperCase();
    
    return this.request<Workspace>('POST', '/api/task-attempts', {
      task_id: taskId,
      executor_profile_id: {
        executor: normalizedExecutor,
        variant: variant || null,
      },
      repos: [{
        repo_id: this.repoId,
        target_branch: baseBranch || null,
      }],
    });
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
  getRepoId(): string { return this.repoId; }
}

let clientInstance: VibeClient | null = null;

export function getVibeClient(): VibeClient {
  if (!clientInstance) {
    clientInstance = new VibeClient();
  }
  return clientInstance;
}
