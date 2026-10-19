import type { Task, TaskInput, TaskStatus } from '@/types'
import { applyTaskUpdate, buildTask, toIsoDate, validateTaskInput } from '@/lib/tasks'
import { createSeedTasks, EMPLOYEES, PROJECTS } from './seed'
import type { TaskRepository } from './taskRepository'

/** In-memory demo repository. State lives in this closure and is lost on refresh. */
export function createMemoryRepository(
  now: () => Date = () => new Date(),
  initial?: Task[],
): TaskRepository {
  let tasks: Task[] = initial ?? createSeedTasks(toIsoDate(now()), now().toISOString())
  let seq = tasks.length

  const find = (id: string) => {
    const t = tasks.find((x) => x.id === id)
    if (!t) throw new Error(`Task ${id} not found`)
    return t
  }
  const update = (id: string, patch: Partial<TaskInput>): Task => {
    const current = find(id)
    const errors = validateTaskInput({ ...current, ...patch })
    if (Object.keys(errors).length) throw new Error(Object.values(errors).join(' '))
    tasks = applyTaskUpdate(tasks, id, patch, now().toISOString())
    return find(id)
  }

  return {
    listProjects: async () => [...PROJECTS],
    listEmployees: async () => [...EMPLOYEES],
    listTasks: async () => [...tasks],
    async createTask(input) {
      const errors = validateTaskInput(input)
      if (Object.keys(errors).length) throw new Error(Object.values(errors).join(' '))
      const task = buildTask(input, `t${++seq}`, now().toISOString())
      tasks = [...tasks, task]
      return task
    },
    async updateTask(id, patch) {
      return update(id, patch)
    },
    async setStatus(id: string, status: TaskStatus) {
      return update(id, { status })
    },
  }
}
