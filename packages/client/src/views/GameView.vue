<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/game';
import { useAuthStore } from '../stores/auth';
import { connectSocket } from '../lib/socket';
import type { Card, Robot, Tile, CheckpointConfig } from '@mechmarathon/shared';
import { ROBOT_COLORS } from '@mechmarathon/shared';

const route = useRoute();
const router = useRouter();
const game = useGameStore();
const auth = useAuthStore();

const gameId = computed(() => route.params.id as string);

const myRobot = computed(() =>
  game.gameState?.robots.find((r) => r.playerId === auth.user?.id),
);

const boardTiles = computed(() => game.gameState?.board.tiles ?? []);
const boardWidth = computed(() => game.gameState?.board.width ?? 16);
const checkpoints = computed(() => game.gameState?.checkpoints ?? []);

function tileClass(tile: Tile): string {
  return `tile tile-${tile.type}`;
}

function tileArrow(tile: Tile): string {
  if (!tile.direction) return '';
  const arrows: Record<string, string> = { north: '\u2191', south: '\u2193', east: '\u2192', west: '\u2190' };
  return arrows[tile.direction] ?? '';
}

function robotsAt(x: number, y: number): Robot[] {
  if (!game.gameState) return [];
  return game.gameState.robots.filter(
    (r) => r.lives > 0 && r.position.x === x && r.position.y === y,
  );
}

function checkpointAt(x: number, y: number): CheckpointConfig | undefined {
  return checkpoints.value.find((c) => c.position.x === x && c.position.y === y);
}

function robotColor(robot: Robot): string {
  const idx = game.gameState?.robots.indexOf(robot) ?? 0;
  return ROBOT_COLORS[idx % ROBOT_COLORS.length];
}

function directionArrow(dir: string): string {
  const arrows: Record<string, string> = { north: '\u25B2', south: '\u25BC', east: '\u25B6', west: '\u25C0' };
  return arrows[dir] ?? '';
}

function cardLabel(card: Card): string {
  const labels: Record<string, string> = {
    move1: 'Move 1', move2: 'Move 2', move3: 'Move 3',
    backup: 'Backup', turn_left: 'Turn L', turn_right: 'Turn R', u_turn: 'U-Turn',
  };
  return labels[card.type] ?? card.type;
}

function wallClasses(tile: Tile): string[] {
  if (!tile.walls?.length) return [];
  return tile.walls.map((w) => `wall-${w}`);
}

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
      <div v-if="game.isExecuting" class="exec-info">
        Register {{ game.currentRegister + 1 }} / 5
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

    <!-- Board -->
    <div class="board-wrapper" v-if="game.gameState">
      <div
        class="board-grid"
        :style="{ gridTemplateColumns: `repeat(${boardWidth}, 40px)` }"
      >
        <div
          v-for="(row, y) in boardTiles"
          v-bind:key="y"
          style="display: contents"
        >
          <div
            v-for="(tile, x) in row"
            v-bind:key="`${x}-${y}`"
            :class="[tileClass(tile), ...wallClasses(tile)]"
          >
            <span v-if="tileArrow(tile)" class="tile-arrow">{{ tileArrow(tile) }}</span>
            <span v-if="checkpointAt(x, y)" class="checkpoint-overlay">
              {{ checkpointAt(x, y)!.number }}
            </span>
            <div
              v-for="robot in robotsAt(x, y)"
              :key="robot.id"
              class="robot"
              :class="{ virtual: robot.virtual, mine: robot.playerId === auth.user?.id }"
              :style="{ backgroundColor: robotColor(robot) }"
              :title="`${robot.playerId} HP:${robot.health} Lives:${robot.lives} CP:${robot.checkpoint}`"
            >
              {{ directionArrow(robot.direction) }}
            </div>
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
      <p>Executing register {{ game.currentRegister + 1 }} of 5...</p>
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

/* Board */
.board-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  overflow: auto;
}

.board-grid {
  display: grid;
  gap: 1px;
  background: #222;
  border: 2px solid #444;
}

.tile {
  width: 40px;
  height: 40px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}

.tile-floor { background: #2a2a3e; }
.tile-pit { background: #0a0a0a; }
.tile-conveyor { background: #1a3a1a; }
.tile-express_conveyor { background: #1a1a3a; }
.tile-gear_cw { background: #3a2a1a; }
.tile-gear_ccw { background: #3a1a2a; }
.tile-repair { background: #1a3a3a; }
.tile-wall { background: #4a4a4a; }
.tile-checkpoint { background: #3a3a1a; }
.tile-spawn { background: #2a2a3e; }
.tile-laser { background: #3a1a1a; }

/* Walls */
.wall-north { border-top: 3px solid #ff8800; }
.wall-south { border-bottom: 3px solid #ff8800; }
.wall-east { border-right: 3px solid #ff8800; }
.wall-west { border-left: 3px solid #ff8800; }

.tile-arrow {
  position: absolute;
  font-size: 14px;
  opacity: 0.4;
  pointer-events: none;
}

.checkpoint-overlay {
  position: absolute;
  top: 1px;
  right: 2px;
  font-size: 9px;
  font-weight: bold;
  color: #ffd700;
  background: rgba(0,0,0,0.6);
  border-radius: 50%;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.robot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: white;
  z-index: 10;
  position: absolute;
  border: 2px solid rgba(255,255,255,0.3);
}

.robot.virtual {
  opacity: 0.5;
  border-style: dashed;
}

.robot.mine {
  border-color: #ffd700;
  border-width: 2px;
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
  justify-content: center;
  color: #888;
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
</style>
