import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { NativeSelect } from '@/components/ui/field'
import { formatDueDate, isOverdue, toIsoDate } from '@/lib/tasks'
import { useTaskStore } from '@/state/TaskStore'
import { STATUS_LABELS, TASK_STATUSES, type Task, type TaskStatus } from '@/types'
import { PriorityBadge, StatusBadge } from './badges'
import { TaskDialogContent } from './TaskForm'

function useTaskLookups() {
  const { employees, projects } = useTaskStore()
  return {
    assignee: (id: string) => employees.find((e) => e.id === id)?.name ?? 'Unassigned',
    project: (id: string) => projects.find((p) => p.id === id)?.name ?? 'Unknown project',
  }
}

function StatusSelect({ task }: { task: Task }) {
  const { setStatus } = useTaskStore()
  return (
    <NativeSelect
      aria-label={`Status for ${task.title}`}
      className="h-8 w-auto text-xs"
      value={task.status}
      onChange={(e) => void setStatus(task.id, e.target.value as TaskStatus)}
    >
      {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
    </NativeSelect>
  )
}

function EditButton({ task }: { task: Task }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${task.title}`} onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" aria-hidden />
      </Button>
      {open && <TaskDialogContent task={task} onDone={() => setOpen(false)} />}
    </Dialog>
  )
}

function DueDate({ task }: { task: Task }) {
  const overdue = isOverdue(task, toIsoDate(new Date()))
  return (
    <span className={overdue ? 'font-medium text-destructive' : ''}>
      {formatDueDate(task.dueDate)}
      {overdue && ' (overdue)'}
    </span>
  )
}

export function TaskList({ tasks, showProject = true }: { tasks: Task[]; showProject?: boolean }) {
  const { assignee, project } = useTaskLookups()
  return (
    <ul aria-label="Task list" className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
      {tasks.map((t) => (
        <li key={t.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t.title}</p>
            {t.description && <p className="truncate text-sm text-muted-foreground">{t.description}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {showProject && <>{project(t.projectId)} · </>}
              {assignee(t.assigneeId)} · Due <DueDate task={t} />
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={t.priority} />
            <StatusSelect task={t} />
            <EditButton task={t} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  const { assignee } = useTaskLookups()
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {TASK_STATUSES.map((status) => {
        const col = tasks.filter((t) => t.status === status)
        return (
          <section key={status} aria-labelledby={`col-${status}`} className="rounded-lg bg-muted p-3">
            <h3 id={`col-${status}`} className="mb-3 flex items-center justify-between text-sm font-semibold">
              {STATUS_LABELS[status]}
              <span className="text-xs font-normal text-muted-foreground">{col.length}</span>
            </h3>
            {col.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                No tasks here
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {col.map((t) => (
                  <li key={t.id} className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{assignee(t.assigneeId)} · Due <DueDate task={t} /></p>
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={t.priority} />
                      <StatusSelect task={t} />
                      <EditButton task={t} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

export { StatusBadge }
