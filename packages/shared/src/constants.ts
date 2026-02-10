/** Auth constants */
export const AUTH = {
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 24,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  BCRYPT_ROUNDS: 12,
} as const;

/** Lobby configuration constants */
export const LOBBY = {
  NAME_MIN_LENGTH: 3,
  NAME_MAX_LENGTH: 40,
} as const;

/** Robot color palette */
export const ROBOT_COLORS = [
  '#e74c3c', // red
  '#3498db', // blue
  '#2ecc71', // green
  '#f39c12', // orange
  '#9b59b6', // purple
  '#1abc9c', // teal
  '#e67e22', // dark orange
  '#e84393', // pink
] as const;

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

/** Execution speed configuration */
export const SPEED = {
  REGISTER_DELAY_MS: 3000,
  ROUND_DELAY_MS: 2000,
  DIRECTION_CHOICE_TIMEOUT_SECONDS: 15,
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
  LOBBY_ADD_BOT: 'lobby:add_bot',

  // Game events
  GAME_STATE: 'game:state',
  GAME_CARDS_DEALT: 'game:cards_dealt',
  GAME_PROGRAM: 'game:program',
  GAME_EXECUTE: 'game:execute',
  GAME_MOVE: 'game:move',
  GAME_PHASE_CHANGE: 'game:phase_change',
  GAME_OVER: 'game:over',
  GAME_PROGRAMS: 'game:programs',
  GAME_SPEED: 'game:speed',
  GAME_CHOOSE_DIRECTION: 'game:choose_direction',
  GAME_DIRECTION_NEEDED: 'game:direction_needed',
  GAME_DEBUG_MODE: 'game:debug_mode',
  GAME_DEBUG_STEP: 'game:debug_step',
  GAME_DEBUG_STEP_BACK: 'game:debug_step_back',
  GAME_LEAVE: 'game:leave',

  // Chat events
  CHAT_MESSAGE: 'chat:message',

  // Connection events
  PLAYER_CONNECTED: 'player:connected',
  PLAYER_DISCONNECTED: 'player:disconnected',
} as const;
