import '../styles/game.css';
import { GAME, ROBOT_COLORS } from '@mechmarathon/shared';
import { game } from '../state/game.js';
import { auth } from '../state/auth.js';
import { connectSocket } from '../lib/socket.js';
import { navigateTo } from '../lib/router.js';
import {
  initBoardCanvas,
  destroyBoardCanvas,
  updateRobots,
  updateBoard,
  animateEvents,
  updateSpeed,
  isInitialized,
} from './boardCanvas.js';

let legendOpen = true;
let initialTimerInterval = null;
let containerRef = null;

const CARD_LABELS = {
  move1: 'Move 1', move2: 'Move 2', move3: 'Move 3',
  backup: 'Backup', turn_left: 'Turn L', turn_right: 'Turn R', u_turn: 'U-Turn',
};

function cardLabel(card) {
  return CARD_LABELS[card.type] ?? card.type;
}

function robotColor(robot) {
  const idx = game.gameState?.robots.indexOf(robot) ?? 0;
  return ROBOT_COLORS[idx % ROBOT_COLORS.length];
}

function robotColorByPlayerId(playerId) {
  const robot = game.gameState?.robots.find((r) => r.playerId === playerId);
  if (!robot) return '#666';
  return robotColor(robot);
}

function robotLabel(robotId) {
  const idx = game.gameState?.robots.findIndex((r) => r.id === robotId) ?? -1;
  return idx >= 0 ? `Robot ${idx + 1}` : robotId;
}

function formatEvent(ev) {
  const name = robotLabel(ev.robotId);
  switch (ev.type) {
    case 'move': return `${name} moved to (${ev.to?.x},${ev.to?.y})`;
    case 'rotate': return `${name} rotated ${ev.details}`;
    case 'push': return `${name} pushed to (${ev.to?.x},${ev.to?.y})`;
    case 'fall': return `${name} fell (${ev.details})`;
    case 'respawn': return `${name} respawned`;
    case 'conveyor': return `Conveyor moved ${name}`;
    case 'gear': return `Gear rotated ${name} ${ev.details}`;
    case 'checkpoint': return `${name} reached ${ev.details}`;
    case 'repair': return `${name} repaired`;
    default: return `${name}: ${ev.type}`;
  }
}

const legendItems = [
  { cls: 'tile-floor', label: 'Floor' },
  { cls: 'tile-conveyor', label: 'Conveyor', arrow: '\u2191' },
  { cls: 'tile-express_conveyor', label: 'Express Conv.', arrow: '\u21C8' },
  { cls: 'tile-gear_cw', label: 'Gear CW', arrow: '\u21BB' },
  { cls: 'tile-gear_ccw', label: 'Gear CCW', arrow: '\u21BA' },
  { cls: 'tile-pit', label: 'Pit', arrow: '\u2716' },
  { cls: 'tile-repair', label: 'Repair', arrow: '+' },
  { cls: 'tile-checkpoint', label: 'Checkpoint', arrow: '1', gold: true },
  { cls: 'tile-laser', label: 'Laser', arrow: '\u26A1' },
  { cls: 'tile-wall wall-south', label: 'Wall', wallDemo: true },
];

// --- Sub-render functions ---

function renderHeader() {
  const phase = game.phase();
  const timerHtml = phase === 'programming' && game.timerSeconds > 0
    ? `<span class="timer ${game.timerSeconds <= 10 ? 'urgent' : ''}">${game.timerSeconds}s</span>`
    : '';

  const execInfoHtml = game.isExecuting ? `
    <div class="exec-info">
      <span>Register ${game.currentRegister + 1} / 5</span>
      ${game.debugMode && game.debugStepLabel ? `
        <span class="step-info">
          ${game.debugStepLabel}
          <span class="step-counter">(${game.debugStepIndex + 1}/${game.debugTotalSteps})</span>
        </span>
      ` : ''}
    </div>
  ` : '';

  return `
    <header class="game-header">
      <div class="header-info">
        <span class="round-badge">Round ${game.gameState?.round ?? 0}</span>
        <span class="phase-badge ${phase}">${phase}</span>
        ${timerHtml}
      </div>
      <div class="header-right">
        ${execInfoHtml}
        <div class="speed-selector">
          ${[1, 2, 3].map((s) => `
            <button class="speed-btn ${game.executionSpeed === s ? 'active' : ''}" data-speed="${s}">${s}x</button>
          `).join('')}
        </div>
        <button class="debug-toggle ${game.debugMode ? 'active' : ''}" id="debug-toggle" title="Step-through execution">Debug</button>
        ${game.debugMode && game.isExecuting ? `
          <button class="btn btn-step-back" id="debug-step-back">&laquo; Back</button>
          <button class="btn btn-step" id="debug-step">Step &raquo;</button>
        ` : ''}
        <button class="btn btn-leave" id="leave-btn">Leave</button>
      </div>
    </header>
  `;
}

