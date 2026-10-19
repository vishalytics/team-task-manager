import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { TaskRepository } from '@/data/taskRepository'
import type { Employee, Project, Task, TaskInput, TaskStatus } from '@/types'

interface TaskStoreValue {
  ready: boolean
  error: string | null
  tasks: Task[]
  projects: Project[]
  employees: Employee[]
  /** Demo-only "current user" used by My Tasks. This is NOT authentication. */
  viewerId: string
  setViewerId: (id: string) => void
  createTask: (input: TaskInput) => Promise<void>
  updateTask: (id: string, patch: Partial<TaskInput>) => Promise<void>
  setStatus: (id: string, status: TaskStatus) => Promise<void>
}

const Ctx = createContext<TaskStoreValue | null>(null)

export function TaskStoreProvider({ repository, children }: { repository: TaskRepository; children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewerId, setViewerId] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([repository.listTasks(), repository.listProjects(), repository.listEmployees()])
      .then(([t, p, e]) => {
        if (cancelled) return
        setTasks(t)
        setProjects(p)
        setEmployees(e)
        setViewerId((v) => v || e[0]?.id || '')
        setReady(true)
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load'))
    return () => {
      cancelled = true
    }
  }, [repository])

  const replace = useCallback((saved: Task) => setTasks((prev) => prev.map((t) => (t.id === saved.id ? saved : t))), [])

  const value = useMemo<TaskStoreValue>(
    () => ({
      ready,
      error,
      tasks,
      projects,
      employees,
      viewerId,
      setViewerId,
      createTask: async (input) => {
        const created = await repository.createTask(input)
        setTasks((prev) => [...prev, created])
      },
      updateTask: async (id, patch) => replace(await repository.updateTask(id, patch)),
      setStatus: async (id, status) => replace(await repository.setStatus(id, status)),
    }),
    [ready, error, tasks, projects, employees, viewerId, repository, replace],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTaskStore(): TaskStoreValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTaskStore must be used inside TaskStoreProvider')
  return v
}
