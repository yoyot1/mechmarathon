import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { EVENTS, GAME } from '@mechmarathon/shared';
import type {
  Card, GameState, CardsDealtPayload, ExecutePayload, PhaseChangePayload, GameOverPayload,
} from '@mechmarathon/shared';
import { getSocket } from '../lib/socket';

export const useGameStore = defineStore('game', () => {
  const gameState = ref<GameState | null>(null);
  const hand = ref<Card[]>([]);
  const program = ref<(Card | null)[]>(Array(GAME.REGISTERS_PER_ROUND).fill(null));
  const programSubmitted = ref(false);
  const timerSeconds = ref(0);
  const isExecuting = ref(false);
  const currentRegister = ref(-1);
  const winner = ref<string | null>(null);
  const error = ref<string | null>(null);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  // --- Computed ---

  const isProgramComplete = computed(() =>
    program.value.every((c) => c !== null),
  );

  const availableCards = computed(() => {
    const placedIds = new Set(
      program.value.filter((c): c is Card => c !== null).map((c) => c.id),
    );
    return hand.value.filter((c) => !placedIds.has(c.id));
  });

  const phase = computed(() => gameState.value?.phase ?? 'waiting');

  // --- Actions ---

  function joinGame(gameId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      if (!socket) {
        error.value = 'Not connected';
        reject(new Error('Not connected'));
        return;
      }

      socket.emit(
        EVENTS.GAME_STATE,
        { gameId },
        (res: { error?: string; state?: GameState; hand?: Card[] }) => {
          if (res.error) {
            error.value = res.error;
            reject(new Error(res.error));
            return;
          }
          if (res.state) gameState.value = res.state;
          if (res.hand) hand.value = res.hand;
          // Reset programming state
          program.value = Array(GAME.REGISTERS_PER_ROUND).fill(null);
          programSubmitted.value = false;
          resolve();
        },
      );
    });
  }

  function placeCard(card: Card, slotIndex: number): void {
    if (programSubmitted.value) return;
    if (slotIndex < 0 || slotIndex >= GAME.REGISTERS_PER_ROUND) return;

    // Remove from any other slot first
    program.value = program.value.map((c) =>
      c?.id === card.id ? null : c,
    );
    program.value[slotIndex] = card;
  }

  function removeCard(slotIndex: number): void {
    if (programSubmitted.value) return;
    if (slotIndex < 0 || slotIndex >= GAME.REGISTERS_PER_ROUND) return;
    program.value[slotIndex] = null;
  }

  function submitProgram(gameId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      if (!socket) {
        error.value = 'Not connected';
        reject(new Error('Not connected'));
        return;
      }

      if (!isProgramComplete.value) {
        error.value = 'Program all 5 registers first';
        reject(new Error('Incomplete'));
        return;
      }

      const cardIds = program.value.map((c) => c!.id);

      socket.emit(
        EVENTS.GAME_PROGRAM,
        { gameId, cardIds },
        (res: { error?: string }) => {
          if (res.error) {
            error.value = res.error;
            reject(new Error(res.error));
            return;
          }
          programSubmitted.value = true;
          resolve();
        },
      );
    });
  }

  // --- Socket listeners ---

  function initSocketListeners(): void {
    const socket = getSocket();
    if (!socket) return;

    socket.on(EVENTS.GAME_CARDS_DEALT, (payload: CardsDealtPayload) => {
      hand.value = payload.hand;
      program.value = Array(GAME.REGISTERS_PER_ROUND).fill(null);
      programSubmitted.value = false;
      isExecuting.value = false;
      currentRegister.value = -1;
      startTimer(payload.timerSeconds);
    });

    socket.on(EVENTS.GAME_PHASE_CHANGE, (payload: PhaseChangePayload) => {
      if (gameState.value) {
        gameState.value = { ...gameState.value, phase: payload.phase, round: payload.round };
      }
      if (payload.phase === 'executing') {
        isExecuting.value = true;
        stopTimer();
      }
      if (payload.phase === 'programming' && payload.timerSeconds) {
        isExecuting.value = false;
      }
    });

    socket.on(EVENTS.GAME_EXECUTE, (payload: ExecutePayload) => {
      currentRegister.value = payload.registerIndex;
      if (gameState.value) {
        gameState.value = { ...gameState.value, robots: payload.updatedRobots };
      }
    });

    socket.on(EVENTS.GAME_OVER, (payload: GameOverPayload) => {
      winner.value = payload.winnerId;
      if (gameState.value) {
        gameState.value = payload.finalState;
      }
      stopTimer();
      isExecuting.value = false;
    });
  }

  function cleanupSocketListeners(): void {
    const socket = getSocket();
    if (!socket) return;
    socket.off(EVENTS.GAME_CARDS_DEALT);
    socket.off(EVENTS.GAME_PHASE_CHANGE);
    socket.off(EVENTS.GAME_EXECUTE);
    socket.off(EVENTS.GAME_OVER);
    stopTimer();
  }

  function startTimer(seconds: number): void {
    stopTimer();
    timerSeconds.value = seconds;
    timerInterval = setInterval(() => {
      timerSeconds.value = Math.max(0, timerSeconds.value - 1);
      if (timerSeconds.value <= 0) stopTimer();
    }, 1000);
  }

  function stopTimer(): void {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function reset(): void {
    gameState.value = null;
    hand.value = [];
    program.value = Array(GAME.REGISTERS_PER_ROUND).fill(null);
    programSubmitted.value = false;
    timerSeconds.value = 0;
    isExecuting.value = false;
    currentRegister.value = -1;
    winner.value = null;
    error.value = null;
    stopTimer();
  }

  return {
    gameState,
    hand,
    program,
    programSubmitted,
    timerSeconds,
    isExecuting,
    currentRegister,
    winner,
    error,
    isProgramComplete,
    availableCards,
    phase,
    joinGame,
    placeCard,
    removeCard,
    submitProgram,
    initSocketListeners,
    cleanupSocketListeners,
    reset,
  };
});
