import { EVENTS, GAME } from '@mechmarathon/shared';
import { getSocket } from '../lib/socket.js';

export const game = {
  gameState: null,
  hand: [],
  program: Array(GAME.REGISTERS_PER_ROUND).fill(null),
  programSubmitted: false,
  timerSeconds: 0,
  isExecuting: false,
  currentRegister: -1,
  winner: null,
  error: null,
  allPrograms: {},
  currentRegisterEvents: [],
  executionSpeed: 1,
  needsDirectionChoice: false,
  chosenDirection: null,
  directionChoiceReason: 'initial',
  directionTimeoutSeconds: 0,
  pendingDirectionPlayerIds: [],
  debugMode: false,
  debugStepIndex: -1,
  debugTotalSteps: 0,
  debugStepLabel: '',

  _timerInterval: null,
  _directionTimerInterval: null,
  _callbacks: null,

  // --- Getters ---

  isProgramComplete() {
    const allFilled = this.program.every((c) => c !== null);
    if (!allFilled) return false;
    // If initial direction choice is needed, require it
    if (this.needsDirectionChoice && this.directionChoiceReason === 'initial' && !this.chosenDirection) {
      return false;
    }
    return true;
  },

  availableCards() {
    const placedIds = new Set(
      this.program.filter((c) => c !== null).map((c) => c.id),
    );
    return this.hand.filter((c) => !placedIds.has(c.id));
  },

  phase() {
    return this.gameState?.phase ?? 'waiting';
  },

  // --- Actions ---

  joinGame(gameId) {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      if (!socket) {
        this.error = 'Not connected';
        reject(new Error('Not connected'));
        return;
      }

      socket.emit(
        EVENTS.GAME_STATE,
        { gameId },
        (res) => {
          if (res.error) {
            this.error = res.error;
            reject(new Error(res.error));
            return;
          }
          if (res.state) {
            this.gameState = res.state;
            this.executionSpeed = res.state.executionSpeed;
            this.debugMode = res.state.debugMode;
          }
          if (res.hand) this.hand = res.hand;
          // Reset programming state
          this.program = Array(GAME.REGISTERS_PER_ROUND).fill(null);
          this.programSubmitted = false;
          this.chosenDirection = null;
          this.needsDirectionChoice = false;
          // Sync pending direction choices from state
          if (res.state && res.state.pendingDirectionChoices.length > 0) {
            this.directionChoiceReason = 'initial';
            this.pendingDirectionPlayerIds = res.state.pendingDirectionChoices;
          }
          resolve();
        },
      );
    });
  },

  placeCard(card, slotIndex) {
    if (this.programSubmitted) return;
    if (slotIndex < 0 || slotIndex >= GAME.REGISTERS_PER_ROUND) return;

    // Remove from any other slot first
    this.program = this.program.map((c) =>
      c?.id === card.id ? null : c,
    );
    this.program[slotIndex] = card;
  },

  removeCard(slotIndex) {
    if (this.programSubmitted) return;
    if (slotIndex < 0 || slotIndex >= GAME.REGISTERS_PER_ROUND) return;
    this.program[slotIndex] = null;
  },

  submitProgram(gameId) {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      if (!socket) {
        this.error = 'Not connected';
        reject(new Error('Not connected'));
        return;
      }

      if (!this.isProgramComplete()) {
        this.error = 'Program all 5 registers first';
        reject(new Error('Incomplete'));
        return;
      }

      const cardIds = this.program.map((c) => c.id);
      const payload = { gameId, cardIds };
      if (this.needsDirectionChoice && this.directionChoiceReason === 'initial' && this.chosenDirection) {
        payload.direction = this.chosenDirection;
      }

      socket.emit(
        EVENTS.GAME_PROGRAM,
        payload,
        (res) => {
          if (res.error) {
            this.error = res.error;
            reject(new Error(res.error));
            return;
          }
          this.programSubmitted = true;
          resolve();
        },
      );
    });
  },

  selectDirection(dir) {
    this.chosenDirection = dir;
  },

  setSpeed(gameId, speed) {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(EVENTS.GAME_SPEED, { gameId, speed }, (res) => {
      if (res.error) this.error = res.error;
    });
  },

  toggleDebugMode(gameId) {
    const socket = getSocket();
    if (!socket) return;
    const newMode = !this.debugMode;
    socket.emit(EVENTS.GAME_DEBUG_MODE, { gameId, enabled: newMode }, (res) => {
      if (res.error) this.error = res.error;
    });
  },

  debugStep(gameId) {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(EVENTS.GAME_DEBUG_STEP, { gameId }, (res) => {
      if (res.error) this.error = res.error;
    });
  },

  debugStepBack(gameId) {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(EVENTS.GAME_DEBUG_STEP_BACK, { gameId }, (res) => {
      if (res.error) this.error = res.error;
    });
  },

  leaveGame(gameId) {
    const socket = getSocket();
    if (!socket) return;
    socket.emit(EVENTS.GAME_LEAVE, { gameId });
    this.reset();
  },

  submitDirection(gameId, dir) {
    const socket = getSocket();
    if (!socket) return;
    this.chosenDirection = dir;
    socket.emit(EVENTS.GAME_CHOOSE_DIRECTION, { gameId, direction: dir }, (res) => {
      if (res.error) {
        this.error = res.error;
      } else {
        this.needsDirectionChoice = false;
      }
    });
  },

  // --- Socket listeners ---

  initSocketListeners(callbacks) {
    this._callbacks = callbacks || {};
    const socket = getSocket();
    if (!socket) return;

    socket.on(EVENTS.GAME_CARDS_DEALT, (payload) => {
      this.hand = payload.hand;
      this.program = Array(GAME.REGISTERS_PER_ROUND).fill(null);
      this.programSubmitted = false;
      this.isExecuting = false;
      this.currentRegister = -1;
      this.allPrograms = {};
      this.currentRegisterEvents = [];
      this.debugStepIndex = -1;
      this.debugTotalSteps = 0;
      this.debugStepLabel = '';
      this.chosenDirection = null;
      this.needsDirectionChoice = false;
      this.pendingDirectionPlayerIds = [];
      this._startTimer(payload.timerSeconds);
      this._callbacks.onCardsDealt?.();
    });

    socket.on(EVENTS.GAME_PROGRAMS, (payload) => {
      this.allPrograms = payload.programs;
      this._callbacks.onPrograms?.();
    });

    socket.on(EVENTS.GAME_PHASE_CHANGE, (payload) => {
      if (this.gameState) {
        this.gameState = { ...this.gameState, phase: payload.phase, round: payload.round };
      }
      if (payload.phase === 'executing') {
        this.isExecuting = true;
        this._stopTimer();
      }
      if (payload.phase === 'programming' && payload.timerSeconds) {
        this.isExecuting = false;
      }
      this._callbacks.onPhaseChange?.(payload);
    });

    socket.on(EVENTS.GAME_EXECUTE, (payload) => {
      this.currentRegister = payload.registerIndex;
      this.currentRegisterEvents = payload.events;
      this.debugStepIndex = payload.stepIndex;
      this.debugTotalSteps = payload.totalSteps;
      this.debugStepLabel = payload.stepLabel;
      if (this.gameState) {
        this.gameState = { ...this.gameState, robots: payload.updatedRobots };
      }
      this._callbacks.onExecute?.(payload);
    });

    socket.on(EVENTS.GAME_OVER, (payload) => {
      this.winner = payload.winnerId;
      if (this.gameState) {
        this.gameState = payload.finalState;
      }
      this._stopTimer();
      this.isExecuting = false;
      this._callbacks.onGameOver?.(payload);
    });

    socket.on(EVENTS.GAME_SPEED, (payload) => {
      this.executionSpeed = payload.speed;
      this._callbacks.onSpeedChange?.(payload);
    });

    socket.on(EVENTS.GAME_DIRECTION_NEEDED, (payload) => {
      this.directionChoiceReason = payload.reason;
      this.directionTimeoutSeconds = payload.timeoutSeconds;
      this.pendingDirectionPlayerIds = payload.playerIds;
      this.chosenDirection = null;
      this._startDirectionTimer(payload.timeoutSeconds);
      this._callbacks.onDirectionNeeded?.(payload);
    });

    socket.on(EVENTS.GAME_DEBUG_MODE, (payload) => {
      this.debugMode = payload.enabled;
      this._callbacks.onDebugMode?.(payload);
    });
  },

  cleanupSocketListeners() {
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
    this._stopTimer();
    this._stopDirectionTimer();
    this._callbacks = null;
  },

  _startTimer(seconds) {
    this._stopTimer();
    this.timerSeconds = seconds;
    this._timerInterval = setInterval(() => {
      this.timerSeconds = Math.max(0, this.timerSeconds - 1);
      this._callbacks?.onTimerTick?.(this.timerSeconds);
      if (this.timerSeconds <= 0) this._stopTimer();
    }, 1000);
  },

  _stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  },

  _startDirectionTimer(seconds) {
    this._stopDirectionTimer();
    this.directionTimeoutSeconds = seconds;
    this._directionTimerInterval = setInterval(() => {
      this.directionTimeoutSeconds = Math.max(0, this.directionTimeoutSeconds - 1);
      this._callbacks?.onDirectionTimerTick?.(this.directionTimeoutSeconds);
      if (this.directionTimeoutSeconds <= 0) this._stopDirectionTimer();
    }, 1000);
  },

  _stopDirectionTimer() {
    if (this._directionTimerInterval) {
      clearInterval(this._directionTimerInterval);
      this._directionTimerInterval = null;
    }
  },

  reset() {
    this.gameState = null;
    this.hand = [];
    this.program = Array(GAME.REGISTERS_PER_ROUND).fill(null);
    this.programSubmitted = false;
    this.timerSeconds = 0;
    this.isExecuting = false;
    this.currentRegister = -1;
    this.winner = null;
    this.error = null;
    this.allPrograms = {};
    this.currentRegisterEvents = [];
    this.executionSpeed = 1;
    this.debugMode = false;
    this.debugStepIndex = -1;
    this.debugTotalSteps = 0;
    this.debugStepLabel = '';
    this.needsDirectionChoice = false;
    this.chosenDirection = null;
    this.directionChoiceReason = 'initial';
    this.directionTimeoutSeconds = 0;
    this.pendingDirectionPlayerIds = [];
    this._stopTimer();
    this._stopDirectionTimer();
  },
};
