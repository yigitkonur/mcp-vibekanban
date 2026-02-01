/**
 * Type definitions for Vibe Kanban API responses
 */

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = 'todo' | 'inprogress' | 'inreview' | 'done' | 'cancelled';

export interface TaskWithAttemptStatus extends Task {
  attempt_status?: string | null;
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  task_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceContext {
  project: Project;
  task: Task;
  workspace: Workspace;
}

export interface Tag {
  tag_name: string;
  content: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}
