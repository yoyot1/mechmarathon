<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { useAuthStore } from '../stores/auth';
import { connectSocket } from '../lib/socket';
import BoardCanvas from '../components/BoardCanvas.vue';
import type { Card, Direction, ExecutionEvent, Robot } from '@mechmarathon/shared';
import { GAME, ROBOT_COLORS } from '@mechmarathon/shared';

const route = useRoute();
const router = useRouter();
const game = useGameStore();
const auth = useAuthStore();

const gameId = computed(() => route.params.id as string);

function cardLabel(card: Card): string {
  const labels: Record<string, string> = {
    move1: 'Move 1', move2: 'Move 2', move3: 'Move 3',
    backup: 'Backup', turn_left: 'Turn L', turn_right: 'Turn R', u_turn: 'U-Turn',
  };
  return labels[card.type] ?? card.type;
}

// --- Execution UI helpers ---

const programPlayerIds = computed(() => Object.keys(game.allPrograms));

function robotColor(robot: Robot): string {
  const idx = game.gameState?.robots.indexOf(robot) ?? 0;
  return ROBOT_COLORS[idx % ROBOT_COLORS.length];
}

function robotColorByPlayerId(playerId: string): string {
  const robot = game.gameState?.robots.find((r) => r.playerId === playerId);
  if (!robot) return '#666';
  return robotColor(robot);
}

const robotMoveEvents = computed(() =>
  game.currentRegisterEvents.filter(
    (e) => e.type === 'move' || e.type === 'rotate' || e.type === 'push' || e.type === 'fall' || e.type === 'respawn',
  ),
);

const boardElementEvents = computed(() =>
  game.currentRegisterEvents.filter(
    (e) => e.type === 'conveyor' || e.type === 'gear' || e.type === 'checkpoint' || e.type === 'repair',
  ),
);

function robotLabel(robotId: string): string {
  const idx = game.gameState?.robots.findIndex((r) => r.id === robotId) ?? -1;
  return idx >= 0 ? `Robot ${idx + 1}` : robotId;
}

