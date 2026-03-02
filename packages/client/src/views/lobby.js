import '../styles/lobby.css';
import { EVENTS, BOARD, assembleMap } from '@mechmarathon/shared';
import { lobby } from '../state/lobby.js';
import { auth } from '../state/auth.js';
import { api } from '../lib/api.js';
import { connectSocket, getSocket } from '../lib/socket.js';
import { navigateTo } from '../lib/router.js';

let mapConfigOpen = false;
let availableBoards = [];
let boardEntries = []; // { boardId, boardName, x, y, rotation }
let checkpoints = [];  // { x, y, number }
let spawnPoints = [];   // { x, y, number }
let placementMode = 'checkpoints'; // 'checkpoints' | 'spawns'
let compositeBoardCache = null;
let boardTilesCache = new Map();

export function render(container, params) {
  const lobbyId = params.id;

  const token = localStorage.getItem('mechmarathon_token');
  if (token) connectSocket(token);

  lobby.initSocketListeners(onLobbyUpdate);

  // Fetch lobby, then join socket room
  lobby.fetchLobby(lobbyId).then(() => {
    lobby.joinLobby(lobbyId).then(() => {
      // Initialize map config state from lobby data
      initMapConfigFromLobby();
      update();
    });
  });

  // Listen for map config updates
  const socket = getSocket();
  if (socket) {
    socket.on(EVENTS.LOBBY_MAP_UPDATE, (data) => {
      if (data.mapConfig) {
        loadMapConfigState(data.mapConfig);
        rebuildComposite();
        update();
      }
    });
  }

  function initMapConfigFromLobby() {
    const l = lobby.currentLobby;
    if (l?.mapConfig) {
      loadMapConfigState(l.mapConfig);
      rebuildComposite();
    }
  }

  function loadMapConfigState(mc) {
    boardEntries = (mc.boards || []).map((b) => ({
      boardId: b.boardId,
      boardName: b.boardName || 'Unknown',
      x: b.x,
      y: b.y,
      rotation: b.rotation || 0,
    }));
    checkpoints = mc.checkpoints || [];
    spawnPoints = mc.spawnPoints || [];
  }

  function onLobbyUpdate(lobbyData) {
    // Navigate to game when lobby starts
    if (lobbyData.status === 'in_progress') {
      navigateTo(`/game/${lobbyId}`);
      return;
    }
    update();
  }

  async function loadAvailableBoards() {
    if (availableBoards.length > 0) return;
    try {
      availableBoards = await api('/api/boards');
    } catch {
      availableBoards = [];
    }
  }

  async function loadBoardTiles(boardId) {
    if (boardTilesCache.has(boardId)) return boardTilesCache.get(boardId);
    try {
      const board = await api(`/api/boards/${boardId}`);
      const data = { width: 12, height: 12, tiles: board.tiles };
      boardTilesCache.set(boardId, data);
      return data;
    } catch {
      return null;
    }
  }

  async function rebuildComposite() {
    if (boardEntries.length === 0) {
      compositeBoardCache = null;
      return;
    }

    // Load tiles for all board entries
    const boardsById = new Map();
    for (const entry of boardEntries) {
      const data = await loadBoardTiles(entry.boardId);
      if (data) boardsById.set(entry.boardId, data);
    }

    const mapConfig = {
      boards: boardEntries.map((e) => ({ boardId: e.boardId, x: e.x, y: e.y, rotation: e.rotation })),
      checkpoints,
      spawnPoints,
    };

    compositeBoardCache = assembleMap(mapConfig, boardsById);
    update();
  }

  function buildMapConfig() {
    return {
      boards: boardEntries.map((e) => ({
        boardId: e.boardId,
        boardName: e.boardName,
        x: e.x,
        y: e.y,
        rotation: e.rotation,
      })),
      checkpoints,
      spawnPoints,
    };
  }

  async function saveMapConfig() {
    const socket = getSocket();
    if (!socket) return;
    const mapConfig = buildMapConfig();
    socket.emit(EVENTS.LOBBY_MAP_CONFIG, { lobbyId, mapConfig }, (res) => {
      if (res?.error) {
        lobby.error = res.error;
        update();
      }
    });
  }

  async function quickSetup() {
    await loadAvailableBoards();
    // Use first official board or first available
    const defaultBoard = availableBoards.find((b) => b.isOfficial) || availableBoards[0];
    if (!defaultBoard) return;

    boardEntries = [{
      boardId: defaultBoard.id,
      boardName: defaultBoard.name,
      x: 0,
      y: 0,
      rotation: 0,
    }];

    // Default checkpoints
    checkpoints = [
      { x: 5, y: 10, number: 1 },
      { x: 5, y: 5, number: 2 },
      { x: 5, y: 1, number: 3 },
    ];

    // Default spawn points
    const l = lobby.currentLobby;
    const maxP = l?.maxPlayers || 8;
    spawnPoints = [];
    for (let i = 0; i < maxP; i++) {
      spawnPoints.push({ x: 2 + i, y: 11, number: i + 1 });
    }

    await rebuildComposite();
    await saveMapConfig();
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

    const mapSummary = l.mapSummary;

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

        <!-- Map Configurator -->
        <div class="map-configurator">
          <div class="map-config-header" id="map-config-toggle">
            <h3>Map Configuration ${mapSummary ? `(${mapSummary.boardCount} board${mapSummary.boardCount !== 1 ? 's' : ''}, ${mapSummary.checkpointCount} checkpoints)` : '(not configured)'}</h3>
            <span class="toggle-icon ${mapConfigOpen ? 'open' : ''}">\u25BC</span>
          </div>
          ${mapConfigOpen ? `
            <div class="map-config-body">
              ${isHost ? `
                <div class="map-config-actions">
                  <button class="btn btn-small" id="quick-setup-btn">Quick Setup</button>
                  <button class="btn btn-small btn-secondary" id="add-board-btn">Add Board</button>
                  <button class="btn btn-small btn-secondary" id="save-map-btn">Save Map Config</button>
                </div>

                ${renderBoardLayout(isHost)}
                ${renderCompositePreview(isHost)}
              ` : `
                ${mapSummary ? `
                  <div class="map-config-summary">
                    ${mapSummary.boardCount} board(s), ${mapSummary.checkpointCount} checkpoint(s), ${mapSummary.spawnCount} spawn(s)
                  </div>
                  ${renderCompositePreview(false)}
                ` : '<div class="map-config-summary">Host has not configured the map yet. Default board will be used.</div>'}
              `}
            </div>
          ` : ''}
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

    // Attach event listeners
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

    // Map configurator toggle
    container.querySelector('#map-config-toggle')?.addEventListener('click', async () => {
      mapConfigOpen = !mapConfigOpen;
      if (mapConfigOpen) await loadAvailableBoards();
      update();
    });

    // Quick setup
    container.querySelector('#quick-setup-btn')?.addEventListener('click', quickSetup);

    // Add board
    container.querySelector('#add-board-btn')?.addEventListener('click', async () => {
      await loadAvailableBoards();
      if (availableBoards.length === 0) return;
      const board = availableBoards.find((b) => b.isOfficial) || availableBoards[0];
      // Calculate next position: place to the right of the last entry
      const maxX = boardEntries.reduce((max, e) => Math.max(max, e.x), -1);
      boardEntries.push({
        boardId: board.id,
        boardName: board.name,
        x: maxX + 1,
        y: 0,
        rotation: 0,
      });
      await rebuildComposite();
      update();
    });

    // Save map config
    container.querySelector('#save-map-btn')?.addEventListener('click', saveMapConfig);

    // Board entry controls
    container.querySelectorAll('.board-entry').forEach((el) => {
      const idx = parseInt(el.dataset.idx);

      el.querySelector('.entry-board-select')?.addEventListener('change', async (e) => {
        const boardId = e.target.value;
        const board = availableBoards.find((b) => b.id === boardId);
        boardEntries[idx].boardId = boardId;
        boardEntries[idx].boardName = board?.name || 'Unknown';
        await rebuildComposite();
      });

      el.querySelector('.entry-x')?.addEventListener('change', async (e) => {
        boardEntries[idx].x = parseInt(e.target.value) || 0;
        await rebuildComposite();
      });

      el.querySelector('.entry-y')?.addEventListener('change', async (e) => {
        boardEntries[idx].y = parseInt(e.target.value) || 0;
        await rebuildComposite();
      });

      el.querySelector('.entry-rotation')?.addEventListener('change', async (e) => {
        boardEntries[idx].rotation = parseInt(e.target.value) || 0;
        await rebuildComposite();
      });

      el.querySelector('.btn-remove')?.addEventListener('click', async () => {
        boardEntries.splice(idx, 1);
        await rebuildComposite();
        update();
      });
    });

    // Placement mode tabs
    container.querySelectorAll('.placement-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        placementMode = btn.dataset.mode;
        update();
      });
    });

    // Composite grid click for checkpoint/spawn placement
    if (isHost) {
      container.querySelectorAll('.composite-cell').forEach((cell) => {
        cell.addEventListener('click', () => {
          const x = parseInt(cell.dataset.x);
          const y = parseInt(cell.dataset.y);

          if (placementMode === 'checkpoints') {
            // Toggle checkpoint at this position
            const existing = checkpoints.findIndex((cp) => cp.x === x && cp.y === y);
            if (existing >= 0) {
              checkpoints.splice(existing, 1);
              // Renumber
              checkpoints.sort((a, b) => a.number - b.number);
              checkpoints.forEach((cp, i) => cp.number = i + 1);
            } else if (checkpoints.length < BOARD.MAX_CHECKPOINTS) {
              checkpoints.push({ x, y, number: checkpoints.length + 1 });
            }
          } else {
            // Toggle spawn point
            const existing = spawnPoints.findIndex((sp) => sp.x === x && sp.y === y);
            if (existing >= 0) {
              spawnPoints.splice(existing, 1);
              spawnPoints.sort((a, b) => a.number - b.number);
              spawnPoints.forEach((sp, i) => sp.number = i + 1);
            } else if (spawnPoints.length < BOARD.MAX_SPAWN_POINTS) {
              spawnPoints.push({ x, y, number: spawnPoints.length + 1 });
            }
          }
          update();
        });
      });
    }
  }

  function renderBoardLayout(isHost) {
    if (boardEntries.length === 0 && !isHost) return '';

    return `
      <div class="board-layout">
        <h4>Board Layout</h4>
        ${boardEntries.map((entry, idx) => `
          <div class="board-entry" data-idx="${idx}">
            ${isHost ? `
              <select class="entry-board-select">
                ${availableBoards.map((b) => `
                  <option value="${b.id}" ${b.id === entry.boardId ? 'selected' : ''}>${escapeHtml(b.name)}${b.isOfficial ? ' (Official)' : ''}</option>
                `).join('')}
              </select>
            ` : `<span class="entry-name">${escapeHtml(entry.boardName)}</span>`}
            <span class="entry-pos">X:</span>
            ${isHost ? `<input type="number" class="entry-x" value="${entry.x}" min="-4" max="4" />` : `<span>${entry.x}</span>`}
            <span class="entry-pos">Y:</span>
            ${isHost ? `<input type="number" class="entry-y" value="${entry.y}" min="-4" max="4" />` : `<span>${entry.y}</span>`}
            <span class="entry-pos">Rot:</span>
            ${isHost ? `
              <select class="entry-rotation">
                <option value="0" ${entry.rotation === 0 ? 'selected' : ''}>0\u00B0</option>
                <option value="90" ${entry.rotation === 90 ? 'selected' : ''}>90\u00B0</option>
                <option value="180" ${entry.rotation === 180 ? 'selected' : ''}>180\u00B0</option>
                <option value="270" ${entry.rotation === 270 ? 'selected' : ''}>270\u00B0</option>
              </select>
            ` : `<span>${entry.rotation}\u00B0</span>`}
            ${isHost ? '<button class="btn-remove">\u2716</button>' : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderCompositePreview(isHost) {
    if (!compositeBoardCache) return '';
    const { board } = compositeBoardCache;

    return `
      <div class="composite-preview">
        <h4>Board Preview</h4>
        ${isHost ? `
          <div class="placement-tabs">
            <button class="placement-tab ${placementMode === 'checkpoints' ? 'active' : ''}" data-mode="checkpoints">
              Place Checkpoints (${checkpoints.length})
            </button>
            <button class="placement-tab ${placementMode === 'spawns' ? 'active' : ''}" data-mode="spawns">
              Place Spawns (${spawnPoints.length})
            </button>
          </div>
        ` : ''}
        <div class="composite-grid" style="grid-template-columns: repeat(${board.width}, 20px);">
          ${board.tiles.map((row, y) => row.map((tile, x) => {
            const cp = checkpoints.find((c) => c.x === x && c.y === y);
            const sp = spawnPoints.find((s) => s.x === x && s.y === y);
            return `<div class="composite-cell" data-type="${tile.type}" data-x="${x}" data-y="${y}">
              ${cp ? `<span class="checkpoint-marker">${cp.number}</span>` : ''}
              ${sp ? `<span class="spawn-marker">${sp.number}</span>` : ''}
            </div>`;
          }).join('')).join('')}
        </div>
      </div>
    `;
  }

  update();
}

export function unmount() {
  lobby.cleanupSocketListeners();
  mapConfigOpen = false;
  boardEntries = [];
  checkpoints = [];
  spawnPoints = [];
  compositeBoardCache = null;
  // Keep availableBoards and boardTilesCache as they can be reused
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
