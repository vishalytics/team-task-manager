import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { DialogContent } from '@/components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field'
import { toIsoDate, validateTaskInput, type TaskInputErrors } from '@/lib/tasks'
import { useTaskStore } from '@/state/TaskStore'
import {
  PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES,
  type Task, type TaskInput,
} from '@/types'

export function TaskDialogContent({ task, defaultProjectId, onDone }: { task?: Task; defaultProjectId?: string; onDone: () => void }) {
  const { projects, employees, createTask, updateTask } = useTaskStore()
  const [values, setValues] = useState<TaskInput>(() => ({
    projectId: task?.projectId ?? defaultProjectId ?? projects[0]?.id ?? '',
    title: task?.title ?? '',
    description: task?.description ?? '',
    assigneeId: task?.assigneeId ?? '',
    priority: task?.priority ?? 'medium',
    dueDate: task?.dueDate ?? toIsoDate(new Date()),
    status: task?.status ?? 'todo',
  }))
  const [errors, setErrors] = useState<TaskInputErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const set = <K extends keyof TaskInput>(k: K, v: TaskInput[K]) => setValues((p) => ({ ...p, [k]: v }))
  const idp = task ? `edit-${task.id}` : 'new-task'

  async function submit(e: FormEvent) {
    e.preventDefault()
    const found = validateTaskInput(values)
    setErrors(found)
    if (Object.keys(found).length) return
    try {
      if (task) await updateTask(task.id, values)
      else await createTask(values)
      onDone()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the task.')
    }
  }

  return (
    <DialogContent
      title={task ? 'Edit task' : 'New task'}
      description="Demo data only - changes are kept in memory and reset on refresh."
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field id={`${idp}-title`} label="Title" error={errors.title}>
          {(p) => <Input {...p} required maxLength={200} value={values.title} onChange={(e) => set('title', e.target.value)} />}
        </Field>
        <Field id={`${idp}-desc`} label="Description">
          {(p) => <Textarea {...p} value={values.description} onChange={(e) => set('description', e.target.value)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${idp}-project`} label="Project" error={errors.projectId}>
            {(p) => (
              <NativeSelect {...p} value={values.projectId} onChange={(e) => set('projectId', e.target.value)}>
                {projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
              </NativeSelect>
            )}
          </Field>
          <Field id={`${idp}-assignee`} label="Assignee" error={errors.assigneeId}>
            {(p) => (
              <NativeSelect {...p} value={values.assigneeId} onChange={(e) => set('assigneeId', e.target.value)}>
                <option value="">Select an assignee</option>
                {employees.map((em) => <option key={em.id} value={em.id}>{em.name}</option>)}
              </NativeSelect>
            )}
          </Field>
          <Field id={`${idp}-priority`} label="Priority">
            {(p) => (
              <NativeSelect {...p} value={values.priority} onChange={(e) => set('priority', e.target.value as TaskInput['priority'])}>
                {TASK_PRIORITIES.map((x) => <option key={x} value={x}>{PRIORITY_LABELS[x]}</option>)}
              </NativeSelect>
            )}
          </Field>
          <Field id={`${idp}-status`} label="Status">
            {(p) => (
              <NativeSelect {...p} value={values.status} onChange={(e) => set('status', e.target.value as TaskInput['status'])}>
                {TASK_STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABELS[x]}</option>)}
              </NativeSelect>
            )}
          </Field>
          <Field id={`${idp}-due`} label="Due date" error={errors.dueDate}>
            {(p) => <Input {...p} type="date" value={values.dueDate} onChange={(e) => set('dueDate', e.target.value)} />}
          </Field>
        </div>
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
          <Button type="submit">{task ? 'Save changes' : 'Create task'}</Button>
        </div>
      </form>
    </DialogContent>
  )
}
