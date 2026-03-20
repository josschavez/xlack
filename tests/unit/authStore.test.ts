import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the composable before store is imported
vi.mock('../../src/features/auth/composables/useAuth', () => ({
  useAuth: () => ({
    signIn: vi.fn().mockResolvedValue({ data: { user: { id: '1', email: 'a@b.com' } }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: { id: '1', email: 'a@b.com' } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  }),
}))

import { useAuthStore } from '../../src/features/auth/stores/authStore'

describe('authStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with no user', () => {
    const store = useAuthStore()
    expect(store.user).toBeNull()
  })

  it('sets user after login', async () => {
    const store = useAuthStore()
    await store.login('a@b.com', 'password')
    expect(store.user).not.toBeNull()
    expect(store.user?.email).toBe('a@b.com')
  })

  it('clears user after logout', async () => {
    const store = useAuthStore()
    await store.login('a@b.com', 'password')
    await store.logout()
    expect(store.user).toBeNull()
  })

  it('sets user after register with username', async () => {
    const store = useAuthStore()
    await store.register('a@b.com', 'password', 'josue')
    expect(store.user).not.toBeNull()
    expect(store.user?.email).toBe('a@b.com')
  })
})
