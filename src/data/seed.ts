import type { Employee, Project, Task, TaskInput } from '@/types'
import { addDays, buildTask } from '@/lib/tasks'

/** Fictional people only. */
export const EMPLOYEES: Employee[] = [
  { id: 'e1', name: 'Aarav Mehta', role: 'IT Lead' },
  { id: 'e2', name: 'Diya Kapoor', role: 'Systems Engineer' },
  { id: 'e3', name: 'Kabir Nair', role: 'Procurement Manager' },
  { id: 'e4', name: 'Meera Iyer', role: 'Vendor Analyst' },
  { id: 'e5', name: 'Rohan Desai', role: 'HR Business Partner' },
  { id: 'e6', name: 'Sana Qureshi', role: 'Talent Acquisition' },
]

export const PROJECTS: Project[] = [
  { id: 'p-it', name: 'IT Infrastructure Refresh', department: 'IT', description: 'Laptops, access management and office network upgrades.' },
  { id: 'p-proc', name: 'Procurement Vendor Consolidation', department: 'Procurement', description: 'Reduce vendor count and renegotiate contracts.' },
  { id: 'p-hr', name: 'HR Onboarding Revamp', department: 'HR', description: 'Smoother first 30 days for new joiners.' },
]

type Seed = Omit<TaskInput, 'dueDate'> & { dueInDays: number }

const SEEDS: Seed[] = [
  { projectId: 'p-it', title: 'Audit laptop inventory', description: 'Reconcile asset register with devices in use.', assigneeId: 'e2', priority: 'medium', dueInDays: -3, status: 'in_progress' },
  { projectId: 'p-it', title: 'Enable MFA for all staff accounts', description: 'Roll out multi-factor authentication in phases.', assigneeId: 'e1', priority: 'high', dueInDays: 4, status: 'todo' },
  { projectId: 'p-it', title: 'Replace warehouse Wi-Fi access points', description: 'Survey coverage and swap end-of-life hardware.', assigneeId: 'e2', priority: 'low', dueInDays: 21, status: 'todo' },
  { projectId: 'p-it', title: 'Document backup and restore runbook', description: 'Write and test the restore procedure.', assigneeId: 'e1', priority: 'medium', dueInDays: -10, status: 'done' },
  { projectId: 'p-proc', title: 'Shortlist packaging suppliers', description: 'Compare three suppliers on price and lead time.', assigneeId: 'e3', priority: 'high', dueInDays: 2, status: 'in_progress' },
  { projectId: 'p-proc', title: 'Renegotiate logistics contract', description: 'Target a better rate card for the next year.', assigneeId: 'e4', priority: 'high', dueInDays: -1, status: 'todo' },
  { projectId: 'p-proc', title: 'Publish vendor onboarding checklist', description: 'Standard documents required from new vendors.', assigneeId: 'e4', priority: 'low', dueInDays: 14, status: 'todo' },
  { projectId: 'p-proc', title: 'Close out Q2 purchase orders', description: 'Archive and reconcile completed orders.', assigneeId: 'e3', priority: 'medium', dueInDays: -6, status: 'done' },
  { projectId: 'p-hr', title: 'Draft 30-60-90 day plan template', description: 'One template reusable across departments.', assigneeId: 'e5', priority: 'medium', dueInDays: 6, status: 'in_progress' },
  { projectId: 'p-hr', title: 'Schedule new-joiner buddy pairing', description: 'Match each joiner with a buddy in week one.', assigneeId: 'e6', priority: 'medium', dueInDays: 9, status: 'todo' },
  { projectId: 'p-hr', title: 'Collect onboarding feedback survey', description: 'Short survey after day 30.', assigneeId: 'e5', priority: 'low', dueInDays: -2, status: 'done' },
  { projectId: 'p-hr', title: 'Update offer letter template', description: 'Align wording with the latest policy.', assigneeId: 'e6', priority: 'high', dueInDays: 1, status: 'todo' },
]

/** Builds demo tasks with due dates relative to `today` so the demo always looks current. */
export function createSeedTasks(today: string, nowIso: string): Task[] {
  return SEEDS.map(({ dueInDays, ...rest }, i) =>
    buildTask({ ...rest, dueDate: addDays(today, dueInDays) }, `t${i + 1}`, nowIso),
  )
}
