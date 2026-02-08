/** Game configuration constants */
export const GAME = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 8,
  REGISTERS_PER_ROUND: 5,
  CARDS_DEALT: 9,
  STARTING_HEALTH: 10,
  STARTING_LIVES: 3,
  PROGRAMMING_TIMER_SECONDS: 60,
} as const;

/** Reputation system constants */
export const REPUTATION = {
  INITIAL: 100,
  WIN_BONUS: 10,
  LOSS_PENALTY: 0,
  ABANDON_PENALTY: -15,
  COMPLETE_GAME_BONUS: 2,
} as const;

/** Socket.IO event names */
export const EVENTS = {
  // Lobby events
  LOBBY_CREATE: 'lobby:create',
  LOBBY_JOIN: 'lobby:join',
  LOBBY_LEAVE: 'lobby:leave',
  LOBBY_READY: 'lobby:ready',
  LOBBY_START: 'lobby:start',
  LOBBY_UPDATE: 'lobby:update',
  LOBBY_LIST: 'lobby:list',

  // Game events
  GAME_STATE: 'game:state',
  GAME_CARDS_DEALT: 'game:cards_dealt',
  GAME_PROGRAM: 'game:program',
  GAME_EXECUTE: 'game:execute',
  GAME_MOVE: 'game:move',
  GAME_PHASE_CHANGE: 'game:phase_change',
  GAME_OVER: 'game:over',

  // Chat events
  CHAT_MESSAGE: 'chat:message',

  // Connection events
  PLAYER_CONNECTED: 'player:connected',
  PLAYER_DISCONNECTED: 'player:disconnected',
} as const;
