import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUnsubscribe = vi.fn()
let capturedOnInsert: ((msg: any) => void) | null = null

vi.mock('../../src/features/messages/composables/useMessages', () => ({
  useMessages: () => ({
    fetchByChannel: vi.fn().mockResolvedValue([
      { id: '1', content: 'hola', channel_id: 'c1', user_id: 'u1', created_at: '' },
    ]),
    insert: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockImplementation((_channelId: string, onInsert: (msg: any) => void) => {
      capturedOnInsert = onInsert
      return mockUnsubscribe
    }),
  }),
}))

import { useMessageStore } from '../../src/features/messages/stores/messageStore'

describe('messageStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockUnsubscribe.mockClear()
    capturedOnInsert = null
  })

  it('starts empty', () => {
    const store = useMessageStore()
    expect(store.messages).toHaveLength(0)
    expect(store.loading).toBe(false)
  })

  it('fetches messages for a channel', async () => {
    const store = useMessageStore()
    await store.fetchMessages('c1')
    expect(store.messages).toHaveLength(1)
    expect(store.loading).toBe(false)
  })

  it('subscribes and unsubscribes', () => {
    const store = useMessageStore()
    store.subscribeToChannel('c1')
    store.unsubscribe()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('appends message when realtime INSERT callback fires', () => {
    const store = useMessageStore()
    store.subscribeToChannel('c1')
    capturedOnInsert!({ id: '2', content: 'mundo', channel_id: 'c1', user_id: 'u1', created_at: '' })
    expect(store.messages).toHaveLength(1)
    expect(store.messages[0].content).toBe('mundo')
  })
})
