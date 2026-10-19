import { addDays, applyTaskUpdate, buildTask, computeDashboardCounts, DEFAULT_FILTERS, filterTasks, isOverdue, validateTaskInput } from './tasks'
import type { Task, TaskInput } from '@/types'

const TODAY = '2026-03-10'
const NOW = '2026-03-10T09:00:00.000Z'

const input = (o: Partial<TaskInput> = {}): TaskInput => ({
  projectId: 'p-it', title: 'Task', description: '', assigneeId: 'e1', priority: 'medium', dueDate: TODAY, status: 'todo', ...o,
})
const mk = (id: string, o: Partial<TaskInput> = {}): Task => buildTask(input(o), id, NOW)

describe('validateTaskInput', () => {
  it('accepts a valid task', () => expect(validateTaskInput(input())).toEqual({}))
  it('rejects blank title, missing assignee/project and bad date', () => {
    const e = validateTaskInput(input({ title: '   ', assigneeId: '', projectId: '', dueDate: '' }))
    expect(Object.keys(e).sort()).toEqual(['assigneeId', 'dueDate', 'projectId', 'title'])
  })
  it('rejects an impossible date', () => expect(validateTaskInput(input({ dueDate: '2026-13-45' })).dueDate).toBeDefined())
})

describe('task changes', () => {
  it('buildTask trims text and stamps times', () => {
    const t = buildTask(input({ title: '  Hello ', description: ' d ' }), 'x', NOW)
    expect(t).toMatchObject({ id: 'x', title: 'Hello', description: 'd', createdAt: NOW, updatedAt: NOW })
  })
  it('applyTaskUpdate changes only the target task, immutably', () => {
    const a = mk('a'); const b = mk('b')
    const list = [a, b]
    const out = applyTaskUpdate(list, 'a', { status: 'done', title: 'New' }, '2026-03-11T00:00:00.000Z')
    expect(out[0]).toMatchObject({ id: 'a', status: 'done', title: 'New', createdAt: NOW, updatedAt: '2026-03-11T00:00:00.000Z' })
    expect(out[1]).toBe(b)
    expect(list[0]).toBe(a)
    expect(a.status).toBe('todo')
  })
  it('applyTaskUpdate ignores unknown ids', () => {
    const list = [mk('a')]
    expect(applyTaskUpdate(list, 'nope', { status: 'done' }, NOW)).toEqual(list)
  })
})

describe('filterTasks', () => {
  const tasks = [
    mk('1', { title: 'Buy laptops', status: 'todo', priority: 'high', assigneeId: 'e1', projectId: 'p-it' }),
    mk('2', { title: 'Vendor call', description: 'laptop supplier', status: 'done', priority: 'low', assigneeId: 'e2', projectId: 'p-proc' }),
    mk('3', { title: 'Offer letters', status: 'in_progress', priority: 'high', assigneeId: 'e2', projectId: 'p-hr' }),
  ]
  const ids = (f: Partial<typeof DEFAULT_FILTERS>) => filterTasks(tasks, { ...DEFAULT_FILTERS, ...f }).map((t) => t.id)
  it('returns everything by default', () => expect(ids({})).toEqual(['1', '2', '3']))
  it('filters by status, priority, assignee, project', () => {
    expect(ids({ status: 'done' })).toEqual(['2'])
    expect(ids({ priority: 'high' })).toEqual(['1', '3'])
    expect(ids({ assigneeId: 'e2' })).toEqual(['2', '3'])
    expect(ids({ projectId: 'p-hr' })).toEqual(['3'])
  })
  it('searches title and description, case-insensitively', () => expect(ids({ search: 'LAPTOP' })).toEqual(['1', '2']))
  it('combines filters with AND', () => expect(ids({ priority: 'high', assigneeId: 'e2' })).toEqual(['3']))
  it('can return no results', () => expect(ids({ search: 'zzz' })).toEqual([]))
})

describe('computeDashboardCounts', () => {
  const tasks = [
    mk('1', { status: 'todo', dueDate: addDays(TODAY, -2), priority: 'high' }), // overdue, high open
    mk('2', { status: 'in_progress', dueDate: addDays(TODAY, 3), priority: 'high', projectId: 'p-hr' }), // this week, high open
    mk('3', { status: 'done', dueDate: addDays(TODAY, -5), priority: 'high' }), // done: never overdue / open
    mk('4', { status: 'todo', dueDate: addDays(TODAY, 7) }), // boundary: this week
    mk('5', { status: 'todo', dueDate: addDays(TODAY, 8) }), // later
    mk('6', { status: 'todo', dueDate: TODAY }), // due today: not overdue, this week
  ]
  const c = computeDashboardCounts(tasks, TODAY)
  it('counts by status', () => {
    expect(c.total).toBe(6)
    expect(c.byStatus).toEqual({ todo: 4, in_progress: 1, done: 1 })
  })
  it('counts overdue excluding done and due-today', () => expect(c.overdue).toBe(1))
  it('counts due in next 7 days inclusive of today and day 7', () => expect(c.dueThisWeek).toBe(3))
  it('counts open high priority only', () => expect(c.highPriorityOpen).toBe(2))
  it('counts per project', () => expect(c.byProject).toEqual({ 'p-it': { total: 5, done: 1 }, 'p-hr': { total: 1, done: 0 } }))
  it('handles an empty list', () => expect(computeDashboardCounts([], TODAY)).toMatchObject({ total: 0, overdue: 0, byStatus: { todo: 0, in_progress: 0, done: 0 } }))
  it('isOverdue ignores done tasks', () => expect(isOverdue(tasks[2]!, TODAY)).toBe(false))
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})
