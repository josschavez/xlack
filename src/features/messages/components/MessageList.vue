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
  if (!ts) return ''
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
  font-size: 0.9rem;
}
.message {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.message.own .username { color: #4f46e5; }
.username {
  font-weight: 700;
  font-size: 0.9rem;
  color: #1d1c1d;
  flex-shrink: 0;
}
.content { flex: 1; word-break: break-word; }
.time {
  font-size: 0.75rem;
  color: #888;
  flex-shrink: 0;
}
</style>
