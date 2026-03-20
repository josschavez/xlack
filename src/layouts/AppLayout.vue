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
  font-size: 0.9rem;
}
</style>
