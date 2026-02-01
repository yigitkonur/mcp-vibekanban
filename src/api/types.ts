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

// ============================================
// Session & Execution Types
// ============================================

export interface Session {
  id: string;
  workspace_id: string;
  executor: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExecutorProfileId {
  executor: string;
  variant?: string | null;
}

export type ExecutionProcessStatus = 'running' | 'completed' | 'failed' | 'killed';
export type ExecutionProcessRunReason = 'coding_agent' | 'setup' | 'cleanup' | 'dev_server' | 'review';

export interface ExecutorAction {
  action_type: ExecutorActionType;
  cleanup_action?: unknown;
}

export interface ExecutorActionType {
  type: string;
  prompt?: string;
  executor_profile_id?: ExecutorProfileId;
  session_id?: string;
  working_dir?: string;
}

export interface ExecutionProcess {
  id: string;
  session_id: string;
  run_reason: ExecutionProcessRunReason;
  executor_action: ExecutorAction;
  status: ExecutionProcessStatus;
  exit_code: number | null;
  dropped: boolean;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftFollowUpData {
  message: string;
  executor_profile_id: ExecutorProfileId;
}

export type QueueStatus = 
  | { type: 'Queued'; message: DraftFollowUpData }
  | { type: 'Empty' };

export interface CreateFollowUpRequest {
  prompt: string;
  executor_profile_id: ExecutorProfileId;
  retry_process_id?: string | null;
  force_when_dirty?: boolean | null;
  perform_git_reset?: boolean | null;
}

export interface QueueMessageRequest {
  message: string;
  executor_profile_id: ExecutorProfileId;
}
