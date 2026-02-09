<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { GAME, LOBBY } from '@mechmarathon/shared';
import type { LobbyVisibility } from '@mechmarathon/shared';
import { useLobbyStore } from '../stores/lobby';
import { useAuthStore } from '../stores/auth';
import { connectSocket } from '../lib/socket';

const router = useRouter();
const lobby = useLobbyStore();
const auth = useAuthStore();

const showCreateForm = ref(false);
const lobbyName = ref('');
const visibility = ref<LobbyVisibility>('public');
const maxPlayers = ref(4);

onMounted(() => {
  const token = localStorage.getItem('mechmarathon_token');
  if (token) connectSocket(token);
  lobby.fetchLobbies();
});

// Note: don't disconnect socket here — it stays alive for the whole session.
// Disconnecting would trigger server-side disconnect handler and remove player from lobby.

async function handleCreate() {
  const result = await lobby.createLobby({
    name: lobbyName.value,
    visibility: visibility.value,
    maxPlayers: maxPlayers.value,
  });
  if (result) {
    router.push(`/lobby/${result.id}`);
  }
}

async function handleJoin(lobbyId: string) {
  const token = localStorage.getItem('mechmarathon_token');
  if (token) connectSocket(token);

  lobby.initSocketListeners();
  const res = await lobby.joinLobby(lobbyId);
  if (!res.error) {
    router.push(`/lobby/${lobbyId}`);
  }
}

function handleLogout() {
  auth.logout();
  router.push('/');
}
</script>

<template>
  <div class="lobby-list">
    <header class="top-bar">
      <h1>MechMarathon</h1>
      <div class="user-info">
        <span>{{ auth.user?.username }}</span>
        <button class="btn btn-small btn-secondary" @click="handleLogout">Logout</button>
      </div>
    </header>

    <div class="content">
      <div class="toolbar">
        <h2>Game Lobbies</h2>
        <button class="btn" @click="showCreateForm = !showCreateForm">
          {{ showCreateForm ? 'Cancel' : 'Create Game' }}
        </button>
      </div>

      <form v-if="showCreateForm" class="create-form" @submit.prevent="handleCreate">
        <input
          v-model="lobbyName"
          type="text"
          placeholder="Lobby name"
          :minlength="LOBBY.NAME_MIN_LENGTH"
          :maxlength="LOBBY.NAME_MAX_LENGTH"
          required
        />
        <div class="form-row">
          <label>
            Visibility
            <select v-model="visibility">
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label>
            Max players
            <select v-model.number="maxPlayers">
              <option v-for="n in (GAME.MAX_PLAYERS - GAME.MIN_PLAYERS + 1)" :key="n" :value="n + GAME.MIN_PLAYERS - 1">
                {{ n + GAME.MIN_PLAYERS - 1 }}
              </option>
            </select>
          </label>
        </div>
        <button type="submit" class="btn" :disabled="lobby.loading">
          {{ lobby.loading ? 'Creating...' : 'Create Lobby' }}
        </button>
      </form>

      <p v-if="lobby.error" class="error">{{ lobby.error }}</p>

      <div v-if="lobby.loading && !showCreateForm" class="loading">Loading lobbies...</div>

      <div v-else-if="lobby.lobbies.length === 0" class="empty">
        <p>No games available. Create one to get started!</p>
      </div>

      <div v-else class="lobbies">
        <div v-for="l in lobby.lobbies" :key="l.id" class="lobby-card">
          <div class="lobby-info">
            <h3>{{ l.name }}</h3>
            <span class="player-count">{{ l.players.length }}/{{ l.maxPlayers }} players</span>
          </div>
          <div class="lobby-players">
            <span
              v-for="p in l.players"
              :key="p.userId"
              class="player-dot"
              :style="{ backgroundColor: p.color }"
              :title="p.username"
            />
          </div>
          <button class="btn btn-small" @click="handleJoin(l.id)">Join</button>
        </div>
      </div>

      <button class="btn btn-secondary btn-small refresh-btn" @click="lobby.fetchLobbies()">
        Refresh
      </button>
    </div>
  </div>
</template>

<style scoped>
.lobby-list {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  border-bottom: 1px solid #222;
}

.top-bar h1 {
  font-size: 1.5rem;
  background: linear-gradient(135deg, #00d4ff, #7b2ff7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: #999;
}

.content {
  padding: 2rem;
  max-width: 700px;
  margin: 0 auto;
  width: 100%;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  background: #1a1a2e;
  border-radius: 0.75rem;
  margin-bottom: 1.5rem;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-row label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: #999;
}

input,
select {
  padding: 0.75rem;
  border: 1px solid #333;
  border-radius: 0.5rem;
  background: #0f0f23;
  color: #e0e0e0;
  font-size: 1rem;
}

.lobbies {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.lobby-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: #1a1a2e;
  border-radius: 0.75rem;
  border: 1px solid #222;
}

.lobby-info {
  flex: 1;
}

.lobby-info h3 {
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.player-count {
  font-size: 0.8rem;
  color: #888;
}

.lobby-players {
  display: flex;
  gap: 0.35rem;
}

.player-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
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

.empty {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #888;
}

.error {
  color: #ff4444;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.refresh-btn {
  margin-top: 1rem;
}
</style>
