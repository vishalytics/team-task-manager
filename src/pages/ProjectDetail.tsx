import { Link, useParams } from 'react-router-dom'
import { TaskWorkspace } from '@/components/tasks/TaskWorkspace'
import { EmptyState } from '@/components/ui/empty-state'
import { useTaskStore } from '@/state/TaskStore'

export default function ProjectDetail() {
  const { projectId = '' } = useParams()
  const { projects, tasks, ready } = useTaskStore()
  const project = projects.find((p) => p.id === projectId)
  if (!ready) return <p role="status">Loading…</p>
  if (!project) {
    return <EmptyState title="Project not found" description="This project does not exist in the demo data." action={<Link className="text-primary underline" to="/projects">Back to projects</Link>} />
  }
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/projects" className="text-sm text-primary underline-offset-2 hover:underline">← All projects</Link>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm text-muted-foreground">{project.description}</p>
      </div>
      <TaskWorkspace
        key={project.id}
        tasks={tasks.filter((t) => t.projectId === project.id)}
        lockedFilters={{ projectId: project.id }}
        defaultProjectId={project.id}
        emptyTitle="No tasks in this project yet"
        emptyDescription="Create the first task to get started."
      />
    </div>
  )
}
