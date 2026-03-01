import '../styles/lobby.css';
import { EVENTS } from '@mechmarathon/shared';
import { lobby } from '../state/lobby.js';
import { auth } from '../state/auth.js';
import { connectSocket, getSocket } from '../lib/socket.js';
import { navigateTo } from '../lib/router.js';

export function render(container, params) {
  const lobbyId = params.id;

  const token = localStorage.getItem('mechmarathon_token');
  if (token) connectSocket(token);

  lobby.initSocketListeners(onLobbyUpdate);

  // Fetch lobby, then join socket room
  lobby.fetchLobby(lobbyId).then(() => {
    lobby.joinLobby(lobbyId).then(() => update());
  });

  function onLobbyUpdate(lobbyData) {
    // Navigate to game when lobby starts
    if (lobbyData.status === 'in_progress') {
      navigateTo(`/game/${lobbyId}`);
      return;
    }
    update();
  }

  function update() {
    const l = lobby.currentLobby;
    const userId = auth.user?.id;
    const isHost = l?.hostId === userId;
    const currentPlayer = l?.players.find((p) => p.userId === userId);
    const allNonHostReady = l ? l.players.every((p) => p.userId === l.hostId || p.ready) : false;
    const canStart = isHost && l && l.players.length >= 2 && allNonHostReady;
    const canAddBot = isHost && l && l.players.length < l.maxPlayers;

    if (lobby.loading && !l) {
      container.innerHTML = '<div class="lobby-view"><div class="loading">Loading lobby...</div></div>';
      return;
    }

    if (lobby.error && !l) {
      container.innerHTML = `
        <div class="lobby-view">
          <div class="error-page">
            <p class="error">${lobby.error}</p>
            <a href="/lobby" data-link class="btn btn-secondary">Back to Lobbies</a>
          </div>
        </div>`;
      return;
    }

    if (!l) return;

    container.innerHTML = `
      <div class="lobby-view">
        <header class="lobby-header">
          <div>
            <h2>${l.name}</h2>
            <span class="lobby-meta">${l.players.length}/${l.maxPlayers} players &middot; ${l.visibility}</span>
          </div>
          <button class="btn btn-secondary btn-small" id="leave-btn">Leave</button>
        </header>

        ${lobby.error ? `<p class="error">${lobby.error}</p>` : ''}

        <div class="player-list">
          ${l.players.map((p) => `
            <div class="player-card ${p.userId === l.hostId ? 'host' : ''}">
              <span class="player-color" style="background-color:${p.color}"></span>
              <span class="player-name">
                ${p.username}
                ${p.userId === l.hostId ? '<span class="host-badge">HOST</span>' : ''}
              </span>
              <span class="ready-status ${p.ready || p.userId === l.hostId ? 'ready' : ''}">
                ${p.userId === l.hostId ? 'Host' : p.ready ? 'Ready' : 'Not Ready'}
              </span>
            </div>
          `).join('')}
        </div>

        <div class="actions">
          ${!isHost ? `
            <button class="btn ${currentPlayer?.ready ? 'btn-secondary' : ''}" id="ready-btn">
              ${currentPlayer?.ready ? 'Unready' : 'Ready Up'}
            </button>
          ` : ''}
          ${isHost ? `
            <button class="btn btn-bot" id="add-bot-btn" ${!canAddBot ? 'disabled' : ''}>Add Bot</button>
            <button class="btn btn-start" id="start-btn" ${!canStart ? 'disabled' : ''}>Start Game</button>
          ` : ''}
        </div>
      </div>
    `;

    container.querySelector('#leave-btn')?.addEventListener('click', async () => {
      await lobby.leaveLobby(lobbyId);
      navigateTo('/lobby');
    });

    container.querySelector('#ready-btn')?.addEventListener('click', async () => {
      await lobby.toggleReady(lobbyId);
      update();
    });

    container.querySelector('#add-bot-btn')?.addEventListener('click', () => {
      const socket = getSocket();
      if (!socket) return;
      socket.emit(EVENTS.LOBBY_ADD_BOT, { lobbyId }, (res) => {
        if (res.error) lobby.error = res.error;
        update();
      });
    });

    container.querySelector('#start-btn')?.addEventListener('click', async () => {
      const res = await lobby.startGame(lobbyId);
      if (res.error) update();
    });
  }

  update();
}

export function unmount() {
  lobby.cleanupSocketListeners();
}
