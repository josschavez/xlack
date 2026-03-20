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
  z-index: 100;
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
  background: white;
}
button[type="submit"] {
  background: #4f46e5;
  color: white;
  border-color: #4f46e5;
}
button[type="submit"]:disabled { opacity: 0.5; }
.error { color: red; font-size: 0.875rem; }
</style>
