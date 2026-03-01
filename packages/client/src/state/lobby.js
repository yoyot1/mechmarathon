import { EVENTS } from '@mechmarathon/shared';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';

export const lobby = {
  lobbies: [],
  currentLobby: null,
  loading: false,
  error: null,

  // --- REST actions ---

  async fetchLobbies() {
    this.loading = true;
    this.error = null;
    try {
      this.lobbies = await api('/api/lobbies');
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load lobbies';
    } finally {
      this.loading = false;
    }
  },

  async fetchLobby(id) {
    this.loading = true;
    this.error = null;
    try {
      this.currentLobby = await api(`/api/lobbies/${id}`);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load lobby';
    } finally {
      this.loading = false;
    }
  },

  async createLobby(data) {
    this.loading = true;
    this.error = null;
    try {
      const result = await api('/api/lobbies', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      this.currentLobby = result;
      return result;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to create lobby';
      return null;
    } finally {
      this.loading = false;
    }
  },

  // --- Socket actions ---

  joinLobby(lobbyId) {
    return new Promise((resolve) => {
      const socket = getSocket();
      if (!socket) {
        resolve({ error: 'Not connected' });
        return;
      }
      socket.emit(EVENTS.LOBBY_JOIN, { lobbyId }, (res) => {
        if (res.lobby) this.currentLobby = res.lobby;
        if (res.error) this.error = res.error;
        resolve(res);
      });
    });
  },

  leaveLobby(lobbyId) {
    return new Promise((resolve) => {
      const socket = getSocket();
      if (!socket) {
        resolve();
        return;
      }
      socket.emit(EVENTS.LOBBY_LEAVE, { lobbyId }, () => {
        this.currentLobby = null;
        resolve();
      });
    });
  },

  toggleReady(lobbyId) {
    return new Promise((resolve) => {
      const socket = getSocket();
      if (!socket) {
        resolve({ error: 'Not connected' });
        return;
      }
      socket.emit(EVENTS.LOBBY_READY, { lobbyId }, (res) => {
        if (res.error) this.error = res.error;
        resolve(res);
      });
    });
  },

  startGame(lobbyId) {
    return new Promise((resolve) => {
      const socket = getSocket();
      if (!socket) {
        resolve({ error: 'Not connected' });
        return;
      }
      socket.emit(EVENTS.LOBBY_START, { lobbyId }, (res) => {
        if (res.error) this.error = res.error;
        resolve(res);
      });
    });
  },

  // --- Socket listeners ---

  _onLobbyUpdate: null,

  initSocketListeners(onUpdate) {
    const socket = getSocket();
    if (!socket) return;

    this._onLobbyUpdate = (lobbyData) => {
      this.currentLobby = lobbyData;

      // Also update in the list if present
      const idx = this.lobbies.findIndex((l) => l.id === lobbyData.id);
      if (idx !== -1) {
        this.lobbies[idx] = lobbyData;
      }
      if (onUpdate) onUpdate(lobbyData);
    };

    socket.on(EVENTS.LOBBY_UPDATE, this._onLobbyUpdate);
  },

  cleanupSocketListeners() {
    const socket = getSocket();
    if (!socket) return;
    socket.off(EVENTS.LOBBY_UPDATE, this._onLobbyUpdate);
    this._onLobbyUpdate = null;
  },
};
