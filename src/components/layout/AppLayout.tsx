import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { CheckSquare, FolderKanban, LayoutDashboard, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label, NativeSelect } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { useTaskStore } from '@/state/TaskStore'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: false },
  { to: '/my-tasks', label: 'My Tasks', icon: CheckSquare, end: false },
]

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { employees, viewerId, setViewerId } = useTaskStore()
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <p className="text-lg font-bold text-primary">Nutrabay Tasks</p>
      <nav aria-label="Main">
        <ul className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted', isActive && 'bg-accent text-primary')
                }
              >
                <Icon className="h-4 w-4" aria-hidden /> {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto flex flex-col gap-1.5 rounded-md border border-border p-3">
        <Label htmlFor="demo-viewer">Demo persona</Label>
        <NativeSelect id="demo-viewer" value={viewerId} onChange={(e) => setViewerId(e.target.value)}>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">Picks whose tasks appear in My Tasks. There is no sign-in yet.</p>
      </div>
    </div>
  )
}

export function AppLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-2">Skip to content</a>
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:block">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <aside id="mobile-nav" className="absolute left-0 top-0 h-full w-72 bg-card shadow-lg">
            <Button variant="ghost" size="icon" className="absolute right-2 top-2" aria-label="Close menu" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" aria-hidden />
            </Button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div role="status" className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950">
          Demo — changes reset on refresh
        </div>
        <header className="flex items-center gap-2 border-b border-border bg-card p-2 md:hidden">
          <Button variant="ghost" size="icon" aria-label="Open menu" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" aria-hidden />
          </Button>
          <span className="font-bold text-primary">Nutrabay Tasks</span>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
