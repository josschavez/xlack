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
  font-family: inherit;
}
textarea:focus { outline: none; border-color: #4f46e5; }
textarea:disabled { background: #f5f5f5; }
</style>
