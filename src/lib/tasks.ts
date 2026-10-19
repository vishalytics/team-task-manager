import type { DashboardCounts, Task, TaskFilters, TaskInput, TaskStatus } from '@/types'
import { TASK_STATUSES } from '@/types'

export const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  status: 'all',
  priority: 'all',
  assigneeId: 'all',
  projectId: 'all',
}

export type TaskInputErrors = Partial<Record<keyof TaskInput, string>>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function validateTaskInput(input: TaskInput): TaskInputErrors {
  const errors: TaskInputErrors = {}
  if (!input.title.trim()) errors.title = 'Title is required.'
  else if (input.title.trim().length > 120) errors.title = 'Title must be 120 characters or fewer.'
  if (!input.projectId) errors.projectId = 'Choose a project.'
  if (!input.assigneeId) errors.assigneeId = 'Choose an assignee.'
  if (!ISO_DATE.test(input.dueDate) || Number.isNaN(Date.parse(input.dueDate))) {
    errors.dueDate = 'Choose a valid due date.'
  }
  return errors
}

function normalise(input: TaskInput): TaskInput {
  return { ...input, title: input.title.trim(), description: input.description.trim() }
}

export function buildTask(input: TaskInput, id: string, nowIso: string): Task {
  return { ...normalise(input), id, createdAt: nowIso, updatedAt: nowIso }
}

/** Returns a new list with the task replaced; unknown ids leave the list unchanged. */
export function applyTaskUpdate(
  tasks: readonly Task[],
  id: string,
  patch: Partial<TaskInput>,
  nowIso: string,
): Task[] {
  return tasks.map((t) =>
    t.id === id
      ? { ...t, ...normalise({ ...t, ...patch }), id: t.id, createdAt: t.createdAt, updatedAt: nowIso }
      : t,
  )
}

export function filterTasks(tasks: readonly Task[], f: TaskFilters): Task[] {
  const q = f.search.trim().toLowerCase()
  return tasks.filter(
    (t) =>
      (f.status === 'all' || t.status === f.status) &&
      (f.priority === 'all' || t.priority === f.priority) &&
      (f.assigneeId === 'all' || t.assigneeId === f.assigneeId) &&
      (f.projectId === 'all' || t.projectId === f.projectId) &&
      (q === '' || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
  )
}

export function hasActiveFilters(f: TaskFilters): boolean {
  return (Object.keys(DEFAULT_FILTERS) as (keyof TaskFilters)[]).some((k) => f[k] !== DEFAULT_FILTERS[k])
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  return toIsoDate(new Date(y, m - 1, d + days))
}

export function isOverdue(task: Task, today: string): boolean {
  return task.status !== 'done' && task.dueDate < today
}

/** Dashboard numbers are always derived from the task list; nothing is stored. */
export function computeDashboardCounts(tasks: readonly Task[], today: string): DashboardCounts {
  const weekEnd = addDays(today, 7)
  const byStatus = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>
  const byProject: DashboardCounts['byProject'] = {}
  let overdue = 0
  let dueThisWeek = 0
  let highPriorityOpen = 0

  for (const t of tasks) {
    byStatus[t.status] += 1
    const p = (byProject[t.projectId] ??= { total: 0, done: 0 })
    p.total += 1
    if (t.status === 'done') p.done += 1
    else {
      if (t.dueDate < today) overdue += 1
      else if (t.dueDate <= weekEnd) dueThisWeek += 1
      if (t.priority === 'high') highPriorityOpen += 1
    }
  }
  return { total: tasks.length, byStatus, overdue, dueThisWeek, highPriorityOpen, byProject }
}

export function formatDueDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
