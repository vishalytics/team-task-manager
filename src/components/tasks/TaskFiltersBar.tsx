import { Button } from '@/components/ui/button'
import { Input, Label, NativeSelect } from '@/components/ui/field'
import { DEFAULT_FILTERS, hasActiveFilters } from '@/lib/tasks'
import { useTaskStore } from '@/state/TaskStore'
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES, type TaskFilters } from '@/types'

interface Props {
  filters: TaskFilters
  onChange: (f: TaskFilters) => void
  /** Hide controls that are fixed by the page (e.g. project on a project page). */
  hide?: ('projectId' | 'assigneeId')[]
}

export function TaskFiltersBar({ filters, onChange, hide = [] }: Props) {
  const { projects, employees } = useTaskStore()
  const set = <K extends keyof TaskFilters>(k: K, v: TaskFilters[K]) => onChange({ ...filters, [k]: v })
  return (
    <form role="search" aria-label="Filter tasks" onSubmit={(e) => e.preventDefault()} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="flex flex-col gap-1.5 lg:col-span-2">
        <Label htmlFor="f-search">Search</Label>
        <Input id="f-search" type="search" placeholder="Title or description" value={filters.search} onChange={(e) => set('search', e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-status">Status</Label>
        <NativeSelect id="f-status" value={filters.status} onChange={(e) => set('status', e.target.value as TaskFilters['status'])}>
          <option value="all">All statuses</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-priority">Priority</Label>
        <NativeSelect id="f-priority" value={filters.priority} onChange={(e) => set('priority', e.target.value as TaskFilters['priority'])}>
          <option value="all">All priorities</option>
          {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </NativeSelect>
      </div>
      {!hide.includes('assigneeId') && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-assignee">Assignee</Label>
          <NativeSelect id="f-assignee" value={filters.assigneeId} onChange={(e) => set('assigneeId', e.target.value)}>
            <option value="all">Everyone</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </NativeSelect>
        </div>
      )}
      {!hide.includes('projectId') && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-project">Project</Label>
          <NativeSelect id="f-project" value={filters.projectId} onChange={(e) => set('projectId', e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </NativeSelect>
        </div>
      )}
      {hasActiveFilters({ ...filters, ...Object.fromEntries(hide.map((k) => [k, 'all'])) }) && (
        <div className="flex items-end">
          <Button type="button" variant="outline" onClick={() => onChange({ ...DEFAULT_FILTERS, ...Object.fromEntries(hide.map((k) => [k, filters[k]])) })}>
            Clear filters
          </Button>
        </div>
      )}
    </form>
  )
}
