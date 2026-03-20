import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useChannels } from '../composables/useChannels'

interface Channel {
  id: string
  name: string
  created_by: string
  created_at: string
}

export const useChannelStore = defineStore('channels', () => {
  const channels = ref<Channel[]>([])
  const activeChannel = ref<Channel | null>(null)
  const { fetchAll, insert } = useChannels()

  async function fetchChannels() {
    channels.value = await fetchAll()
  }

  // setActive coordinates the full messageStore lifecycle:
  // unsubscribe → fetch → subscribe. useMessageStore() is called lazily
  // inside to avoid circular import at module load time.
  async function setActive(channel: Channel) {
    activeChannel.value = channel
    const { useMessageStore } = await import('../../messages/stores/messageStore')
    const msgs = useMessageStore()
    msgs.unsubscribe()
    await msgs.fetchMessages(channel.id)
    msgs.subscribeToChannel(channel.id)
  }

  async function create(name: string) {
    const channel = await insert(name)
    channels.value.push(channel)
    await setActive(channel)
  }

  return { channels, activeChannel, fetchChannels, setActive, create }
})
