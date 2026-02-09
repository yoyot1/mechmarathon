import { ref } from 'vue';
import { defineStore } from 'pinia';
import { EVENTS } from '@mechmarathon/shared';
import type { Lobby, CreateLobbyRequest } from '@mechmarathon/shared';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';

export const useLobbyStore = defineStore('lobby', () => {
  const lobbies = ref<Lobby[]>([]);
  const currentLobby = ref<Lobby | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // --- REST actions ---

  async function fetchLobbies() {
    loading.value = true;
    error.value = null;
    try {
      lobbies.value = await api<Lobby[]>('/api/lobbies');
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load lobbies';
    } finally {
      loading.value = false;
    }
  }

  async function fetchLobby(id: string) {
    loading.value = true;
    error.value = null;
    try {
      currentLobby.value = await api<Lobby>(`/api/lobbies/${id}`);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load lobby';
    } finally {
      loading.value = false;
    }
  }

  async function createLobby(data: CreateLobbyRequest): Promise<Lobby | null> {
    loading.value = true;
    error.value = null;
    try {
      const lobby = await api<Lobby>('/api/lobbies', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      currentLobby.value = lobby;
      return lobby;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create lobby';
      return null;
    } finally {
      loading.value = false;
    }
  }

  // --- Socket actions ---

  function joinLobby(lobbyId: string): Promise<{ error?: string; lobby?: Lobby }> {
    return new Promise((resolve) => {
      const socket = getSocket();
      if (!socket) {
        resolve({ error: 'Not connected' });
        return;
      }
      socket.emit(EVENTS.LOBBY_JOIN, { lobbyId }, (res: { error?: string; lobby?: Lobby }) => {
        if (res.lobby) currentLobby.value = res.lobby;
        if (res.error) error.value = res.error;
        resolve(res);
      });
    });
  }

  function leaveLobby(lobbyId: string): Promise<void> {
    return new Promise((resolve) => {
      const socket = getSocket();
      if (!socket) {
        resolve();
        return;
      }
      socket.emit(EVENTS.LOBBY_LEAVE, { lobbyId }, () => {
        currentLobby.value = null;
        resolve();
      });
    });
  }

  function toggleReady(lobbyId: string): Promise<{ error?: string }> {
    return new Promise((resolve) => {
      const socket = getSocket();
      if (!socket) {
        resolve({ error: 'Not connected' });
        return;
      }
      socket.emit(EVENTS.LOBBY_READY, { lobbyId }, (res: { error?: string }) => {
        if (res.error) error.value = res.error;
        resolve(res);
      });
    });
  }

  function startGame(lobbyId: string): Promise<{ error?: string }> {
    return new Promise((resolve) => {
      const socket = getSocket();
      if (!socket) {
        resolve({ error: 'Not connected' });
        return;
      }
      socket.emit(EVENTS.LOBBY_START, { lobbyId }, (res: { error?: string }) => {
        if (res.error) error.value = res.error;
        resolve(res);
      });
    });
  }

  // --- Socket listeners ---

  function initSocketListeners() {
    const socket = getSocket();
    if (!socket) return;

    socket.on(EVENTS.LOBBY_UPDATE, (lobby: Lobby) => {
      currentLobby.value = lobby;

      // Also update in the list if present
      const idx = lobbies.value.findIndex((l) => l.id === lobby.id);
      if (idx !== -1) {
        lobbies.value[idx] = lobby;
      }
    });
  }

  function cleanupSocketListeners() {
    const socket = getSocket();
    if (!socket) return;
    socket.off(EVENTS.LOBBY_UPDATE);
  }

  return {
    lobbies,
    currentLobby,
    loading,
    error,
    fetchLobbies,
    fetchLobby,
    createLobby,
    joinLobby,
    leaveLobby,
    toggleReady,
    startGame,
    initSocketListeners,
    cleanupSocketListeners,
  };
});
