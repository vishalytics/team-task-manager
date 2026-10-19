import { Link } from 'react-router-dom'
import { computeDashboardCounts, toIsoDate } from '@/lib/tasks'
import { useTaskStore } from '@/state/TaskStore'
import { STATUS_LABELS, TASK_STATUSES } from '@/types'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold">{value}</dd>
    </div>
  )
}

export default function Dashboard() {
  const { tasks, projects } = useTaskStore()
  const c = computeDashboardCounts(tasks, toIsoDate(new Date()))
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <dl aria-label="Task counts" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total tasks" value={c.total} />
        {TASK_STATUSES.map((s) => <Stat key={s} label={STATUS_LABELS[s]} value={c.byStatus[s]} />)}
        <Stat label="Overdue" value={c.overdue} />
        <Stat label="Due in next 7 days" value={c.dueThisWeek} />
        <Stat label="High priority, open" value={c.highPriorityOpen} />
      </dl>
      <section aria-labelledby="by-project">
        <h2 id="by-project" className="mb-3 text-lg font-semibold">Progress by project</h2>
        <ul className="flex flex-col gap-3">
          {projects.map((p) => {
            const s = c.byProject[p.id] ?? { total: 0, done: 0 }
            return (
              <li key={p.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex justify-between gap-2 text-sm">
                  <Link to={`/projects/${p.id}`} className="font-medium text-primary underline-offset-2 hover:underline">{p.name}</Link>
                  <span>{s.done} of {s.total} done</span>
                </div>
                <progress className="mt-2 h-2 w-full" max={Math.max(s.total, 1)} value={s.done} aria-label={`${p.name} completion`} />
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
