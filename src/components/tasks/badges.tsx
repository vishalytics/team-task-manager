import { Badge } from '@/components/ui/badge'
import { PRIORITY_LABELS, STATUS_LABELS, type TaskPriority, type TaskStatus } from '@/types'

const STATUS_STYLE: Record<TaskStatus, string> = {
  todo: 'bg-slate-100 text-slate-800',
  in_progress: 'bg-blue-100 text-blue-900',
  done: 'bg-green-100 text-green-900',
}
const PRIORITY_STYLE: Record<TaskPriority, string> = {
  low: 'bg-slate-100 text-slate-800',
  medium: 'bg-amber-100 text-amber-900',
  high: 'bg-red-100 text-red-900',
}

export const StatusBadge = ({ status }: { status: TaskStatus }) => (
  <Badge className={STATUS_STYLE[status]}>{STATUS_LABELS[status]}</Badge>
)
export const PriorityBadge = ({ priority }: { priority: TaskPriority }) => (
  <Badge className={PRIORITY_STYLE[priority]}>{PRIORITY_LABELS[priority]} priority</Badge>
)
