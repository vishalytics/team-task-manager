import { createMemoryRepository } from './memoryRepository'
import type { TaskRepository } from './taskRepository'

/**
 * Single place that chooses the data source. Always in-memory for now; a
 * Supabase-backed repository will be selected here once it exists
 * (see readSupabaseConfig in lib/supabaseConfig.ts).
 */
export function createRepository(): TaskRepository {
  return createMemoryRepository()
}
export type { TaskRepository }
