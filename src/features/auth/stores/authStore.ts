import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { useAuth } from '../composables/useAuth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const { signIn, signUp, signOut, getSession, onAuthStateChange } = useAuth()

  async function login(email: string, password: string) {
    const { data, error } = await signIn(email, password)
    if (error) throw error
    user.value = data.user
  }

  async function register(email: string, password: string, username: string) {
    const { data, error } = await signUp(email, password, username)
    if (error) throw error
    user.value = data.user
  }

  async function logout() {
    const { error } = await signOut()
    if (error) throw error
    user.value = null
  }

  async function init() {
    const { data } = await getSession()
    user.value = data.session?.user ?? null

    onAuthStateChange((newUser) => {
      user.value = newUser
    })
  }

  return { user, login, register, logout, init }
})
