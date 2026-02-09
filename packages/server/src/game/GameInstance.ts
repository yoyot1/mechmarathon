import type { Server } from 'socket.io';
import {
  type Board, type Card, type CheckpointConfig, type ExecutePayload, type GameOverPayload,
  type GamePhase, type GameState, type PhaseChangePayload, type Robot,
  EVENTS, GAME, ROBOT_COLORS,
  createDeck, shuffleDeck, dealCards, executeRegister, checkWinCondition, updateVirtualStatus,
  DEFAULT_BOARD, getDefaultCheckpoints,
} from '@mechmarathon/shared';

interface PlayerInfo {
  userId: string;
  username: string;
  color: string;
}

export class GameInstance {
  readonly id: string;
  private io: Server;
  private board: Board;
  private checkpoints: CheckpointConfig[];
  private robots: Robot[];
  private phase: GamePhase = 'waiting';
  private round = 0;
  private winnerId: string | null = null;

  private playerInfos: PlayerInfo[];
  private hands = new Map<string, Card[]>();
  private programs = new Map<string, (Card | null)[]>();
  private disconnectedPlayers = new Set<string>();
  private programmingTimer: ReturnType<typeof setTimeout> | null = null;
  private botPlayerIds = new Set<string>();

  constructor(id: string, playerInfos: PlayerInfo[], io: Server, botPlayerIds?: string[]) {
    this.id = id;
    this.io = io;
    this.playerInfos = playerInfos;

    // Use default board
    this.board = {
      width: DEFAULT_BOARD.width,
      height: DEFAULT_BOARD.height,
      tiles: DEFAULT_BOARD.tiles,
    };
    this.checkpoints = getDefaultCheckpoints();

    // Place all robots on checkpoint 1 (all virtual)
    const startPos = this.checkpoints.find((c) => c.number === 1)!.position;
    this.robots = playerInfos.map((p, i) => ({
      id: `robot-${i}`,
      playerId: p.userId,
      position: { ...startPos },
      direction: 'north' as const,
      health: GAME.STARTING_HEALTH,
      lives: GAME.STARTING_LIVES,
      checkpoint: 0,
      virtual: true,
    }));

    if (botPlayerIds) {
      for (const id of botPlayerIds) this.botPlayerIds.add(id);
    }

    this.startRound();
  }

  private gameRoom(): string {
    return `game:${this.id}`;
  }

  private startRound(): void {
    this.round++;
    this.programs.clear();
    this.hands.clear();

    // Create, shuffle, and deal deck
    const deck = shuffleDeck(createDeck());
    const alivePlayerIds = this.robots
      .filter((r) => r.lives > 0)
      .map((r) => r.playerId);

    const healthMap = new Map<string, number>();
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

    // Start programming timer
    this.programmingTimer = setTimeout(() => {
      this.onProgrammingTimerExpired();
    }, GAME.PROGRAMMING_TIMER_SECONDS * 1000);

    // Auto-program bots after a short delay
    this.submitBotPrograms();
  }

  submitProgram(userId: string, cardIds: string[]): { error?: string } {
    if (this.phase !== 'programming') {
      return { error: 'Not in programming phase' };
    }

    const hand = this.hands.get(userId);
    if (!hand) return { error: 'No hand for this player' };

    if (cardIds.length !== GAME.REGISTERS_PER_ROUND) {
      return { error: `Must program exactly ${GAME.REGISTERS_PER_ROUND} registers` };
    }

    // Validate all card IDs are from the player's hand
    const handIds = new Set(hand.map((c) => c.id));
    const usedIds = new Set<string>();
    const program: Card[] = [];

    for (const cardId of cardIds) {
      if (!handIds.has(cardId)) return { error: `Card ${cardId} not in your hand` };
      if (usedIds.has(cardId)) return { error: `Card ${cardId} used twice` };
      usedIds.add(cardId);
      program.push(hand.find((c) => c.id === cardId)!);
    }

    this.programs.set(userId, program);

    // Check if all alive players have submitted
    if (this.allProgramsSubmitted()) {
      this.startExecution();
    }

    return {};
  }

  private allProgramsSubmitted(): boolean {
    for (const robot of this.robots) {
      if (robot.lives <= 0) continue;
      const program = this.programs.get(robot.playerId);
      if (!program || program.some((c) => c === null)) return false;
    }
    return true;
  }

