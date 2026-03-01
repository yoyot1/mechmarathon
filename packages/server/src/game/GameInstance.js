import {
  EVENTS, GAME, SPEED, ROBOT_COLORS,
  createDeck, shuffleDeck, dealCards, executeRegisterSteps, checkWinCondition, updateVirtualStatus,
  processCheckpoints, handleRobotDeath,
  DEFAULT_BOARD, getDefaultCheckpoints,
} from '@mechmarathon/shared';

export class GameInstance {
  constructor(id, playerInfos, io, botPlayerIds) {
    this.id = id;
    this.io = io;
    this.playerInfos = playerInfos;
    this.hands = new Map();
    this.programs = new Map();
    this.disconnectedPlayers = new Set();
    this.programmingTimer = null;
    this.programmingTimerStart = 0;
    this.botPlayerIds = new Set();
    this.executionSpeed = 1;
    this.pendingDirectionChoices = new Set();
    this.directionChoiceTimer = null;
    this.directionResolve = null;
    this.debugMode = false;
    this.debugActionResolve = null;
    this.phase = 'waiting';
    this.round = 0;
    this.winnerId = null;

    // Use default board
    this.board = {
      width: DEFAULT_BOARD.width,
      height: DEFAULT_BOARD.height,
      tiles: DEFAULT_BOARD.tiles,
    };
    this.checkpoints = getDefaultCheckpoints();

    // Place all robots on checkpoint 1 (all virtual)
    const startPos = this.checkpoints.find((c) => c.number === 1).position;
    this.robots = playerInfos.map((p, i) => ({
      id: `robot-${i}`,
      playerId: p.userId,
      position: { ...startPos },
      direction: 'north',
      health: GAME.STARTING_HEALTH,
      lives: GAME.STARTING_LIVES,
      checkpoint: 0,
      virtual: true,
      archivePosition: { ...startPos },
    }));

    // Auto-capture checkpoint 1 since robots start on it
    processCheckpoints(this.robots, this.checkpoints);

    if (botPlayerIds) {
      for (const id of botPlayerIds) this.botPlayerIds.add(id);
    }

    // All players need to choose initial direction in round 1
    for (const p of playerInfos) {
      this.pendingDirectionChoices.add(p.userId);
    }

    this.startRound();
  }

  gameRoom() {
    return `game:${this.id}`;
  }

  startRound() {
    this.round++;
    this.programs.clear();
    this.hands.clear();

    // Create, shuffle, and deal deck
    const deck = shuffleDeck(createDeck());
    const alivePlayerIds = this.robots
      .filter((r) => r.lives > 0)
      .map((r) => r.playerId);

    const healthMap = new Map();
    for (const robot of this.robots) {
      healthMap.set(robot.playerId, robot.health);
    }

    const { hands } = dealCards(deck, alivePlayerIds, healthMap);
    this.hands = hands;

    // Initialize empty programs
    for (const playerId of alivePlayerIds) {
      this.programs.set(playerId, Array(GAME.REGISTERS_PER_ROUND).fill(null));
    }

    // Set phase and notify
    this.phase = 'programming';

    // Emit phase change
    this.broadcastPhaseChange();

    // Send each player their hand
    for (const [playerId, hand] of this.hands) {
      const socketIds = this.getPlayerSocketIds(playerId);
      for (const sid of socketIds) {
        this.io.to(sid).emit(EVENTS.GAME_CARDS_DEALT, {
          hand,
          timerSeconds: GAME.PROGRAMMING_TIMER_SECONDS,
        });
      }
    }

    // If any players need to choose direction, notify them
    if (this.pendingDirectionChoices.size > 0) {
      const payload = {
        playerIds: [...this.pendingDirectionChoices],
        reason: 'initial',
        timeoutSeconds: SPEED.DIRECTION_CHOICE_TIMEOUT_SECONDS,
      };
      this.io.to(this.gameRoom()).emit(EVENTS.GAME_DIRECTION_NEEDED, payload);

      // Auto-choose for bots
      for (const botId of this.botPlayerIds) {
        if (this.pendingDirectionChoices.has(botId)) {
          const dirs = ['north', 'east', 'south', 'west'];
          const robot = this.robots.find((r) => r.playerId === botId);
          if (robot) {
            robot.direction = dirs[Math.floor(Math.random() * dirs.length)];
          }
          this.pendingDirectionChoices.delete(botId);
        }
      }
    }

    // Start programming timer
    this.programmingTimerStart = Date.now();
    this.programmingTimer = setTimeout(() => {
      this.onProgrammingTimerExpired();
    }, GAME.PROGRAMMING_TIMER_SECONDS * 1000);

    // Auto-program bots after a short delay
    this.submitBotPrograms();
  }

