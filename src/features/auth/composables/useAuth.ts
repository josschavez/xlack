import { supabase } from '../../../lib/supabase'

export function useAuth() {
  async function signIn(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signUp(email: string, password: string, username: string) {
    return supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
  }

  async function signOut() {
    return supabase.auth.signOut()
  }

  async function getSession() {
    return supabase.auth.getSession()
  }

  function onAuthStateChange(callback: (user: any) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null)
    })
  }

  return { signIn, signUp, signOut, getSession, onAuthStateChange }
}
