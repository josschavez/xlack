import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../auth/stores/authStore'

export function useChannels() {
  async function fetchAll() {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  }

  async function insert(name: string) {
    const auth = useAuthStore()
    const { data, error } = await supabase
      .from('channels')
      .insert({ name, created_by: auth.user?.id })
      .select()
      .single()
    if (error) throw error
    return data
  }

  return { fetchAll, insert }
}