  submitProgram(userId, cardIds, direction) {
    if (this.phase !== 'programming') {
      return { error: 'Not in programming phase' };
    }

    const hand = this.hands.get(userId);
    if (!hand) return { error: 'No hand for this player' };

    if (cardIds.length !== GAME.REGISTERS_PER_ROUND) {
      return { error: `Must program exactly ${GAME.REGISTERS_PER_ROUND} registers` };
    }

    // If player needs to choose direction, require it
    if (this.pendingDirectionChoices.has(userId)) {
      if (!direction) return { error: 'Must choose a starting direction' };
      const robot = this.robots.find((r) => r.playerId === userId);
      if (robot) robot.direction = direction;
      this.pendingDirectionChoices.delete(userId);
    }

    // Validate all card IDs are from the player's hand
    const handIds = new Set(hand.map((c) => c.id));
    const usedIds = new Set();
    const program = [];

    for (const cardId of cardIds) {
      if (!handIds.has(cardId)) return { error: `Card ${cardId} not in your hand` };
      if (usedIds.has(cardId)) return { error: `Card ${cardId} used twice` };
      usedIds.add(cardId);
      program.push(hand.find((c) => c.id === cardId));
    }

    this.programs.set(userId, program);

    // Check if all alive players have submitted
    if (this.allProgramsSubmitted()) {
      this.startExecution();
    }

    return {};
  }

  allProgramsSubmitted() {
    for (const robot of this.robots) {
      if (robot.lives <= 0) continue;
      const program = this.programs.get(robot.playerId);
      if (!program || program.some((c) => c === null)) return false;
    }
    return true;
  }

  onProgrammingTimerExpired() {
    this.programmingTimer = null;

    // Auto-choose direction for players who haven't chosen
    for (const playerId of this.pendingDirectionChoices) {
      // Default to north
      const robot = this.robots.find((r) => r.playerId === playerId);
      if (robot) robot.direction = 'north';
    }
    this.pendingDirectionChoices.clear();

    // Auto-fill programs for players who haven't submitted
    for (const robot of this.robots) {
      if (robot.lives <= 0) continue;
      const program = this.programs.get(robot.playerId);
      if (!program) continue;

      const hand = this.hands.get(robot.playerId);
      if (!hand) continue;

      const usedIds = new Set(
        program.filter((c) => c !== null).map((c) => c.id),
      );
      const available = hand.filter((c) => !usedIds.has(c.id));

      for (let i = 0; i < GAME.REGISTERS_PER_ROUND; i++) {
        if (program[i] === null && available.length > 0) {
          program[i] = available.shift();
        }
      }

      this.programs.set(robot.playerId, program);
    }

    this.startExecution();
  }

