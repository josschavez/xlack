# xlack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time messaging demo (xlack) with login/register, channel creation, and live message delivery using Vue 3, Pinia, and Supabase.

**Architecture:** Feature-based folder structure where composables own Supabase communication, Pinia stores hold reactive state, and Vue components only consume stores and dispatch actions. Realtime uses Supabase channel subscriptions filtered per active channel, with Realtime-only append (no optimistic updates).

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, Supabase JS SDK v2, Vue Router 4, Vitest, Vue Test Utils

---

## File Map

```
src/
  lib/
    supabase.ts                         ← Supabase singleton client
  features/
    auth/
      stores/authStore.ts               ← user state, login, register, logout, init
      composables/useAuth.ts            ← Supabase Auth calls
      components/LoginView.vue          ← Login + Register tabs
    channels/
      stores/channelStore.ts            ← channels list, activeChannel, setActive
      composables/useChannels.ts        ← Supabase DB calls for channels
      components/ChannelSidebar.vue     ← renders channel list + new channel button
      components/CreateChannelModal.vue ← modal with name input
    messages/
      stores/messageStore.ts            ← messages[], loading, send, subscribe
      composables/useMessages.ts        ← Supabase DB + Realtime calls
      components/MessageList.vue        ← renders messages, auto-scroll
      components/MessageInput.vue       ← text input + Enter to send
  layouts/
    AppLayout.vue                       ← sidebar + chat area layout
  router/
    index.ts                            ← /login + /app routes + auth guard

tests/
  unit/
    authStore.test.ts
    channelStore.test.ts
    messageStore.test.ts

netlify.toml
.env.example
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/App.vue`
- Create: `.env.example`
- Create: `netlify.toml`

- [ ] **Step 1: Scaffold Vite + Vue 3 + TypeScript project**

```bash
npm create vite@latest . -- --template vue-ts
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js pinia vue-router@4
npm install -D vitest @vue/test-utils @vitejs/plugin-vue jsdom @vitest/coverage-v8
```

- [ ] **Step 3: Configure Vitest in `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
```

- [ ] **Step 4: Create `.env.example`**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Copy to `.env.local` and fill in real values from your Supabase project settings.

- [ ] **Step 5: Create `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 6: Update `src/main.ts`**

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: scaffold Vue 3 + Vite + Pinia + Supabase project"
```

---

## Task 2: Supabase Database Setup

**Action:** Run these SQL statements in Supabase SQL Editor (Dashboard → SQL Editor).

- [ ] **Step 1: Create tables**

```sql
-- profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  created_at timestamp WITH TIME ZONE DEFAULT now()
);

-- channels table
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp WITH TIME ZONE DEFAULT now()
);

-- messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp WITH TIME ZONE DEFAULT now()
);
```

- [ ] **Step 2: Create profile auto-creation trigger**

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

- [ ] **Step 3: Enable Row Level Security**

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 4: Create RLS policies**

```sql
-- profiles
CREATE POLICY "profiles: authenticated can read"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles: user can update own"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- channels
CREATE POLICY "channels: authenticated can read"
  ON public.channels FOR SELECT TO authenticated USING (true);

CREATE POLICY "channels: authenticated can insert"
  ON public.channels FOR INSERT TO authenticated WITH CHECK (true);

-- messages
CREATE POLICY "messages: authenticated can read"
  ON public.messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "messages: authenticated can insert"
  ON public.messages FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "messages: author can delete"
  ON public.messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
```

- [ ] **Step 5: Enable Realtime on messages table**

In Supabase Dashboard → Database → Replication → enable `messages` table for realtime.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "docs: add Supabase SQL setup instructions"
```

---

## Task 3: Supabase Client

**Files:**
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Create the Supabase singleton**

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add Supabase singleton client"
```

---

## Task 4: Auth Composable + Store

**Files:**
- Create: `src/features/auth/composables/useAuth.ts`
- Create: `src/features/auth/stores/authStore.ts`
- Create: `tests/unit/authStore.test.ts`

- [ ] **Step 1: Write the failing store test**

```ts
// tests/unit/authStore.test.ts
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the composable before store is imported
vi.mock('../../src/features/auth/composables/useAuth', () => ({
  useAuth: () => ({
    signIn: vi.fn().mockResolvedValue({ data: { user: { id: '1', email: 'a@b.com' } }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: { id: '1', email: 'a@b.com' } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/authStore.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `useAuth` composable**

```ts
// src/features/auth/composables/useAuth.ts
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
```

- [ ] **Step 4: Create `authStore`**

```ts
// src/features/auth/stores/authStore.ts
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/unit/authStore.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/features/auth/ tests/unit/authStore.test.ts
git commit -m "feat: add auth composable and Pinia store with tests"
```

---

## Task 5: Router with Auth Guard

**Files:**
- Create: `src/router/index.ts`

- [ ] **Step 1: Create router**

```ts
// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../features/auth/stores/authStore'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('../features/auth/components/LoginView.vue'),
    },
    {
      path: '/app',
      component: () => import('../layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/',
      redirect: '/app',
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.user) {
    return '/login'
  }
  if (to.path === '/login' && auth.user) {
    return '/app'
  }
})

