import { useState } from 'react'
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import MyTasks from '@/pages/MyTasks'
import NotFound from '@/pages/NotFound'
import ProjectDetail from '@/pages/ProjectDetail'
import Projects from '@/pages/Projects'

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/projects', element: <Projects /> },
      { path: '/projects/:projectId', element: <ProjectDetail /> },
      { path: '/my-tasks', element: <MyTasks /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]

export default function App() {
  const [router] = useState(() => createBrowserRouter(routes))
  return <RouterProvider router={router} />
}