  async startExecution() {
    if (this.programmingTimer) {
      clearTimeout(this.programmingTimer);
      this.programmingTimer = null;
    }

    this.phase = 'executing';
    this.broadcastPhaseChange();

    // Broadcast all players' programs so clients can display them
    const programsRecord = {};
    for (const [playerId, prog] of this.programs) {
      const cards = prog.filter((c) => c !== null);
      programsRecord[playerId] = cards;
    }
    const programsPayload = { programs: programsRecord };
    this.io.to(this.gameRoom()).emit(EVENTS.GAME_PROGRAMS, programsPayload);

    // Pre-compute all execution steps across all registers
    const allRegisters = [];

    for (let reg = 0; reg < GAME.REGISTERS_PER_ROUND; reg++) {
      const playerCards = new Map();
      for (const robot of this.robots) {
        if (robot.lives <= 0 || robot.health <= 0) continue;
        const program = this.programs.get(robot.playerId);
        if (!program) continue;
        const card = program[reg];
        if (card) playerCards.set(robot.playerId, card);
      }

      const steps = executeRegisterSteps(reg, playerCards, this.robots, this.board, this.checkpoints);
      updateVirtualStatus(this.robots);
      allRegisters.push({ registerIndex: reg, steps });
    }

    // After all registers: check the final checkpoint.
    // Credit it if a robot is standing on it (no archive update for the final flag).
    const maxCp = this.checkpoints.length > 0
      ? Math.max(...this.checkpoints.map((c) => c.number))
      : 0;
    for (const robot of this.robots) {
      if (robot.lives <= 0 || robot.health <= 0) continue;
      const nextCp = robot.checkpoint + 1;
      if (nextCp !== maxCp) continue;
      const cp = this.checkpoints.find((c) => c.number === nextCp);
      if (cp && robot.position.x === cp.position.x && robot.position.y === cp.position.y) {
        robot.checkpoint = nextCp;
        // No archive update for the final flag
      }
    }

    const winnerId = checkWinCondition(this.robots, this.checkpoints.length);

    if (this.debugMode) {
      // Build a flat list of all steps across all registers for navigation
      const globalSteps = [];
      for (const reg of allRegisters) {
        for (let i = 0; i < reg.steps.length; i++) {
          globalSteps.push({
            registerIndex: reg.registerIndex,
            step: reg.steps[i],
            localIndex: i,
            localTotal: reg.steps.length,
          });
        }
      }

      if (globalSteps.length > 0) {
        let idx = 0;
        this.broadcastDebugStep(globalSteps, idx);

        // Navigate through steps: forward advances, back goes to previous
        while (idx < globalSteps.length - 1) {
          const action = await this.waitForDebugAction();
          if (action === 'forward') {
            idx++;
            this.broadcastDebugStep(globalSteps, idx);
          } else if (action === 'back') {
            if (idx > 0) {
              idx--;
              this.broadcastDebugStep(globalSteps, idx);
            }
          }
        }
        // Wait for final forward step to advance past the last step
        await this.waitForDebugAction();
      }
    } else {
      // Non-debug: broadcast each register's events as a single payload with animation delays
      for (let i = 0; i < allRegisters.length; i++) {
        const reg = allRegisters[i];
        const allEvents = reg.steps.flatMap((s) => s.events);
        const robotsAfter = reg.steps.length > 0
          ? reg.steps[reg.steps.length - 1].robotsAfter
          : this.robots.map((r) => ({ ...r, position: { ...r.position } }));

        const payload = {
          registerIndex: reg.registerIndex,
          stepIndex: -1,
          totalSteps: -1,
          stepLabel: '',
          events: allEvents,
          updatedRobots: robotsAfter,
        };
        this.io.to(this.gameRoom()).emit(EVENTS.GAME_EXECUTE, payload);

        if (i < allRegisters.length - 1) {
          await this.delay(SPEED.REGISTER_DELAY_MS / this.executionSpeed);
        }
      }
    }

    // Check win after full turn
    if (winnerId) {
      this.winnerId = winnerId;
      this.phase = 'finished';
      const gameOverPayload = {
        winnerId,
        finalState: this.toGameState(),
      };
      this.io.to(this.gameRoom()).emit(EVENTS.GAME_OVER, gameOverPayload);
      return;
    }

    // Round complete — cleanup phase
    this.phase = 'cleanup';
    this.broadcastPhaseChange();

    // Respawn dead robots (those who died during this round but have lives left)
    const respawnEvents = [];
    const respawnedPlayers = [];
    for (const robot of this.robots) {
      if (robot.health <= 0 && robot.lives > 0) {
        respawnEvents.push(...handleRobotDeath(robot));
        respawnedPlayers.push(robot.playerId);
      }
    }

    if (respawnEvents.length > 0) {
      const respawnPayload = {
        registerIndex: -1,
        stepIndex: -1,
        totalSteps: -1,
        stepLabel: 'Respawn',
        events: respawnEvents,
        updatedRobots: this.robots.map((r) => ({ ...r, position: { ...r.position } })),
      };
      this.io.to(this.gameRoom()).emit(EVENTS.GAME_EXECUTE, respawnPayload);
    }

    if (respawnedPlayers.length > 0) {
      await this.waitForDirectionChoices(respawnedPlayers, 'respawn');
    }

    // Small delay before next round
    if (this.debugMode) {
      await this.waitForDebugAction();
    } else {
      await this.delay(SPEED.ROUND_DELAY_MS / this.executionSpeed);
    }
    this.startRound();
  }