export default router
```

- [ ] **Step 2: Call `authStore.init()` before mount in `src/main.ts`**

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './features/auth/stores/authStore'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const auth = useAuthStore()
auth.init().then(() => {
  app.mount('#app')
})
```

- [ ] **Step 3: Commit**

```bash
git add src/router/ src/main.ts
git commit -m "feat: add router with auth guard"
```

---

## Task 6: LoginView Component

**Files:**
- Create: `src/features/auth/components/LoginView.vue`

- [ ] **Step 1: Create `LoginView.vue`**

```vue
<!-- src/features/auth/components/LoginView.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const auth = useAuthStore()

const tab = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const username = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    if (tab.value === 'login') {
      await auth.login(email.value, password.value)
    } else {
      await auth.register(email.value, password.value, username.value)
    }
    router.push('/app')
  } catch (e: any) {
    error.value = e.message ?? 'Error al autenticar'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <h1>xlack</h1>

    <div class="tabs">
      <button :class="{ active: tab === 'login' }" @click="tab = 'login'">Entrar</button>
      <button :class="{ active: tab === 'register' }" @click="tab = 'register'">Registrarse</button>
    </div>

    <form @submit.prevent="submit">
      <input v-model="email" type="email" placeholder="Email" required />
      <input v-if="tab === 'register'" v-model="username" type="text" placeholder="Nombre de usuario" required />
      <input v-model="password" type="password" placeholder="Contraseña" required />
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading">
        {{ loading ? 'Cargando...' : tab === 'login' ? 'Entrar' : 'Crear cuenta' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 1rem;
}
form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 320px;
}
input {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
button[type="submit"] {
  padding: 0.5rem;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
button[type="submit"]:disabled {
  opacity: 0.5;
}
.tabs {
  display: flex;
  gap: 0.5rem;
}
.tabs button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  background: white;
}
.tabs button.active {
  background: #4f46e5;
  color: white;
  border-color: #4f46e5;
}
.error {
  color: red;
  font-size: 0.875rem;
}
</style>
```

- [ ] **Step 2: Manually test in browser**

Run `npm run dev`, navigate to `http://localhost:5173/login`. Verify login and register tabs render. Auth flow will work once Supabase env vars are configured.

- [ ] **Step 3: Commit**

```bash
git add src/features/auth/components/LoginView.vue
git commit -m "feat: add LoginView with login and register tabs"
```

---

## Task 7: Channel Composable + Store

**Files:**
- Create: `src/features/channels/composables/useChannels.ts`
- Create: `src/features/channels/stores/channelStore.ts`
- Create: `tests/unit/channelStore.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/channelStore.test.ts
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
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/unit/channelStore.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create `useChannels` composable**

```ts
// src/features/channels/composables/useChannels.ts
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
```

- [ ] **Step 4: Create `channelStore`**

```ts
// src/features/channels/stores/channelStore.ts
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
  // unsubscribe from previous channel, fetch new messages, subscribe to new channel.
  // useMessageStore() is called lazily inside to avoid circular import at module load time.
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
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/unit/channelStore.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/features/channels/ tests/unit/channelStore.test.ts
git commit -m "feat: add channels composable and store with tests"
```

---

## Task 8: Message Composable + Store

**Files:**
- Create: `src/features/messages/composables/useMessages.ts`
- Create: `src/features/messages/stores/messageStore.ts`
- Create: `tests/unit/messageStore.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/messageStore.test.ts
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
    // simulate the Supabase Realtime INSERT event arriving
    capturedOnInsert!({ id: '2', content: 'mundo', channel_id: 'c1', user_id: 'u1', created_at: '' })
    expect(store.messages).toHaveLength(1)
    expect(store.messages[0].content).toBe('mundo')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/unit/messageStore.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create `useMessages` composable**

```ts
// src/features/messages/composables/useMessages.ts
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
```

- [ ] **Step 4: Create `messageStore`**

```ts
// src/features/messages/stores/messageStore.ts
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
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/unit/messageStore.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/features/messages/ tests/unit/messageStore.test.ts
git commit -m "feat: add messages composable and store with realtime support"
```

---

## Task 9: Channel Components

**Files:**
- Create: `src/features/channels/components/ChannelSidebar.vue`
- Create: `src/features/channels/components/CreateChannelModal.vue`

