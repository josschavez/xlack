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
      <span class="user-email">{{ auth.user?.email }}</span>
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
  flex-shrink: 0;
}
.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid #522653;
}
.workspace-name {
  font-weight: 700;
  color: white;
  font-size: 1rem;
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
  padding: 0;
}
.add-btn:hover { color: white; }
ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
li {
  padding: 0.3rem 1rem;
  cursor: pointer;
  font-size: 0.9rem;
  border-radius: 4px;
  margin: 0 0.5rem;
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
.user-email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
}
.sidebar-footer button {
  background: none;
  border: none;
  color: #cfc3cf;
  cursor: pointer;
  font-size: 0.8rem;
  flex-shrink: 0;
}
.sidebar-footer button:hover { color: white; }
</style>
