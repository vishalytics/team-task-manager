export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'done']
export const TASK_PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high']

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}
export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export interface Employee {
  id: string
  name: string
  role: string
}

export interface Project {
  id: string
  name: string
  description: string
  department: 'IT' | 'Procurement' | 'HR'
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  /** Exactly one assignee (employee id). */
  assigneeId: string
  priority: TaskPriority
  /** ISO calendar date, YYYY-MM-DD. */
  dueDate: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
}

/** Fields a user supplies when creating or editing a task. */
export type TaskInput = Pick<
  Task,
  'projectId' | 'title' | 'description' | 'assigneeId' | 'priority' | 'dueDate' | 'status'
>

export interface TaskFilters {
  search: string
  /** 'all' or a status. */
  status: TaskStatus | 'all'
  priority: TaskPriority | 'all'
  /** 'all' or an employee id. */
  assigneeId: string
  /** 'all' or a project id. */
  projectId: string
}

export interface DashboardCounts {
  total: number
  byStatus: Record<TaskStatus, number>
  overdue: number
  dueThisWeek: number
  highPriorityOpen: number
  byProject: Record<string, { total: number; done: number }>
}