- [ ] **Step 1: Create `CreateChannelModal.vue`**

```vue
<!-- src/features/channels/components/CreateChannelModal.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useChannelStore } from '../stores/channelStore'

const emit = defineEmits<{ close: [] }>()
const channels = useChannelStore()

const name = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  if (!name.value.trim()) return
  error.value = ''
  loading.value = true
  try {
    await channels.create(name.value.trim())
    emit('close')
  } catch (e: any) {
    error.value = e.message ?? 'Error al crear canal'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <h3>Nuevo canal</h3>
      <form @submit.prevent="submit">
        <input v-model="name" type="text" placeholder="nombre-del-canal" autofocus />
        <p v-if="error" class="error">{{ error }}</p>
        <div class="actions">
          <button type="button" @click="emit('close')">Cancelar</button>
          <button type="submit" :disabled="loading">
            {{ loading ? 'Creando...' : 'Crear' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}
.actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
button {
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid #ccc;
}
button[type="submit"] {
  background: #4f46e5;
  color: white;
  border-color: #4f46e5;
}
.error { color: red; font-size: 0.875rem; }
</style>
```

- [ ] **Step 2: Create `ChannelSidebar.vue`**

```vue
<!-- src/features/channels/components/ChannelSidebar.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useChannelStore } from '../stores/channelStore'
import { useAuthStore } from '../../auth/stores/authStore'
import CreateChannelModal from './CreateChannelModal.vue'

const channels = useChannelStore()
const auth = useAuthStore()
const showModal = ref(false)
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <span class="workspace-name">xlack</span>
    </div>

    <div class="section">
      <div class="section-header">
        <span>Canales</span>
        <button class="add-btn" @click="showModal = true" title="Nuevo canal">+</button>
      </div>
      <ul>
        <li
          v-for="channel in channels.channels"
          :key="channel.id"
          :class="{ active: channels.activeChannel?.id === channel.id }"
          @click="channels.setActive(channel)"
        >
          # {{ channel.name }}
        </li>
      </ul>
    </div>

    <div class="sidebar-footer">
      <span>{{ auth.user?.email }}</span>
      <button @click="auth.logout()">Salir</button>
    </div>

    <CreateChannelModal v-if="showModal" @close="showModal = false" />
  </aside>
</template>

<style scoped>
.sidebar {
  width: 240px;
  background: #3f0e40;
  color: #cfc3cf;
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid #522653;
}
.workspace-name {
  font-weight: 700;
  color: white;
}
.section {
  padding: 1rem 0;
  flex: 1;
  overflow-y: auto;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1rem;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
}
.add-btn {
  background: none;
  border: none;
  color: #cfc3cf;
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
li {
  padding: 0.25rem 1rem;
  cursor: pointer;
  font-size: 0.9rem;
}
li:hover, li.active {
  background: #1164a3;
  color: white;
}
.sidebar-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid #522653;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
}
.sidebar-footer button {
  background: none;
  border: none;
  color: #cfc3cf;
  cursor: pointer;
  font-size: 0.8rem;
}
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/features/channels/components/
git commit -m "feat: add ChannelSidebar and CreateChannelModal components"
```

---

## Task 10: Message Components

**Files:**
- Create: `src/features/messages/components/MessageList.vue`
- Create: `src/features/messages/components/MessageInput.vue`

- [ ] **Step 1: Create `MessageList.vue`**

```vue
<!-- src/features/messages/components/MessageList.vue -->
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useMessageStore } from '../stores/messageStore'
import { useAuthStore } from '../../auth/stores/authStore'

const messages = useMessageStore()
const auth = useAuthStore()
const listRef = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight
    }
  })
}

watch(() => messages.messages.length, scrollToBottom)

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="message-list" ref="listRef">
    <div v-if="messages.loading" class="status">Cargando mensajes...</div>
    <div v-else-if="messages.messages.length === 0" class="status">
      No hay mensajes aún. ¡Sé el primero!
    </div>
    <div
      v-for="msg in messages.messages"
      :key="msg.id"
      class="message"
      :class="{ own: msg.user_id === auth.user?.id }"
    >
      <span class="username">{{ msg.profiles?.username ?? 'Usuario' }}</span>
      <span class="content">{{ msg.content }}</span>
      <span class="time">{{ formatTime(msg.created_at) }}</span>
    </div>
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.status {
  color: #888;
  text-align: center;
  margin-top: 2rem;
}
.message {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.username {
  font-weight: 700;
  font-size: 0.9rem;
  color: #1d1c1d;
  flex-shrink: 0;
}
.content {
  flex: 1;
}
.time {
  font-size: 0.75rem;
  color: #888;
  flex-shrink: 0;
}
</style>
```

