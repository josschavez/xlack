import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../auth/stores/authStore'

export function useMessages() {
  async function fetchByChannel(channelId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(username)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  }

  async function insert(content: string, channelId: string) {
    const auth = useAuthStore()
    const { error } = await supabase
      .from('messages')
      .insert({ content, channel_id: channelId, user_id: auth.user?.id })
    if (error) throw error
  }

  function subscribe(channelId: string, onInsert: (message: any) => void) {
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload) => onInsert(payload.new)
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }

  return { fetchByChannel, insert, subscribe }
}