  broadcastDebugStep(globalSteps, idx) {
    const entry = globalSteps[idx];
    const payload = {
      registerIndex: entry.registerIndex,
      stepIndex: idx,
      totalSteps: globalSteps.length,
      stepLabel: entry.step.label,
      events: entry.step.events,
      updatedRobots: entry.step.robotsAfter,
    };
    this.io.to(this.gameRoom()).emit(EVENTS.GAME_EXECUTE, payload);
  }

  setSpeed(speed) {
    this.executionSpeed = speed;
    const payload = { speed };
    this.io.to(this.gameRoom()).emit(EVENTS.GAME_SPEED, payload);
  }

  setDebugMode(enabled) {
    this.debugMode = enabled;
    const payload = { enabled };
    this.io.to(this.gameRoom()).emit(EVENTS.GAME_DEBUG_MODE, payload);
    // If disabling debug mode while waiting for a step, auto-resolve forward
    if (!enabled && this.debugActionResolve) {
      this.debugActionResolve('forward');
      this.debugActionResolve = null;
    }
  }

  debugStep() {
    if (!this.debugMode) return { error: 'Not in debug mode' };
    if (!this.debugActionResolve) return { error: 'Not waiting for step' };
    this.debugActionResolve('forward');
    this.debugActionResolve = null;
    return {};
  }

  debugStepBack() {
    if (!this.debugMode) return { error: 'Not in debug mode' };
    if (!this.debugActionResolve) return { error: 'Not waiting for step' };
    this.debugActionResolve('back');
    this.debugActionResolve = null;
    return {};
  }

  waitForDebugAction() {
    return new Promise((resolve) => {
      this.debugActionResolve = resolve;
    });
  }

  chooseDirection(userId, direction) {
    if (!this.pendingDirectionChoices.has(userId)) {
      return { error: 'No direction choice pending for you' };
    }

    const robot = this.robots.find((r) => r.playerId === userId);
    if (!robot) return { error: 'Robot not found' };

    robot.direction = direction;
    this.pendingDirectionChoices.delete(userId);

    // If all choices are in, resolve the wait
    if (this.pendingDirectionChoices.size === 0 && this.directionResolve) {
      if (this.directionChoiceTimer) {
        clearTimeout(this.directionChoiceTimer);
        this.directionChoiceTimer = null;
      }
      this.directionResolve();
      this.directionResolve = null;
    }

    return {};
  }

