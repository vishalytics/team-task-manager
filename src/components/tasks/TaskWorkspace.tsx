import { useState } from 'react'
import { LayoutGrid, List, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { DEFAULT_FILTERS, filterTasks, hasActiveFilters } from '@/lib/tasks'
import { useTaskStore } from '@/state/TaskStore'
import type { Task, TaskFilters } from '@/types'
import { TaskDialogContent } from './TaskForm'
import { TaskFiltersBar } from './TaskFiltersBar'
import { TaskBoard, TaskList } from './TaskViews'

interface Props {
  /** Tasks in scope for the page (already narrowed to a project or person). */
  tasks: Task[]
  /** Filters fixed by the page, merged into the user's filters. */
  lockedFilters?: Partial<Pick<TaskFilters, 'projectId' | 'assigneeId'>>
  defaultProjectId?: string
  emptyTitle: string
  emptyDescription: string
}

export function TaskWorkspace({ tasks, lockedFilters = {}, defaultProjectId, emptyTitle, emptyDescription }: Props) {
  const { ready } = useTaskStore()
  const [filters, setFilters] = useState<TaskFilters>({ ...DEFAULT_FILTERS, ...lockedFilters })
  const [view, setView] = useState<'list' | 'board'>('list')
  const [creating, setCreating] = useState(false)
  const visible = filterTasks(tasks, filters)
  const hide = Object.keys(lockedFilters) as ('projectId' | 'assigneeId')[]
  // A page-locked filter alone is not a user filter.
  const userFiltered = hasActiveFilters({ ...filters, ...Object.fromEntries(hide.map((k) => [k, 'all'])) })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Choose view" className="inline-flex rounded-md border border-border bg-card p-0.5">
          {(['list', 'board'] as const).map((v) => (
            <Button key={v} size="sm" variant={view === v ? 'default' : 'ghost'} aria-pressed={view === v} onClick={() => setView(v)}>
              {v === 'list' ? <List className="h-4 w-4" aria-hidden /> : <LayoutGrid className="h-4 w-4" aria-hidden />}
              {v === 'list' ? 'List' : 'Board'}
            </Button>
          ))}
        </div>
        <Dialog open={creating} onOpenChange={setCreating}>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New task
          </Button>
          {creating && <TaskDialogContent defaultProjectId={defaultProjectId} onDone={() => setCreating(false)} />}
        </Dialog>
      </div>

      <TaskFiltersBar filters={filters} hide={hide} onChange={(f) => setFilters({ ...f, ...lockedFilters })} />

      <p aria-live="polite" className="text-sm text-muted-foreground">
        Showing {visible.length} of {tasks.length} tasks
      </p>

      {!ready ? (
        <p role="status">Loading tasks…</p>
      ) : visible.length === 0 ? (
        userFiltered && tasks.length > 0 ? (
          <EmptyState
            title="No tasks match these filters"
            description="Try a different search or clear the filters."
            action={<Button variant="outline" onClick={() => setFilters({ ...DEFAULT_FILTERS, ...lockedFilters })}>Clear filters</Button>}
          />
        ) : (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        )
      ) : view === 'list' ? (
        <TaskList tasks={visible} showProject={!lockedFilters.projectId} />
      ) : (
        <TaskBoard tasks={visible} />
      )}
    </div>
  )
}
