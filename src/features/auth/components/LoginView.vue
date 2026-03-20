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
