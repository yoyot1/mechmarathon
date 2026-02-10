import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { EVENTS, GAME } from '@mechmarathon/shared';
import type {
  Card, Direction, ExecutionEvent, GameState, CardsDealtPayload, ExecutePayload,
  PhaseChangePayload, GameOverPayload, ProgramsPayload, SpeedChangePayload,
  DirectionNeededPayload, DebugModePayload,
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
  const allPrograms = ref<Record<string, Card[]>>({});
  const currentRegisterEvents = ref<ExecutionEvent[]>([]);
  const executionSpeed = ref<1 | 2 | 3>(1);
  const needsDirectionChoice = ref(false);
  const chosenDirection = ref<Direction | null>(null);
  const directionChoiceReason = ref<'initial' | 'respawn'>('initial');
  const directionTimeoutSeconds = ref(0);
  const pendingDirectionPlayerIds = ref<string[]>([]);
  const debugMode = ref(false);
  const debugStepIndex = ref(-1);
  const debugTotalSteps = ref(0);
  const debugStepLabel = ref('');
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let directionTimerInterval: ReturnType<typeof setInterval> | null = null;

  // --- Computed ---

  const isProgramComplete = computed(() => {
    const allFilled = program.value.every((c) => c !== null);
    if (!allFilled) return false;
    // If initial direction choice is needed, require it
    if (needsDirectionChoice.value && directionChoiceReason.value === 'initial' && !chosenDirection.value) {
      return false;
    }
    return true;
  });

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
          if (res.state) {
            gameState.value = res.state;
            executionSpeed.value = res.state.executionSpeed;
            debugMode.value = res.state.debugMode;
          }
          if (res.hand) hand.value = res.hand;
          // Reset programming state
          program.value = Array(GAME.REGISTERS_PER_ROUND).fill(null);
          programSubmitted.value = false;
          chosenDirection.value = null;
          needsDirectionChoice.value = false;
          // Sync pending direction choices from state (after resetting needsDirectionChoice,
          // so the view watcher can re-set it based on current user)
          if (res.state && res.state.pendingDirectionChoices.length > 0) {
            directionChoiceReason.value = 'initial';
            pendingDirectionPlayerIds.value = res.state.pendingDirectionChoices;
          }
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
      const payload: { gameId: string; cardIds: string[]; direction?: Direction } = { gameId, cardIds };
      if (needsDirectionChoice.value && directionChoiceReason.value === 'initial' && chosenDirection.value) {
        payload.direction = chosenDirection.value;
      }

      socket.emit(
        EVENTS.GAME_PROGRAM,
        payload,
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

  function selectDirection(dir: Direction): void {
    chosenDirection.value = dir;
  }

  function setSpeed(gameId: string, speed: 1 | 2 | 3): void {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(EVENTS.GAME_SPEED, { gameId, speed }, (res: { error?: string }) => {
      if (res.error) error.value = res.error;
    });
  }

  function toggleDebugMode(gameId: string): void {
    const socket = getSocket();
    if (!socket) return;
    const newMode = !debugMode.value;
    socket.emit(EVENTS.GAME_DEBUG_MODE, { gameId, enabled: newMode }, (res: { error?: string }) => {
      if (res.error) error.value = res.error;
    });
  }

  function debugStep(gameId: string): void {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(EVENTS.GAME_DEBUG_STEP, { gameId }, (res: { error?: string }) => {
      if (res.error) error.value = res.error;
    });
  }

  function debugStepBack(gameId: string): void {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(EVENTS.GAME_DEBUG_STEP_BACK, { gameId }, (res: { error?: string }) => {
      if (res.error) error.value = res.error;
    });
  }

  function leaveGame(gameId: string): void {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(EVENTS.GAME_LEAVE, { gameId });
    reset();
  }

  function submitDirection(gameId: string, dir: Direction): void {
    const socket = getSocket();
    if (!socket) return;
    chosenDirection.value = dir;
    socket.emit(EVENTS.GAME_CHOOSE_DIRECTION, { gameId, direction: dir }, (res: { error?: string }) => {
      if (res.error) {
        error.value = res.error;
      } else {
        needsDirectionChoice.value = false;
      }
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
      allPrograms.value = {};
      currentRegisterEvents.value = [];
      debugStepIndex.value = -1;
      debugTotalSteps.value = 0;
      debugStepLabel.value = '';
      chosenDirection.value = null;
      // Don't reset needsDirectionChoice here — GAME_DIRECTION_NEEDED will set it
      startTimer(payload.timerSeconds);
    });

    socket.on(EVENTS.GAME_PROGRAMS, (payload: ProgramsPayload) => {
      allPrograms.value = payload.programs;
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
      currentRegisterEvents.value = payload.events;
      debugStepIndex.value = payload.stepIndex;
      debugTotalSteps.value = payload.totalSteps;
      debugStepLabel.value = payload.stepLabel;
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

    socket.on(EVENTS.GAME_SPEED, (payload: SpeedChangePayload) => {
      executionSpeed.value = payload.speed;
    });

    socket.on(EVENTS.GAME_DIRECTION_NEEDED, (payload: DirectionNeededPayload) => {
      directionChoiceReason.value = payload.reason;
      directionTimeoutSeconds.value = payload.timeoutSeconds;
      pendingDirectionPlayerIds.value = payload.playerIds;
      chosenDirection.value = null;
      startDirectionTimer(payload.timeoutSeconds);
    });

    socket.on(EVENTS.GAME_DEBUG_MODE, (payload: DebugModePayload) => {
      debugMode.value = payload.enabled;
    });
  }

  function cleanupSocketListeners(): void {
    const socket = getSocket();
    if (!socket) return;
    socket.off(EVENTS.GAME_CARDS_DEALT);
    socket.off(EVENTS.GAME_PROGRAMS);
    socket.off(EVENTS.GAME_PHASE_CHANGE);
    socket.off(EVENTS.GAME_EXECUTE);
    socket.off(EVENTS.GAME_OVER);
    socket.off(EVENTS.GAME_SPEED);
    socket.off(EVENTS.GAME_DIRECTION_NEEDED);
    socket.off(EVENTS.GAME_DEBUG_MODE);
    stopTimer();
    stopDirectionTimer();
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

  function startDirectionTimer(seconds: number): void {
    stopDirectionTimer();
    directionTimeoutSeconds.value = seconds;
    directionTimerInterval = setInterval(() => {
      directionTimeoutSeconds.value = Math.max(0, directionTimeoutSeconds.value - 1);
      if (directionTimeoutSeconds.value <= 0) stopDirectionTimer();
    }, 1000);
  }

  function stopDirectionTimer(): void {
    if (directionTimerInterval) {
      clearInterval(directionTimerInterval);
      directionTimerInterval = null;
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
    allPrograms.value = {};
    currentRegisterEvents.value = [];
    executionSpeed.value = 1;
    debugMode.value = false;
    debugStepIndex.value = -1;
    debugTotalSteps.value = 0;
    debugStepLabel.value = '';
    needsDirectionChoice.value = false;
    chosenDirection.value = null;
    directionChoiceReason.value = 'initial';
    directionTimeoutSeconds.value = 0;
    pendingDirectionPlayerIds.value = [];
    stopTimer();
    stopDirectionTimer();
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
    allPrograms,
    currentRegisterEvents,
    executionSpeed,
    needsDirectionChoice,
    chosenDirection,
    directionChoiceReason,
    directionTimeoutSeconds,
    pendingDirectionPlayerIds,
    debugMode,
    debugStepIndex,
    debugTotalSteps,
    debugStepLabel,
    isProgramComplete,
    availableCards,
    phase,
    joinGame,
    placeCard,
    removeCard,
    submitProgram,
    selectDirection,
    setSpeed,
    submitDirection,
    toggleDebugMode,
    debugStep,
    debugStepBack,
    leaveGame,
    initSocketListeners,
    cleanupSocketListeners,
    reset,
  };
});
