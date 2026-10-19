import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from '@/App'
import { createMemoryRepository } from '@/data/memoryRepository'
import { TaskStoreProvider } from '@/state/TaskStore'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <TaskStoreProvider repository={createMemoryRepository()}>
      <RouterProvider router={router} />
    </TaskStoreProvider>,
  )
}

describe('app', () => {
  it('shows the demo notice and sidebar links; no login implied', async () => {
    renderAt('/')
    expect(screen.getByText('Demo — changes reset on refresh')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const n of ['Dashboard', 'Projects', 'My Tasks']) expect(within(nav).getByRole('link', { name: n })).toBeInTheDocument()
    expect(screen.queryByText(/google/i)).toBeNull()
  })

  it('opens a nested route directly', async () => {
    renderAt('/projects/p-hr')
    expect(await screen.findByRole('heading', { name: 'HR Onboarding Revamp' })).toBeInTheDocument()
  })

  it('shows not-found for unknown project', async () => {
    renderAt('/projects/nope')
    expect(await screen.findByText('Project not found')).toBeInTheDocument()
  })

  it('creates a task with validation, then dashboard total increases', async () => {
    const user = userEvent.setup()
    renderAt('/projects/p-it')
    await screen.findByRole('heading', { name: 'IT Infrastructure Refresh' })
    await user.click(screen.getByRole('button', { name: /new task/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Create task' }))
    expect(within(dialog).getByText('Title is required.')).toBeInTheDocument()
    expect(within(dialog).getByText('Choose an assignee.')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Title'), 'Order monitors')
    await user.selectOptions(within(dialog).getByLabelText('Assignee'), 'Diya Kapoor')
    await user.click(within(dialog).getByRole('button', { name: 'Create task' }))
    expect(await screen.findByText('Order monitors')).toBeInTheDocument()
    expect(screen.getByText('Showing 5 of 5 tasks')).toBeInTheDocument()
  })

  it('changes status from the list and filters by status', async () => {
    const user = userEvent.setup()
    renderAt('/projects/p-it')
    const sel = await screen.findByLabelText('Status for Enable MFA for all staff accounts')
    await user.selectOptions(sel, 'Done')
    await user.selectOptions(screen.getByLabelText('Status'), 'Done')
    expect(screen.getByText('Showing 2 of 4 tasks')).toBeInTheDocument()
    expect(screen.getByText('Enable MFA for all staff accounts')).toBeInTheDocument()
  })

  it('board and list show the same tasks', async () => {
    const user = userEvent.setup()
    renderAt('/projects/p-proc')
    await screen.findByLabelText('Task list')
    const listTitles = within(screen.getByLabelText('Task list')).getAllByRole('listitem').length
    await user.click(screen.getByRole('button', { name: 'Board' }))
    const cols = ['To Do', 'In Progress', 'Done'].map((n) => within(screen.getByRole('region', { name: new RegExp(n) })).queryAllByRole('listitem').length)
    expect(cols.reduce((a, b) => a + b, 0)).toBe(listTitles)
  })

  it('shows a filter empty state with a way to clear it', async () => {
    const user = userEvent.setup()
    renderAt('/projects/p-it')
    await screen.findByLabelText('Task list')
    await user.type(screen.getByLabelText('Search'), 'zzzz')
    expect(screen.getByText('No tasks match these filters')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!)
    expect(screen.getByLabelText('Task list')).toBeInTheDocument()
  })

  it('My Tasks follows the demo persona and dashboard counts are derived', async () => {
    const user = userEvent.setup()
    renderAt('/my-tasks')
    expect(await screen.findByText('Enable MFA for all staff accounts')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Demo persona'), 'Rohan Desai')
    expect(await screen.findByText('Draft 30-60-90 day plan template')).toBeInTheDocument()
    expect(screen.queryByText('Enable MFA for all staff accounts')).toBeNull()
    await user.click(screen.getByRole('link', { name: 'Dashboard' }))
    const counts = within(await screen.findByLabelText('Task counts'))
    expect(counts.getByText('Total tasks').nextElementSibling).toHaveTextContent('12')
  })
})

describe('filters bar', () => {
  it('does not offer Clear filters until the user filters (page-locked project does not count)', async () => {
    const user = userEvent.setup()
    renderAt('/projects/p-it')
    await screen.findByLabelText('Task list')
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
    await user.selectOptions(screen.getByLabelText('Priority'), 'High')
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })
})
