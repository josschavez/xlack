import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useMessages } from '../composables/useMessages'

interface Message {
  id: string
  content: string
  channel_id: string
  user_id: string
  created_at: string
  profiles?: { username: string }
}

export const useMessageStore = defineStore('messages', () => {
  const messages = ref<Message[]>([])
  const loading = ref(false)
  let _unsubscribe: (() => void) | null = null

  const { fetchByChannel, insert, subscribe } = useMessages()

  async function fetchMessages(channelId: string) {
    loading.value = true
    messages.value = []
    try {
      messages.value = await fetchByChannel(channelId)
    } finally {
      loading.value = false
    }
  }

  async function send(content: string, channelId: string) {
    await insert(content, channelId)
    // no optimistic append — message arrives via Realtime
  }

  function subscribeToChannel(channelId: string) {
    _unsubscribe = subscribe(channelId, (message: Message) => {
      messages.value.push(message)
    })
  }

  function unsubscribe() {
    _unsubscribe?.()
    _unsubscribe = null
  }

  return { messages, loading, fetchMessages, send, subscribeToChannel, unsubscribe }
})