function renderWinnerBanner() {
  if (!game.winner) return '';
  return `
    <div class="winner-banner">
      <h2>Game Over!</h2>
      <p>${game.winner === auth.user?.id ? 'You win!' : 'You lose!'}</p>
      <button class="btn" id="back-btn">Back to Lobbies</button>
    </div>
  `;
}

function renderBoardArea() {
  if (!game.gameState) return '';
  return `
    <div class="board-area">
      <div class="board-canvas" id="board-canvas-container"></div>
      <div class="legend-sidebar">
        <button class="legend-toggle" id="legend-toggle">${legendOpen ? 'Hide' : 'Show'} Legend</button>
        ${legendOpen ? `
          <div class="legend-list">
            ${legendItems.map((item) => `
              <div class="legend-item">
                <div class="legend-swatch tile ${item.cls}">
                  ${item.arrow ? `<span class="legend-arrow ${item.gold ? 'gold' : ''}">${item.arrow}</span>` : ''}
                </div>
                <span class="legend-label">${item.label}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderDirectionPicker(isInline) {
  const dirs = ['north', 'south', 'east', 'west'];
  const gridLabels = { north: 'N', south: 'S', east: 'E', west: 'W' };
  const gridClasses = { north: 'dir-n', south: 'dir-s', east: 'dir-e', west: 'dir-w' };
  const sizeClass = isInline ? '' : 'direction-compass-lg';

  return `
    <div class="direction-compass ${sizeClass}">
      ${dirs.map((d) => `
        <button class="dir-btn ${gridClasses[d]} ${game.chosenDirection === d ? 'selected' : ''}" data-dir="${d}">${gridLabels[d]}</button>
      `).join('')}
    </div>
  `;
}

function renderProgrammingControls() {
  const phase = game.phase();
  if (phase !== 'programming' || game.winner) return '';

  const userId = auth.user?.id;
  const showInitialDir = userId && game.pendingDirectionPlayerIds.includes(userId) && game.directionChoiceReason === 'initial';

  return `
    <div class="controls">
      <div class="registers">
        <h3>Registers</h3>
        <div class="register-slots">
          ${game.program.map((card, idx) => `
            <div class="register-slot ${card ? 'filled' : ''}" data-slot="${idx}">
              ${card ? `
                <span class="card-name">${cardLabel(card)}</span>
                <span class="card-priority">${card.priority}</span>
              ` : `
                <span class="slot-number">${idx + 1}</span>
              `}
            </div>
          `).join('')}
        </div>

        ${showInitialDir ? `
          <div class="direction-picker-inline">
            <span class="direction-label">Starting Direction:</span>
            ${renderDirectionPicker(true)}
          </div>
        ` : ''}

        <button class="btn btn-submit" id="submit-btn"
          ${!game.isProgramComplete() || game.programSubmitted ? 'disabled' : ''}>
          ${game.programSubmitted ? 'Submitted' : 'Submit Program'}
        </button>
      </div>

      <div class="hand">
        <h3>Hand</h3>
        <div class="hand-cards">
          ${game.availableCards().map((card) => `
            <div class="hand-card" data-card-id="${card.id}">
              <span class="card-name">${cardLabel(card)}</span>
              <span class="card-priority">${card.priority}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderExecutingControls() {
  const phase = game.phase();
  if (phase !== 'executing') return '';

  const playerIds = Object.keys(game.allPrograms);
  const robotMoveEvents = game.currentRegisterEvents.filter(
    (e) => e.type === 'move' || e.type === 'rotate' || e.type === 'push' || e.type === 'fall' || e.type === 'respawn',
  );
  const boardElementEvents = game.currentRegisterEvents.filter(
    (e) => e.type === 'conveyor' || e.type === 'gear' || e.type === 'checkpoint' || e.type === 'repair',
  );

  return `
    <div class="controls controls-executing">
      ${playerIds.length > 0 ? `
        <div class="programs-grid">
          <h3>Programs</h3>
          <div class="programs-table">
            <div class="programs-header">
              <div class="prog-label"></div>
              ${Array.from({ length: GAME.REGISTERS_PER_ROUND }, (_, i) => `
                <div class="prog-reg-header ${i === game.currentRegister ? 'current' : ''} ${i < game.currentRegister ? 'past' : ''}">
                  R${i + 1}
                </div>
              `).join('')}
            </div>
            ${playerIds.map((playerId) => `
              <div class="programs-row">
                <div class="prog-label">
                  <span class="prog-dot" style="background-color:${robotColorByPlayerId(playerId)}"></span>
                </div>
                ${(game.allPrograms[playerId] || []).map((card, idx) => `
                  <div class="prog-card ${idx === game.currentRegister ? 'current' : ''} ${idx < game.currentRegister ? 'past' : ''}">
                    <span class="card-name">${cardLabel(card)}</span>
                    <span class="card-priority">${card.priority}</span>
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${game.currentRegisterEvents.length > 0 ? `
        <div class="exec-log">
          ${robotMoveEvents.length > 0 ? `
            <div class="log-section">
              <h4>Robot Moves</h4>
              ${robotMoveEvents.map((ev) => `<div class="log-entry">${formatEvent(ev)}</div>`).join('')}
            </div>
          ` : ''}
          ${boardElementEvents.length > 0 ? `
            <div class="log-section">
              <h4>Board Elements</h4>
              ${boardElementEvents.map((ev) => `<div class="log-entry">${formatEvent(ev)}</div>`).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

function renderRespawnDirectionPanel() {
  const userId = auth.user?.id;
  const showRespawn = userId && game.pendingDirectionPlayerIds.includes(userId) && game.directionChoiceReason === 'respawn';
  if (!showRespawn) return '';

  return `
    <div class="respawn-direction-panel">
      <h3>Choose Respawn Direction</h3>
      <span class="direction-timer ${game.directionTimeoutSeconds <= 5 ? 'urgent' : ''}">${game.directionTimeoutSeconds}s</span>
      ${renderDirectionPicker(false)}
      <button class="btn btn-submit" id="confirm-direction-btn" ${!game.chosenDirection ? 'disabled' : ''}>
        Confirm Direction
      </button>
    </div>
  `;
}

function renderPlayerInfo() {
  if (!game.gameState) return '';
  return `
    <div class="player-info">
      ${game.gameState.robots.map((robot) => `
        <div class="player-row ${robot.lives <= 0 ? 'dead' : ''} ${robot.playerId === auth.user?.id ? 'me' : ''}">
          <span class="player-dot" style="background-color:${robotColor(robot)}"></span>
          ${robot.playerId === auth.user?.id ? '<span class="you-badge">You</span>' : ''}
          <span class="player-stats">HP:${robot.health} Lives:${robot.lives} CP:${robot.checkpoint}/${game.gameState.totalCheckpoints}</span>
          ${robot.virtual ? '<span class="virtual-badge">virtual</span>' : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// --- Main render & update ---

function updateDOM() {
  if (!containerRef) return;

  containerRef.innerHTML = `
    <div class="game-view">
      ${renderHeader()}
      ${renderWinnerBanner()}
      ${game.error ? `<p class="error">${game.error}</p>` : ''}
      ${renderBoardArea()}
      ${renderProgrammingControls()}
      ${renderExecutingControls()}
      ${renderRespawnDirectionPanel()}
      ${renderPlayerInfo()}
    </div>
  `;

  attachEventListeners();

  // Init or restore PixiJS board
  const canvasEl = containerRef.querySelector('#board-canvas-container');
  if (canvasEl && game.gameState) {
    if (!isInitialized()) {
      requestAnimationFrame(() => {
        initBoardCanvas(canvasEl, game.gameState, auth.user?.id);
      });
    } else {
      // Re-append the canvas if it's been orphaned by innerHTML replacement
      // Instead, for PixiJS we need to reinit after full DOM replacement
      requestAnimationFrame(() => {
        destroyBoardCanvas();
        initBoardCanvas(canvasEl, game.gameState, auth.user?.id);
      });
    }
  }
}

function attachEventListeners() {
  if (!containerRef) return;

  // Speed buttons
  containerRef.querySelectorAll('.speed-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gameId = getGameId();
      game.setSpeed(gameId, Number(btn.dataset.speed));
    });
  });

  // Debug toggle
  containerRef.querySelector('#debug-toggle')?.addEventListener('click', () => {
    game.toggleDebugMode(getGameId());
  });

  // Debug step
  containerRef.querySelector('#debug-step')?.addEventListener('click', () => {
    game.debugStep(getGameId());
  });

  // Debug step back
  containerRef.querySelector('#debug-step-back')?.addEventListener('click', () => {
    game.debugStepBack(getGameId());
  });

  // Leave
  containerRef.querySelector('#leave-btn')?.addEventListener('click', () => {
    game.leaveGame(getGameId());
    navigateTo('/lobby');
  });

  // Back to lobbies (winner banner)
  containerRef.querySelector('#back-btn')?.addEventListener('click', () => {
    game.reset();
    navigateTo('/lobby');
  });

  // Legend toggle
  containerRef.querySelector('#legend-toggle')?.addEventListener('click', () => {
    legendOpen = !legendOpen;
    updateDOM();
  });

  // Register slots — click to remove card
  containerRef.querySelectorAll('.register-slot').forEach((slot) => {
    slot.addEventListener('click', () => {
      const idx = Number(slot.dataset.slot);
      game.removeCard(idx);
      updateProgrammingUI();
    });
  });

  // Hand cards — click to place in first empty slot
  containerRef.querySelectorAll('.hand-card').forEach((cardEl) => {
    cardEl.addEventListener('click', () => {
      const cardId = cardEl.dataset.cardId;
      const card = game.hand.find((c) => c.id === cardId);
      if (!card) return;
      const emptySlot = game.program.findIndex((c) => c === null);
      if (emptySlot !== -1) {
        game.placeCard(card, emptySlot);
        updateProgrammingUI();
      }
    });
  });

  // Submit program
  containerRef.querySelector('#submit-btn')?.addEventListener('click', async () => {
    try {
      await game.submitProgram(getGameId());
      updateProgrammingUI();
    } catch {
      // error shown in state
      updateProgrammingUI();
    }
  });

  // Direction buttons (inline and respawn)
  containerRef.querySelectorAll('.dir-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      game.selectDirection(btn.dataset.dir);
      // Update selected state
      containerRef.querySelectorAll('.dir-btn').forEach((b) => b.classList.remove('selected'));
      containerRef.querySelectorAll(`.dir-btn[data-dir="${btn.dataset.dir}"]`).forEach((b) => b.classList.add('selected'));
      // Update submit button state
      const submitBtn = containerRef.querySelector('#submit-btn');
      if (submitBtn) submitBtn.disabled = !game.isProgramComplete() || game.programSubmitted;
      const confirmBtn = containerRef.querySelector('#confirm-direction-btn');
      if (confirmBtn) confirmBtn.disabled = !game.chosenDirection;
    });
  });

  // Confirm respawn direction
  containerRef.querySelector('#confirm-direction-btn')?.addEventListener('click', () => {
    if (!game.chosenDirection) return;
    game.submitDirection(getGameId(), game.chosenDirection);
  });
}

function updateProgrammingUI() {
  // Targeted update of register slots and hand cards without full re-render
  const slotsContainer = containerRef?.querySelector('.register-slots');
  const handContainer = containerRef?.querySelector('.hand-cards');
  const submitBtn = containerRef?.querySelector('#submit-btn');

  if (slotsContainer) {
    slotsContainer.innerHTML = game.program.map((card, idx) => `
      <div class="register-slot ${card ? 'filled' : ''}" data-slot="${idx}">
        ${card ? `
          <span class="card-name">${cardLabel(card)}</span>
          <span class="card-priority">${card.priority}</span>
        ` : `
          <span class="slot-number">${idx + 1}</span>
        `}
      </div>
    `).join('');

    // Re-attach slot listeners
    slotsContainer.querySelectorAll('.register-slot').forEach((slot) => {
      slot.addEventListener('click', () => {
        game.removeCard(Number(slot.dataset.slot));
        updateProgrammingUI();
      });
    });
  }

  if (handContainer) {
    const available = game.availableCards();
    handContainer.innerHTML = available.map((card) => `
      <div class="hand-card" data-card-id="${card.id}">
        <span class="card-name">${cardLabel(card)}</span>
        <span class="card-priority">${card.priority}</span>
      </div>
    `).join('');

    // Re-attach hand card listeners
    handContainer.querySelectorAll('.hand-card').forEach((cardEl) => {
      cardEl.addEventListener('click', () => {
        const cardId = cardEl.dataset.cardId;
        const card = game.hand.find((c) => c.id === cardId);
        if (!card) return;
        const emptySlot = game.program.findIndex((c) => c === null);
        if (emptySlot !== -1) {
          game.placeCard(card, emptySlot);
          updateProgrammingUI();
        }
      });
    });
  }

  if (submitBtn) {
    submitBtn.disabled = !game.isProgramComplete() || game.programSubmitted;
    submitBtn.textContent = game.programSubmitted ? 'Submitted' : 'Submit Program';
  }
}

let currentGameId = null;

function getGameId() {
  return currentGameId;
}

function clearInitialTimer() {
  if (initialTimerInterval) {
    clearInterval(initialTimerInterval);
    initialTimerInterval = null;
  }
}

// --- Public API ---

export function render(container, params) {
  containerRef = container;
  currentGameId = params.id;
  legendOpen = true;

  const token = localStorage.getItem('mechmarathon_token');
  if (token) connectSocket(token);

  // Set up socket listeners with DOM update callbacks
  game.initSocketListeners({
    onCardsDealt() {
      updateDOM();
    },
    onPrograms() {
      updateDOM();
    },
    onPhaseChange(payload) {
      if (payload.phase !== 'programming') {
        clearInitialTimer();
      }
      updateDOM();
    },
    onExecute(payload) {
      // Update execution UI
      const execInfo = containerRef?.querySelector('.exec-info');
      if (execInfo) {
        execInfo.innerHTML = `
          <span>Register ${game.currentRegister + 1} / 5</span>
          ${game.debugMode && game.debugStepLabel ? `
            <span class="step-info">${game.debugStepLabel}
              <span class="step-counter">(${game.debugStepIndex + 1}/${game.debugTotalSteps})</span>
            </span>
          ` : ''}
        `;
      }

      // Animate on board
      if (game.gameState) {
        animateEvents(payload.events, game.gameState.robots);
      }

      // Re-render executing controls
      const controlsEl = containerRef?.querySelector('.controls-executing');
      if (controlsEl) {
        controlsEl.outerHTML = renderExecutingControls();
        // Player info update
        const playerInfoEl = containerRef?.querySelector('.player-info');
        if (playerInfoEl) {
          playerInfoEl.outerHTML = renderPlayerInfo();
        }
      } else {
        updateDOM();
      }
    },
    onGameOver() {
      updateDOM();
    },
    onSpeedChange(payload) {
      updateSpeed(payload.speed);
      // Update active speed button
      containerRef?.querySelectorAll('.speed-btn').forEach((btn) => {
        btn.classList.toggle('active', Number(btn.dataset.speed) === payload.speed);
      });
    },
    onDirectionNeeded() {
      updateDOM();
    },
    onDebugMode() {
      updateDOM();
    },
    onTimerTick(seconds) {
      const timerEl = containerRef?.querySelector('.timer');
      if (timerEl) {
        timerEl.textContent = `${seconds}s`;
        timerEl.classList.toggle('urgent', seconds <= 10);
      }
    },
    onDirectionTimerTick(seconds) {
      const timerEl = containerRef?.querySelector('.direction-timer');
      if (timerEl) {
        timerEl.textContent = `${seconds}s`;
        timerEl.classList.toggle('urgent', seconds <= 5);
      }
    },
  });

  // Join the game
  game.joinGame(currentGameId).then(() => {
    updateDOM();

    // Start timer if joining mid-programming phase
    if (game.gameState?.phase === 'programming' && game.gameState.timerSeconds && game.timerSeconds <= 0) {
      game.timerSeconds = game.gameState.timerSeconds;
      initialTimerInterval = setInterval(() => {
        game.timerSeconds = Math.max(0, game.timerSeconds - 1);
        const timerEl = containerRef?.querySelector('.timer');
        if (timerEl) {
          timerEl.textContent = `${game.timerSeconds}s`;
          timerEl.classList.toggle('urgent', game.timerSeconds <= 10);
        }
        if (game.timerSeconds <= 0) clearInitialTimer();
      }, 1000);
    }

    // Sync pending direction choices
    if (auth.user?.id && game.pendingDirectionPlayerIds.includes(auth.user.id)) {
      game.needsDirectionChoice = true;
    }
  }).catch(() => {
    updateDOM();
  });

  // Show loading state initially
  container.innerHTML = '<div class="game-view"><div class="loading" style="text-align:center;padding:4rem;color:#888">Joining game...</div></div>';
}

export function unmount() {
  game.cleanupSocketListeners();
  clearInitialTimer();
  destroyBoardCanvas();
  containerRef = null;
  currentGameId = null;
}
