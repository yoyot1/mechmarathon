import '../styles/lobby-list.css';
import { GAME, LOBBY, EVENTS } from '@mechmarathon/shared';
import { lobby } from '../state/lobby.js';
import { auth } from '../state/auth.js';
import { connectSocket, getSocket } from '../lib/socket.js';
import { navigateTo } from '../lib/router.js';

let showCreateForm = false;

export function render(container) {
  const token = localStorage.getItem('mechmarathon_token');
  if (token) connectSocket(token);
  lobby.fetchLobbies().then(() => update());

  function update() {
    container.innerHTML = `
      <div class="lobby-list">
        <header class="top-bar">
          <h1>MechMarathon</h1>
          <div class="user-info">
            <span>${auth.user?.username ?? ''}</span>
            <button class="btn btn-small btn-secondary" id="logout-btn">Logout</button>
          </div>
        </header>

        <div class="content">
          <div class="toolbar">
            <h2>Game Lobbies</h2>
            <button class="btn" id="toggle-create-btn">${showCreateForm ? 'Cancel' : 'Create Game'}</button>
          </div>

          ${showCreateForm ? `
            <form class="create-form" id="create-form">
              <input type="text" name="lobbyName" placeholder="Lobby name"
                minlength="${LOBBY.NAME_MIN_LENGTH}" maxlength="${LOBBY.NAME_MAX_LENGTH}" required />
              <div class="form-row">
                <label>
                  Visibility
                  <select name="visibility">
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </label>
                <label>
                  Max players
                  <select name="maxPlayers">
                    ${Array.from({ length: GAME.MAX_PLAYERS - GAME.MIN_PLAYERS + 1 }, (_, i) => {
                      const n = i + GAME.MIN_PLAYERS;
                      return `<option value="${n}">${n}</option>`;
                    }).join('')}
                  </select>
                </label>
              </div>
              <button type="submit" class="btn" ${lobby.loading ? 'disabled' : ''}>
                ${lobby.loading ? 'Creating...' : 'Create Lobby'}
              </button>
            </form>
          ` : ''}

          ${lobby.error ? `<p class="error">${lobby.error}</p>` : ''}

          ${lobby.loading && !showCreateForm ? '<div class="loading">Loading lobbies...</div>' :
            lobby.lobbies.length === 0 ? '<div class="empty"><p>No games available. Create one to get started!</p></div>' : `
            <div class="lobbies">
              ${lobby.lobbies.map((l) => `
                <div class="lobby-card" data-lobby-id="${l.id}">
                  <div class="lobby-info">
                    <h3>${l.name}</h3>
                    <span class="player-count">${l.players.length}/${l.maxPlayers} players</span>
                  </div>
                  <div class="lobby-players">
                    ${l.players.map((p) => `<span class="player-dot" style="background-color:${p.color}" title="${p.username}"></span>`).join('')}
                  </div>
                  <button class="btn btn-small join-btn" data-join="${l.id}">Join</button>
                </div>
              `).join('')}
            </div>
          `}

          <button class="btn btn-secondary btn-small refresh-btn" id="refresh-btn">Refresh</button>
        </div>
      </div>
    `;

    // Attach event listeners
    container.querySelector('#logout-btn')?.addEventListener('click', () => {
      auth.logout();
      navigateTo('/');
    });

    container.querySelector('#toggle-create-btn')?.addEventListener('click', () => {
      showCreateForm = !showCreateForm;
      update();
    });

    container.querySelector('#create-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const result = await lobby.createLobby({
        name: form.lobbyName.value,
        visibility: form.visibility.value,
        maxPlayers: Number(form.maxPlayers.value),
      });
      if (result) {
        navigateTo(`/lobby/${result.id}`);
      } else {
        update();
      }
    });

    container.querySelectorAll('.join-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const lobbyId = btn.dataset.join;
        const token = localStorage.getItem('mechmarathon_token');
        if (token) connectSocket(token);

        lobby.initSocketListeners();
        const res = await lobby.joinLobby(lobbyId);
        if (!res.error) {
          navigateTo(`/lobby/${lobbyId}`);
        } else {
          update();
        }
      });
    });

    container.querySelector('#refresh-btn')?.addEventListener('click', () => {
      lobby.fetchLobbies().then(() => update());
    });
  }

  update();
}

export function unmount() {
  showCreateForm = false;
}