- [ ] **Step 2: Create `MessageInput.vue`**

```vue
<!-- src/features/messages/components/MessageInput.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useMessageStore } from '../stores/messageStore'
import { useChannelStore } from '../../channels/stores/channelStore'

const messages = useMessageStore()
const channels = useChannelStore()
const content = ref('')

async function send() {
  const text = content.value.trim()
  if (!text || !channels.activeChannel) return
  content.value = ''
  await messages.send(text, channels.activeChannel.id)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}
</script>

<template>
  <div class="input-bar">
    <textarea
      v-model="content"
      :placeholder="channels.activeChannel ? `Mensaje en #${channels.activeChannel.name}` : 'Selecciona un canal'"
      :disabled="!channels.activeChannel"
      rows="1"
      @keydown="onKeydown"
    />
  </div>
</template>

<style scoped>
.input-bar {
  padding: 0 1rem 1rem;
}
textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  resize: none;
  font-size: 1rem;
  box-sizing: border-box;
}
textarea:disabled {
  background: #f5f5f5;
}
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/features/messages/components/
git commit -m "feat: add MessageList and MessageInput components"
```

---

## Task 11: AppLayout — Wire Everything Together

**Files:**
- Create: `src/layouts/AppLayout.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Create `AppLayout.vue`**

```vue
<!-- src/layouts/AppLayout.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useChannelStore } from '../features/channels/stores/channelStore'
import ChannelSidebar from '../features/channels/components/ChannelSidebar.vue'
import MessageList from '../features/messages/components/MessageList.vue'
import MessageInput from '../features/messages/components/MessageInput.vue'

const channels = useChannelStore()

// setActive() in channelStore handles the full messageStore lifecycle internally.
// AppLayout only needs to auto-select the first channel on mount.
onMounted(async () => {
  await channels.fetchChannels()
  if (channels.channels.length > 0) {
    await channels.setActive(channels.channels[0])
  }
})
</script>

<template>
  <div class="layout">
    <ChannelSidebar />
    <main class="chat-area">
      <header v-if="channels.activeChannel" class="chat-header">
        # {{ channels.activeChannel.name }}
      </header>
      <div v-else class="no-channel">Selecciona o crea un canal</div>
      <MessageList />
      <MessageInput />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.chat-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e0e0e0;
  font-weight: 700;
  font-size: 1rem;
}
.no-channel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
}
</style>
```

- [ ] **Step 2: Simplify `src/App.vue`**

```vue
<!-- src/App.vue -->
<script setup lang="ts">
</script>

<template>
  <RouterView />
</template>
```

- [ ] **Step 3: Add global reset styles in `src/main.ts` or `index.html`**

Add to `index.html` in `<head>`:
```html
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
</style>
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS

- [ ] **Step 5: Run dev server and do full manual test**

```bash
npm run dev
```

Test checklist:
- [ ] Navegas a `/` → redirige a `/login`
- [ ] Te registras con email + username + password → entras a `/app`
- [ ] Ves el sidebar con "xlack" y sección Canales
- [ ] Haces click en `+` → aparece modal
- [ ] Creas canal "test" → aparece en sidebar y se selecciona
- [ ] Escribes mensaje + Enter → aparece en la lista
- [ ] Abres otra pestaña con la misma cuenta → el mensaje aparece en tiempo real

- [ ] **Step 6: Commit**

```bash
git add src/layouts/ src/App.vue index.html
git commit -m "feat: add AppLayout, wire stores and realtime lifecycle"
```

---

## Task 12: Build and Deploy to Netlify

- [ ] **Step 1: Set environment variables in Netlify BEFORE building**

Las variables de Vite se inyectan en el bundle en tiempo de build — si no están presentes al compilar, el bundle tendrá `undefined` y el app fallará silenciosamente en producción.

```bash
# Instala Netlify CLI si no lo tienes
npm install -g netlify-cli

# Conecta el proyecto a Netlify (primera vez)
netlify init
```

Luego en el dashboard de Netlify → Site Settings → Environment Variables, agrega:
- `VITE_SUPABASE_URL` — tu URL de Supabase
- `VITE_SUPABASE_ANON_KEY` — tu anon key de Supabase

- [ ] **Step 2: Build production bundle**

```bash
npm run build
```

Expected: `dist/` folder created with no errors. Verifica que `dist/assets/*.js` contenga tu Supabase URL (confirma que las vars fueron inyectadas).

- [ ] **Step 3: Deploy a Netlify**

```bash
netlify deploy --prod --dir=dist
```

- [ ] **Step 4: Verify production deploy**

Abre la URL de Netlify y ejecuta el mismo test checklist del Task 11 Step 5.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "chore: production build verified and deployed to Netlify"
```
