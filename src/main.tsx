import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { createRepository } from './data'
import { TaskStoreProvider } from './state/TaskStore'

// Created once at module load so the in-memory data survives re-renders.
const repository = createRepository()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TaskStoreProvider repository={repository}>
      <App />
    </TaskStoreProvider>
  </StrictMode>,
)
