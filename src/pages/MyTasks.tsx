import { TaskWorkspace } from '@/components/tasks/TaskWorkspace'
import { useTaskStore } from '@/state/TaskStore'

export default function MyTasks() {
  const { tasks, employees, viewerId } = useTaskStore()
  const me = employees.find((e) => e.id === viewerId)
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">My Tasks</h1>
        <p className="text-sm text-muted-foreground">Demo persona: {me?.name ?? '—'} (not a real sign-in)</p>
      </div>
      <TaskWorkspace
        key={viewerId}
        tasks={tasks.filter((t) => t.assigneeId === viewerId)}
        lockedFilters={{ assigneeId: viewerId }}
        emptyTitle="Nothing assigned to this person"
        emptyDescription="Create a task and assign it to them, or switch the demo persona in the sidebar."
      />
    </div>
  )
}
