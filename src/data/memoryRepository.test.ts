import { createMemoryRepository } from './memoryRepository'
import { createSeedTasks, EMPLOYEES, PROJECTS } from './seed'
import { computeDashboardCounts } from '@/lib/tasks'
import type { TaskInput } from '@/types'

const fixed = () => new Date(2026, 2, 10, 9, 0, 0)
const valid: TaskInput = { projectId: 'p-it', title: 'New', description: '', assigneeId: 'e1', priority: 'low', dueDate: '2026-03-20', status: 'todo' }

describe('seed data', () => {
  it('has IT, Procurement and HR projects and only fictional staff', () => {
    expect(PROJECTS.map((p) => p.department).sort()).toEqual(['HR', 'IT', 'Procurement'])
    expect(EMPLOYEES.length).toBeGreaterThan(3)
  })
  it('every task references an existing project and assignee', () => {
    for (const t of createSeedTasks('2026-03-10', '2026-03-10T00:00:00Z')) {
      expect(PROJECTS.some((p) => p.id === t.projectId)).toBe(true)
      expect(EMPLOYEES.some((e) => e.id === t.assigneeId)).toBe(true)
    }
  })
})

describe('memory repository', () => {
  it('creates a task and dashboard counts follow', async () => {
    const repo = createMemoryRepository(fixed)
    const before = computeDashboardCounts(await repo.listTasks(), '2026-03-10')
    const created = await repo.createTask(valid)
    const after = computeDashboardCounts(await repo.listTasks(), '2026-03-10')
    expect(created.id).toBeTruthy()
    expect(after.total).toBe(before.total + 1)
    expect(after.byStatus.todo).toBe(before.byStatus.todo + 1)
  })
  it('gives each new task a unique id', async () => {
    const repo = createMemoryRepository(fixed)
    const a = await repo.createTask(valid); const b = await repo.createTask(valid)
    expect(a.id).not.toBe(b.id)
  })
  it('changes status and moves the dashboard count', async () => {
    const repo = createMemoryRepository(fixed)
    const [first] = await repo.listTasks()
    const before = computeDashboardCounts(await repo.listTasks(), '2026-03-10')
    await repo.setStatus(first!.id, 'done')
    const after = computeDashboardCounts(await repo.listTasks(), '2026-03-10')
    expect(after.byStatus.done).toBe(before.byStatus.done + (first!.status === 'done' ? 0 : 1))
  })
  it('edits fields and reports unknown ids / invalid input', async () => {
    const repo = createMemoryRepository(fixed)
    const [first] = await repo.listTasks()
    const saved = await repo.updateTask(first!.id, { title: 'Renamed', assigneeId: 'e6' })
    expect(saved).toMatchObject({ title: 'Renamed', assigneeId: 'e6' })
    await expect(repo.updateTask('nope', { title: 'x' })).rejects.toThrow(/not found/)
    await expect(repo.updateTask(first!.id, { title: '  ' })).rejects.toThrow(/Title/)
    await expect(repo.createTask({ ...valid, assigneeId: '' })).rejects.toThrow(/assignee/i)
  })
  it('keeps separate state per repository (nothing persisted)', async () => {
    const a = createMemoryRepository(fixed); await a.createTask(valid)
    const b = createMemoryRepository(fixed)
    expect((await b.listTasks()).length).toBe((await a.listTasks()).length - 1)
  })
})
