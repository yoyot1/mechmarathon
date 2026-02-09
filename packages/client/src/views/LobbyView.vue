<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLobbyStore } from '../stores/lobby';
import { useAuthStore } from '../stores/auth';
import { connectSocket } from '../lib/socket';

const route = useRoute();
const router = useRouter();
const lobby = useLobbyStore();
const auth = useAuthStore();

const lobbyId = computed(() => route.params.id as string);
const isHost = computed(() => lobby.currentLobby?.hostId === auth.user?.id);
const currentPlayer = computed(() =>
  lobby.currentLobby?.players.find((p) => p.userId === auth.user?.id),
);
const allNonHostReady = computed(() => {
  if (!lobby.currentLobby) return false;
  return lobby.currentLobby.players.every(
    (p) => p.userId === lobby.currentLobby!.hostId || p.ready,
  );
});
const canStart = computed(
  () => isHost.value && lobby.currentLobby && lobby.currentLobby.players.length >= 2 && allNonHostReady.value,
);

onMounted(async () => {
  const token = localStorage.getItem('mechmarathon_token');
  if (token) connectSocket(token);

  lobby.initSocketListeners();

  // First fetch the lobby via REST to get state
  await lobby.fetchLobby(lobbyId.value);

  // If we're not already a member, join via socket
  if (lobby.currentLobby && !lobby.currentLobby.players.some((p) => p.userId === auth.user?.id)) {
    await lobby.joinLobby(lobbyId.value);
  } else {
    // Already a member — just join the socket room
    await lobby.joinLobby(lobbyId.value);
  }
});

onUnmounted(() => {
  lobby.cleanupSocketListeners();
});

// Watch for game start
watch(
  () => lobby.currentLobby?.status,
  (status) => {
    if (status === 'in_progress') {
      router.push(`/game/${lobbyId.value}`);
    }
  },
);

async function handleReady() {
  await lobby.toggleReady(lobbyId.value);
}

async function handleStart() {
  const res = await lobby.startGame(lobbyId.value);
  if (res.error) {
    // Error is set in store
  }
}

async function handleLeave() {
  await lobby.leaveLobby(lobbyId.value);
  router.push('/lobby');
}
</script>

<template>
  <div class="lobby-view">
    <div v-if="lobby.loading && !lobby.currentLobby" class="loading">Loading lobby...</div>

    <div v-else-if="lobby.error && !lobby.currentLobby" class="error-page">
      <p class="error">{{ lobby.error }}</p>
      <RouterLink to="/lobby" class="btn btn-secondary">Back to Lobbies</RouterLink>
    </div>

    <template v-else-if="lobby.currentLobby">
      <header class="lobby-header">
        <div>
          <h2>{{ lobby.currentLobby.name }}</h2>
          <span class="lobby-meta">
            {{ lobby.currentLobby.players.length }}/{{ lobby.currentLobby.maxPlayers }} players
            &middot;
            {{ lobby.currentLobby.visibility }}
          </span>
        </div>
        <button class="btn btn-secondary btn-small" @click="handleLeave">Leave</button>
      </header>

      <p v-if="lobby.error" class="error">{{ lobby.error }}</p>

      <div class="player-list">
        <div
          v-for="p in lobby.currentLobby.players"
          :key="p.userId"
          class="player-card"
          :class="{ host: p.userId === lobby.currentLobby.hostId }"
        >
          <span class="player-color" :style="{ backgroundColor: p.color }" />
          <span class="player-name">
            {{ p.username }}
            <span v-if="p.userId === lobby.currentLobby.hostId" class="host-badge">HOST</span>
          </span>
          <span class="ready-status" :class="{ ready: p.ready || p.userId === lobby.currentLobby.hostId }">
            {{ p.userId === lobby.currentLobby.hostId ? 'Host' : p.ready ? 'Ready' : 'Not Ready' }}
          </span>
        </div>
      </div>

      <div class="actions">
        <button
          v-if="!isHost"
          class="btn"
          :class="{ 'btn-secondary': currentPlayer?.ready }"
          @click="handleReady"
        >
          {{ currentPlayer?.ready ? 'Unready' : 'Ready Up' }}
        </button>
        <button
          v-if="isHost"
          class="btn btn-start"
          :disabled="!canStart"
          @click="handleStart"
        >
          Start Game
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.lobby-view {
  padding: 2rem;
  max-width: 600px;
  margin: 0 auto;
}

.lobby-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.lobby-header h2 {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.lobby-meta {
  font-size: 0.85rem;
  color: #888;
}

.player-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.player-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #1a1a2e;
  border-radius: 0.5rem;
  border: 1px solid #222;
}

.player-card.host {
  border-color: #7b2ff7;
}

.player-color {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
}

.player-name {
  flex: 1;
  font-weight: 500;
}

.host-badge {
  font-size: 0.7rem;
  background: #7b2ff7;
  color: white;
  padding: 0.1rem 0.4rem;
  border-radius: 0.25rem;
  margin-left: 0.5rem;
  vertical-align: middle;
}

.ready-status {
  font-size: 0.85rem;
  color: #888;
}

.ready-status.ready {
  color: #2ecc71;
}

.actions {
  display: flex;
  gap: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  background: #7b2ff7;
  color: white;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
  transition: opacity 0.2s;
}

.btn:hover {
  opacity: 0.85;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
}

.btn-secondary {
  background: transparent;
  border: 2px solid #7b2ff7;
  color: #7b2ff7;
}

.btn-start {
  background: #2ecc71;
}

.btn-start:hover {
  opacity: 0.85;
}

.loading {
  text-align: center;
  padding: 4rem;
  color: #888;
}

.error-page {
  text-align: center;
  padding: 4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.error {
  color: #ff4444;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

a {
  text-decoration: none;
}
</style>
