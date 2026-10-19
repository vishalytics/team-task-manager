import { readSupabaseConfig } from './supabaseConfig'

describe('readSupabaseConfig', () => {
  it('is null when variables are missing or blank', () => {
    expect(readSupabaseConfig({})).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' })).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull()
  })
  it('returns both values when set', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: ' https://x.supabase.co ', VITE_SUPABASE_PUBLISHABLE_KEY: 'pk' })).toEqual({ url: 'https://x.supabase.co', publishableKey: 'pk' })
  })
})