  private onProgrammingTimerExpired(): void {
    this.programmingTimer = null;

    // Auto-fill programs for players who haven't submitted
    for (const robot of this.robots) {
      if (robot.lives <= 0) continue;
      const program = this.programs.get(robot.playerId);
      if (!program) continue;

      const hand = this.hands.get(robot.playerId);
      if (!hand) continue;

      const usedIds = new Set(
        program.filter((c): c is Card => c !== null).map((c) => c.id),
      );
      const available = hand.filter((c) => !usedIds.has(c.id));

      for (let i = 0; i < GAME.REGISTERS_PER_ROUND; i++) {
        if (program[i] === null && available.length > 0) {
          program[i] = available.shift()!;
        }
      }

      this.programs.set(robot.playerId, program);
    }

    this.startExecution();
  }

  private async startExecution(): Promise<void> {
    if (this.programmingTimer) {
      clearTimeout(this.programmingTimer);
      this.programmingTimer = null;
    }

    this.phase = 'executing';
    this.broadcastPhaseChange();

    const respawnPos = this.checkpoints.find((c) => c.number === 1)!.position;

    for (let reg = 0; reg < GAME.REGISTERS_PER_ROUND; reg++) {
      // Gather cards for this register
      const playerCards = new Map<string, Card>();
      for (const robot of this.robots) {
        if (robot.lives <= 0) continue;
        const program = this.programs.get(robot.playerId);
        if (!program) continue;
        const card = program[reg];
        if (card) playerCards.set(robot.playerId, card);
      }

      // Execute the register
      const events = executeRegister(
        reg,
        playerCards,
        this.robots,
        this.board,
        this.checkpoints,
        respawnPos,
      );

      // Update virtual status after each register
      updateVirtualStatus(this.robots);

      // Broadcast execution result
      const payload: ExecutePayload = {
        registerIndex: reg,
        events,
        updatedRobots: this.robots.map((r) => ({ ...r, position: { ...r.position } })),
      };
      this.io.to(this.gameRoom()).emit(EVENTS.GAME_EXECUTE, payload);

      // Check win condition
      const winner = checkWinCondition(this.robots, this.checkpoints.length);
      if (winner) {
        this.winnerId = winner;
        this.phase = 'finished';
        const gameOverPayload: GameOverPayload = {
          winnerId: winner,
          finalState: this.toGameState(),
        };
        this.io.to(this.gameRoom()).emit(EVENTS.GAME_OVER, gameOverPayload);
        return;
      }

      // Delay between registers for animation
      if (reg < GAME.REGISTERS_PER_ROUND - 1) {
        await this.delay(1500);
      }
    }

    // Round complete — start next round
    this.phase = 'cleanup';
    this.broadcastPhaseChange();

    // Small delay before next round
    await this.delay(1000);
    this.startRound();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private broadcastPhaseChange(): void {
    const payload: PhaseChangePayload = {
      phase: this.phase,
      round: this.round,
      timerSeconds: this.phase === 'programming' ? GAME.PROGRAMMING_TIMER_SECONDS : undefined,
    };
    this.io.to(this.gameRoom()).emit(EVENTS.GAME_PHASE_CHANGE, payload);
  }

  private getPlayerSocketIds(userId: string): string[] {
    const room = this.io.sockets.adapter.rooms.get(this.gameRoom());
    if (!room) return [];

    const ids: string[] = [];
    for (const sid of room) {
      const s = this.io.sockets.sockets.get(sid);
      if (s?.data.userId === userId) ids.push(sid);
    }
    return ids;
  }

  toGameState(): GameState {
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
    };
  }

  getPlayerHand(userId: string): Card[] {
    return this.hands.get(userId) ?? [];
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  handleDisconnect(userId: string): void {
    this.disconnectedPlayers.add(userId);
  }

  handleReconnect(userId: string): void {
    this.disconnectedPlayers.delete(userId);
  }

  getPlayerIds(): string[] {
    return this.playerInfos.map((p) => p.userId);
  }

  isBot(userId: string): boolean {
    return this.botPlayerIds.has(userId);
  }

  private submitBotPrograms(): void {
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

  destroy(): void {
    if (this.programmingTimer) {
      clearTimeout(this.programmingTimer);
      this.programmingTimer = null;
    }
  }
}
