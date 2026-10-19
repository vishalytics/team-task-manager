import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/ui/empty-state'

export default function NotFound() {
  return <EmptyState title="Page not found" description="That page does not exist." action={<Link className="text-primary underline" to="/">Go to dashboard</Link>} />
}