  waitForDirectionChoices(playerIds, reason) {
    for (const id of playerIds) {
      this.pendingDirectionChoices.add(id);
    }

    // Emit to clients
    const payload = {
      playerIds,
      reason,
      timeoutSeconds: SPEED.DIRECTION_CHOICE_TIMEOUT_SECONDS,
    };
    this.io.to(this.gameRoom()).emit(EVENTS.GAME_DIRECTION_NEEDED, payload);

    // Auto-choose for bots
    for (const botId of this.botPlayerIds) {
      if (this.pendingDirectionChoices.has(botId)) {
        const dirs = ['north', 'east', 'south', 'west'];
        const robot = this.robots.find((r) => r.playerId === botId);
        if (robot) {
          robot.direction = dirs[Math.floor(Math.random() * dirs.length)];
        }
        this.pendingDirectionChoices.delete(botId);
      }
    }

    // If all already resolved (e.g. all bots), return immediately
    if (this.pendingDirectionChoices.size === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.directionResolve = resolve;
      this.directionChoiceTimer = setTimeout(() => {
        // Default to north for anyone who didn't choose
        for (const id of this.pendingDirectionChoices) {
          const robot = this.robots.find((r) => r.playerId === id);
          if (robot) robot.direction = 'north';
        }
        this.pendingDirectionChoices.clear();
        this.directionChoiceTimer = null;
        this.directionResolve = null;
        resolve();
      }, SPEED.DIRECTION_CHOICE_TIMEOUT_SECONDS * 1000);
    });
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  broadcastPhaseChange() {
    const payload = {
      phase: this.phase,
      round: this.round,
      timerSeconds: this.phase === 'programming' ? GAME.PROGRAMMING_TIMER_SECONDS : undefined,
    };
    this.io.to(this.gameRoom()).emit(EVENTS.GAME_PHASE_CHANGE, payload);
  }

  getPlayerSocketIds(userId) {
    const room = this.io.sockets.adapter.rooms.get(this.gameRoom());
    if (!room) return [];

    const ids = [];
    for (const sid of room) {
      const s = this.io.sockets.sockets.get(sid);
      if (s?.data.userId === userId) ids.push(sid);
    }
    return ids;
  }

  toGameState() {
    return {
      id: this.id,
      board: this.board,
      robots: this.robots.map((r) => ({ ...r, position: { ...r.position } })),
      phase: this.phase,
      currentRegister: 0,
      round: this.round,
      totalCheckpoints: this.checkpoints.length,
      checkpoints: this.checkpoints,
      winnerId: this.winnerId,
      executionSpeed: this.executionSpeed,
      pendingDirectionChoices: [...this.pendingDirectionChoices],
      debugMode: this.debugMode,
      timerSeconds: this.phase === 'programming' && this.programmingTimer
        ? Math.max(0, Math.ceil(GAME.PROGRAMMING_TIMER_SECONDS - (Date.now() - this.programmingTimerStart) / 1000))
        : undefined,
    };
  }

  getPlayerHand(userId) {
    return this.hands.get(userId) ?? [];
  }

  getPhase() {
    return this.phase;
  }

  handleDisconnect(userId) {
    this.disconnectedPlayers.add(userId);
  }

  handleReconnect(userId) {
    this.disconnectedPlayers.delete(userId);
  }

  getPlayerIds() {
    return this.playerInfos.map((p) => p.userId);
  }

  isBot(userId) {
    return this.botPlayerIds.has(userId);
  }

  submitBotPrograms() {
    for (const botId of this.botPlayerIds) {
      const hand = this.hands.get(botId);
      if (!hand || hand.length === 0) continue;

      // Simple strategy: shuffle the hand and pick the first 5
      const shuffled = [...hand].sort(() => Math.random() - 0.5);
      const cardIds = shuffled.slice(0, GAME.REGISTERS_PER_ROUND).map((c) => c.id);

      // Use setTimeout so it feels like a real player (1-3s delay)
      const delay = 1000 + Math.random() * 2000;
      setTimeout(() => {
        if (this.phase === 'programming') {
          this.submitProgram(botId, cardIds);
        }
      }, delay);
    }
  }

  destroy() {
    if (this.programmingTimer) {
      clearTimeout(this.programmingTimer);
      this.programmingTimer = null;
    }
    if (this.directionChoiceTimer) {
      clearTimeout(this.directionChoiceTimer);
      this.directionChoiceTimer = null;
    }
  }
}
