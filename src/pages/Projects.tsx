import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/ui/empty-state'
import { useTaskStore } from '@/state/TaskStore'

export default function Projects() {
  const { projects, tasks } = useTaskStore()
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Projects</h1>
      {projects.length === 0 ? (
        <EmptyState title="No projects yet" description="Projects will appear here." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-3">
          {projects.map((p) => {
            const mine = tasks.filter((t) => t.projectId === p.id)
            return (
              <li key={p.id} className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">{p.department}</p>
                <h2 className="mt-1 font-semibold">
                  <Link to={`/projects/${p.id}`} className="text-primary underline-offset-2 hover:underline">{p.name}</Link>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                <p className="mt-3 text-sm">{mine.length} tasks · {mine.filter((t) => t.status === 'done').length} done</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