function formatEvent(ev: ExecutionEvent): string {
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

// --- Direction picker ---

const showDirectionPicker = computed(() => {
  if (!auth.user?.id) return false;
  return game.pendingDirectionPlayerIds.includes(auth.user.id);
});

const isRespawnDirection = computed(() =>
  showDirectionPicker.value && game.directionChoiceReason === 'respawn',
);

const isInitialDirection = computed(() =>
  showDirectionPicker.value && game.directionChoiceReason === 'initial',
);

// Sync needsDirectionChoice based on pendingDirectionPlayerIds
watch(() => game.pendingDirectionPlayerIds, (ids) => {
  if (auth.user?.id && ids.includes(auth.user.id)) {
    game.needsDirectionChoice = true;
  }
}, { immediate: true });

function handleDirectionClick(dir: Direction): void {
  game.selectDirection(dir);
}

function handleConfirmDirection(): void {
  if (!game.chosenDirection) return;
  game.submitDirection(gameId.value, game.chosenDirection);
}

// --- Speed ---

function handleSpeedChange(speed: 1 | 2 | 3): void {
  game.setSpeed(gameId.value, speed);
}

// --- Debug mode ---

function handleDebugToggle(): void {
  game.toggleDebugMode(gameId.value);
}

function handleDebugStep(): void {
  game.debugStep(gameId.value);
}

function handleDebugStepBack(): void {
  game.debugStepBack(gameId.value);
}

// --- Leave / Exit ---

function handleLeave(): void {
  game.leaveGame(gameId.value);
  router.push('/lobby');
}

// --- Board legend ---

const legendOpen = ref(true);

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

function handleCardClick(card: Card): void {
  const emptySlot = game.program.findIndex((c) => c === null);
  if (emptySlot !== -1) {
    game.placeCard(card, emptySlot);
  }
}

function handleSlotClick(index: number): void {
  game.removeCard(index);
}

async function handleSubmit(): Promise<void> {
  try {
    await game.submitProgram(gameId.value);
  } catch {
    // error shown via store
  }
}

function handleBack(): void {
  game.reset();
  router.push('/lobby');
}

onMounted(async () => {
  const token = localStorage.getItem('mechmarathon_token');
  if (token) connectSocket(token);

  game.initSocketListeners();

  try {
    await game.joinGame(gameId.value);
  } catch {
    // error shown via store
  }
});

onUnmounted(() => {
  game.cleanupSocketListeners();
});
</script>

<template>
  <div class="game-view">
    <!-- Header -->
    <header class="game-header">
      <div class="header-info">
        <span class="round-badge">Round {{ game.gameState?.round ?? 0 }}</span>
        <span class="phase-badge" :class="game.phase">{{ game.phase }}</span>
        <span v-if="game.phase === 'programming' && game.timerSeconds > 0" class="timer" :class="{ urgent: game.timerSeconds <= 10 }">
          {{ game.timerSeconds }}s
        </span>
      </div>
      <div class="header-right">
        <div v-if="game.isExecuting" class="exec-info">
          <span>Register {{ game.currentRegister + 1 }} / 5</span>
          <span v-if="game.debugMode && game.debugStepLabel" class="step-info">
            {{ game.debugStepLabel }}
            <span class="step-counter">({{ game.debugStepIndex + 1 }}/{{ game.debugTotalSteps }})</span>
          </span>
        </div>
        <div class="speed-selector">
          <button
            v-for="s in [1, 2, 3] as const"
            :key="s"
            class="speed-btn"
            :class="{ active: game.executionSpeed === s }"
            @click="handleSpeedChange(s)"
          >{{ s }}x</button>
        </div>
        <button
          class="debug-toggle"
          :class="{ active: game.debugMode }"
          @click="handleDebugToggle"
          title="Step-through execution"
        >Debug</button>
        <button v-if="game.debugMode && game.isExecuting" class="btn btn-step-back" @click="handleDebugStepBack">
          &laquo; Back
        </button>
        <button v-if="game.debugMode && game.isExecuting" class="btn btn-step" @click="handleDebugStep">
          Step &raquo;
        </button>
        <button class="btn btn-leave" @click="handleLeave">Leave</button>
      </div>
    </header>

    <!-- Winner banner -->
    <div v-if="game.winner" class="winner-banner">
      <h2>Game Over!</h2>
      <p>
        {{ game.winner === auth.user?.id ? 'You win!' : 'You lose!' }}
      </p>
      <button class="btn" @click="handleBack">Back to Lobbies</button>
    </div>

    <!-- Error -->
    <p v-if="game.error" class="error">{{ game.error }}</p>

    <!-- Board + Legend sidebar -->
    <div class="board-area" v-if="game.gameState">
      <BoardCanvas />

      <!-- Legend sidebar -->
      <div class="legend-sidebar">
        <button class="legend-toggle" @click="legendOpen = !legendOpen">
          {{ legendOpen ? 'Hide' : 'Show' }} Legend
        </button>
        <div v-if="legendOpen" class="legend-list">
          <div v-for="item in legendItems" :key="item.label" class="legend-item">
            <div class="legend-swatch tile" :class="item.cls">
              <span v-if="item.arrow" class="legend-arrow" :class="{ gold: item.gold }">{{ item.arrow }}</span>
            </div>
            <span class="legend-label">{{ item.label }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Controls: Programming -->
    <div v-if="game.phase === 'programming' && !game.winner" class="controls">
      <div class="registers">
        <h3>Registers</h3>
        <div class="register-slots">
          <div
            v-for="(card, idx) in game.program"
            :key="idx"
            class="register-slot"
            :class="{ filled: card !== null }"
            @click="handleSlotClick(idx)"
          >
            <template v-if="card">
              <span class="card-name">{{ cardLabel(card) }}</span>
              <span class="card-priority">{{ card.priority }}</span>
            </template>
            <template v-else>
              <span class="slot-number">{{ idx + 1 }}</span>
            </template>
          </div>
        </div>

        <!-- Direction picker (initial — round 1) -->
        <div v-if="isInitialDirection" class="direction-picker-inline">
          <span class="direction-label">Starting Direction:</span>
          <div class="direction-compass">
            <button class="dir-btn dir-n" :class="{ selected: game.chosenDirection === 'north' }" @click="handleDirectionClick('north')">N</button>
            <button class="dir-btn dir-w" :class="{ selected: game.chosenDirection === 'west' }" @click="handleDirectionClick('west')">W</button>
            <button class="dir-btn dir-e" :class="{ selected: game.chosenDirection === 'east' }" @click="handleDirectionClick('east')">E</button>
            <button class="dir-btn dir-s" :class="{ selected: game.chosenDirection === 'south' }" @click="handleDirectionClick('south')">S</button>
          </div>
        </div>

        <button
          class="btn btn-submit"
          :disabled="!game.isProgramComplete || game.programSubmitted"
          @click="handleSubmit"
        >
          {{ game.programSubmitted ? 'Submitted' : 'Submit Program' }}
        </button>
      </div>

      <div class="hand">
        <h3>Hand</h3>
        <div class="hand-cards">
          <div
            v-for="card in game.availableCards"
            :key="card.id"
            class="hand-card"
            @click="handleCardClick(card)"
          >
            <span class="card-name">{{ cardLabel(card) }}</span>
            <span class="card-priority">{{ card.priority }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Controls: Executing -->
    <div v-else-if="game.phase === 'executing'" class="controls controls-executing">
      <!-- Programs Grid -->
      <div v-if="programPlayerIds.length > 0" class="programs-grid">
        <h3>Programs</h3>
        <div class="programs-table">
          <div class="programs-header">
            <div class="prog-label"></div>
            <div
              v-for="reg in GAME.REGISTERS_PER_ROUND"
              :key="reg"
              class="prog-reg-header"
              :class="{ current: reg - 1 === game.currentRegister, past: reg - 1 < game.currentRegister }"
            >
              R{{ reg }}
            </div>
          </div>
          <div
            v-for="playerId in programPlayerIds"
            :key="playerId"
            class="programs-row"
          >
            <div class="prog-label">
              <span class="prog-dot" :style="{ backgroundColor: robotColorByPlayerId(playerId) }" />
            </div>
            <div
              v-for="(card, idx) in game.allPrograms[playerId]"
              :key="idx"
              class="prog-card"
              :class="{ current: idx === game.currentRegister, past: idx < game.currentRegister }"
            >
              <span class="card-name">{{ cardLabel(card) }}</span>
              <span class="card-priority">{{ card.priority }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Execution Log -->
      <div class="exec-log" v-if="game.currentRegisterEvents.length > 0">
        <div v-if="robotMoveEvents.length > 0" class="log-section">
          <h4>Robot Moves</h4>
          <div v-for="(ev, i) in robotMoveEvents" :key="'m'+i" class="log-entry">
            {{ formatEvent(ev) }}
          </div>
        </div>
        <div v-if="boardElementEvents.length > 0" class="log-section">
          <h4>Board Elements</h4>
          <div v-for="(ev, i) in boardElementEvents" :key="'b'+i" class="log-entry">
            {{ formatEvent(ev) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Respawn direction picker (standalone panel during cleanup) -->
    <div v-if="isRespawnDirection" class="respawn-direction-panel">
      <h3>Choose Respawn Direction</h3>
      <span class="direction-timer" :class="{ urgent: game.directionTimeoutSeconds <= 5 }">{{ game.directionTimeoutSeconds }}s</span>
      <div class="direction-compass direction-compass-lg">
        <button class="dir-btn dir-n" :class="{ selected: game.chosenDirection === 'north' }" @click="handleDirectionClick('north')">N</button>
        <button class="dir-btn dir-w" :class="{ selected: game.chosenDirection === 'west' }" @click="handleDirectionClick('west')">W</button>
        <button class="dir-btn dir-e" :class="{ selected: game.chosenDirection === 'east' }" @click="handleDirectionClick('east')">E</button>
        <button class="dir-btn dir-s" :class="{ selected: game.chosenDirection === 'south' }" @click="handleDirectionClick('south')">S</button>
      </div>
      <button class="btn btn-submit" :disabled="!game.chosenDirection" @click="handleConfirmDirection">
        Confirm Direction
      </button>
    </div>

    <!-- Player info sidebar -->
    <div class="player-info" v-if="game.gameState">
      <div
        v-for="robot in game.gameState.robots"
        :key="robot.id"
        class="player-row"
        :class="{ dead: robot.lives <= 0, me: robot.playerId === auth.user?.id }"
      >
        <span class="player-dot" :style="{ backgroundColor: robotColor(robot) }" />
        <span v-if="robot.playerId === auth.user?.id" class="you-badge">You</span>
        <span class="player-stats">
          HP:{{ robot.health }} Lives:{{ robot.lives }} CP:{{ robot.checkpoint }}/{{ game.gameState.totalCheckpoints }}
        </span>
        <span v-if="robot.virtual" class="virtual-badge">virtual</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-view {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #0f0f1a;
  color: #eee;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.5rem;
  background: #1a1a2e;
  border-bottom: 1px solid #333;
}

.header-info {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.round-badge {
  background: #333;
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.85rem;
}

.phase-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
}

.phase-badge.programming { background: #2563eb; }
.phase-badge.executing { background: #dc2626; }
.phase-badge.cleanup { background: #6b7280; }
.phase-badge.finished { background: #16a34a; }

.timer {
  font-size: 1.1rem;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}

.timer.urgent {
  color: #ff4444;
}

.exec-info {
  font-size: 0.85rem;
  color: #888;
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.step-info {
  color: #ffd700;
  font-weight: 600;
  font-size: 0.8rem;
}

.step-counter {
  color: #888;
  font-weight: 400;
  font-size: 0.75rem;
}

.winner-banner {
  text-align: center;
  padding: 2rem;
  background: linear-gradient(135deg, #16a34a33, #2563eb33);
  border-bottom: 1px solid #16a34a;
}

.winner-banner h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.error {
  color: #ff4444;
  padding: 0.5rem 1.5rem;
  font-size: 0.9rem;
}

/* Board area — board + legend side by side */
.board-area {
  flex: 1;
  display: flex;
  overflow: auto;
}

/* Legend tile swatches (reuse tile-type colors) */
.tile { position: relative; }
.tile-floor { background: #2a2a3e; }
.tile-pit { background: #0a0a0a; }
.tile-conveyor { background: #1a3a1a; }
.tile-express_conveyor { background: #2a1a4a; }
.tile-gear_cw { background: #3a2a1a; }
.tile-gear_ccw { background: #3a1a2a; }
.tile-repair { background: #1a3a3a; }
.tile-wall { background: #4a4a4a; }
.tile-checkpoint { background: #3a3a1a; }
.tile-spawn { background: #2a2a3e; }
.tile-laser { background: #3a1a1a; }
.wall-south { border-bottom: 3px solid #ff8800; }

.you-badge {
  font-size: 0.65rem;
  font-weight: 700;
  color: #ffd700;
  background: rgba(255,215,0,0.15);
  padding: 0.05rem 0.3rem;
  border-radius: 0.2rem;
}

/* Controls */
.controls {
  padding: 1rem 1.5rem;
  background: #1a1a2e;
  border-top: 1px solid #333;
  display: flex;
  gap: 2rem;
}

.controls-executing {
  flex-direction: column;
  gap: 1rem;
  color: #ccc;
}

.registers h3,
.hand h3 {
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
  color: #888;
  text-transform: uppercase;
}

.register-slots {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.register-slot {
  width: 80px;
  height: 56px;
  border: 2px dashed #444;
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s;
}

.register-slot:hover {
  border-color: #666;
}

.register-slot.filled {
  border-style: solid;
  border-color: #7b2ff7;
  background: #1a1a3e;
}

.slot-number {
  color: #555;
  font-size: 1.2rem;
  font-weight: bold;
}

.hand-cards {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.hand-card {
  width: 80px;
  height: 56px;
  background: #2a2a3e;
  border: 2px solid #444;
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.hand-card:hover {
  border-color: #7b2ff7;
  transform: translateY(-2px);
}

.card-name {
  font-size: 0.75rem;
  font-weight: 600;
}

.card-priority {
  font-size: 0.65rem;
  color: #888;
}

.btn {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 0.5rem;
  background: #7b2ff7;
  color: white;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn:hover { opacity: 0.85; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-submit { background: #2ecc71; }

/* Player info */
.player-info {
  padding: 0.75rem 1.5rem;
  background: #161625;
  border-top: 1px solid #222;
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.player-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
}

.player-row.dead { opacity: 0.3; }
.player-row.me { font-weight: 600; }

.player-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.player-stats {
  color: #aaa;
  font-variant-numeric: tabular-nums;
}

.virtual-badge {
  font-size: 0.65rem;
  color: #888;
  background: #333;
  padding: 0.1rem 0.3rem;
  border-radius: 0.2rem;
}

/* Programs grid */
.programs-grid h3 {
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
  color: #888;
  text-transform: uppercase;
}

.programs-table {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.programs-header,
.programs-row {
  display: flex;
  gap: 4px;
  align-items: center;
}

.prog-label {
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.prog-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.prog-reg-header {
  width: 64px;
  text-align: center;
  font-size: 0.7rem;
  font-weight: 600;
  color: #666;
  padding: 2px 0;
}

.prog-reg-header.current {
  color: #ffd700;
}

.prog-reg-header.past {
  color: #555;
}

.prog-card {
  width: 64px;
  height: 40px;
  background: #2a2a3e;
  border: 1px solid #444;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
}

.prog-card.current {
  border-color: #ffd700;
  background: #3a3a1a;
}

.prog-card.past {
  opacity: 0.5;
}

/* Execution log */
.exec-log {
  display: flex;
  gap: 2rem;
  font-size: 0.75rem;
}

.log-section h4 {
  font-size: 0.7rem;
  color: #888;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.log-entry {
  color: #aaa;
  padding: 1px 0;
}

/* Speed selector */
.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.speed-selector {
  display: flex;
  gap: 2px;
}

.speed-btn {
  padding: 0.2rem 0.5rem;
  border: 1px solid #444;
  background: #2a2a3e;
  color: #aaa;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: all 0.15s;
}

.speed-btn:hover {
  border-color: #666;
  color: #eee;
}

.speed-btn.active {
  background: #7b2ff7;
  border-color: #7b2ff7;
  color: white;
}

/* Direction picker */
.direction-picker-inline {
  margin-bottom: 0.75rem;
}

.direction-label {
  font-size: 0.8rem;
  color: #888;
  display: block;
  margin-bottom: 0.25rem;
}

.direction-compass {
  display: grid;
  grid-template-areas:
    ". n ."
    "w . e"
    ". s .";
  grid-template-columns: 32px 32px 32px;
  grid-template-rows: 32px 32px 32px;
  gap: 2px;
}

.direction-compass-lg {
  grid-template-columns: 40px 40px 40px;
  grid-template-rows: 40px 40px 40px;
}

.dir-btn {
  border: 2px solid #444;
  background: #2a2a3e;
  color: #ccc;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dir-btn:hover {
  border-color: #666;
  color: #fff;
}

.dir-btn.selected {
  background: #b8860b;
  border-color: #ffd700;
  color: white;
}

.dir-n { grid-area: n; }
.dir-s { grid-area: s; }
.dir-e { grid-area: e; }
.dir-w { grid-area: w; }

/* Respawn direction panel */
.respawn-direction-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
  background: #1a1a2e;
  border-top: 1px solid #333;
}

.respawn-direction-panel h3 {
  font-size: 0.9rem;
  color: #ffd700;
  text-transform: uppercase;
}

.direction-timer {
  font-size: 1rem;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
  color: #ccc;
}

.direction-timer.urgent {
  color: #ff4444;
}

/* Legend sidebar */
.legend-sidebar {
  width: 150px;
  flex-shrink: 0;
  background: #161625;
  border-left: 1px solid #222;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
}

.legend-toggle {
  background: none;
  border: 1px solid #444;
  color: #888;
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.legend-toggle:hover {
  border-color: #666;
  color: #ccc;
}

.legend-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.legend-swatch {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  border: 1px solid #444;
  flex-shrink: 0;
}

.legend-arrow {
  font-size: 12px;
  opacity: 0.6;
}

.legend-arrow.gold {
  color: #ffd700;
  opacity: 1;
  font-size: 10px;
  font-weight: bold;
}

.legend-label {
  font-size: 0.7rem;
  color: #aaa;
  white-space: nowrap;
}

/* Debug & leave buttons */
.debug-toggle {
  padding: 0.2rem 0.5rem;
  border: 1px solid #444;
  background: #2a2a3e;
  color: #aaa;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: all 0.15s;
}

.debug-toggle:hover {
  border-color: #666;
  color: #eee;
}

.debug-toggle.active {
  background: #b8860b;
  border-color: #ffd700;
  color: white;
}

.btn-step,
.btn-step-back {
  background: #2563eb;
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
}

.btn-step-back {
  background: #555;
}

.btn-step-back:hover {
  background: #666;
}

.btn-leave {
  background: #555;
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
}

.btn-leave:hover {
  background: #dc2626;
}
</style>
