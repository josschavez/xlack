import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockMsgStore = {
  unsubscribe: vi.fn(),
  fetchMessages: vi.fn().mockResolvedValue(undefined),
  subscribeToChannel: vi.fn(),
}

vi.mock('../../src/features/channels/composables/useChannels', () => ({
  useChannels: () => ({
    fetchAll: vi.fn().mockResolvedValue([
      { id: '1', name: 'general', created_by: 'u1', created_at: '' },
      { id: '2', name: 'random', created_by: 'u1', created_at: '' },
    ]),
    insert: vi.fn().mockResolvedValue({ id: '3', name: 'nuevo', created_by: 'u1', created_at: '' }),
  }),
}))

vi.mock('../../src/features/messages/stores/messageStore', () => ({
  useMessageStore: () => mockMsgStore,
}))

import { useChannelStore } from '../../src/features/channels/stores/channelStore'

describe('channelStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('starts with no channels', () => {
    const store = useChannelStore()
    expect(store.channels).toHaveLength(0)
    expect(store.activeChannel).toBeNull()
  })

  it('fetches channels', async () => {
    const store = useChannelStore()
    await store.fetchChannels()
    expect(store.channels).toHaveLength(2)
  })

  it('setActive sets activeChannel and coordinates messageStore lifecycle', async () => {
    const store = useChannelStore()
    await store.fetchChannels()
    await store.setActive(store.channels[0])
    expect(store.activeChannel?.name).toBe('general')
    expect(mockMsgStore.unsubscribe).toHaveBeenCalled()
    expect(mockMsgStore.fetchMessages).toHaveBeenCalledWith('1')
    expect(mockMsgStore.subscribeToChannel).toHaveBeenCalledWith('1')
  })

  it('creates and selects a new channel', async () => {
    const store = useChannelStore()
    await store.create('nuevo')
    expect(store.channels).toHaveLength(1)
    expect(store.activeChannel?.name).toBe('nuevo')
  })
})
