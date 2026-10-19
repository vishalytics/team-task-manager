import type { Employee, Project, Task, TaskInput, TaskStatus } from '@/types'

/**
 * Data-access contract. The UI only talks to this interface, so a Supabase
 * implementation can replace the in-memory one without touching components.
 */
export interface TaskRepository {
  listProjects(): Promise<Project[]>
  listEmployees(): Promise<Employee[]>
  listTasks(): Promise<Task[]>
  createTask(input: TaskInput): Promise<Task>
  updateTask(id: string, patch: Partial<TaskInput>): Promise<Task>
  setStatus(id: string, status: TaskStatus): Promise<Task>
}
