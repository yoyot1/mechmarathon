# Project: MechMarathon

A web-based real-time multiplayer game inspired by the RoboRally board game. Players program their robots with movement cards each round, then all robots execute their programs simultaneously. Features public/private game lobbies, a reputation system to deter griefing, and animated 2D board rendering.

## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Language | JavaScript (ES modules) | Full-stack, no TypeScript |
| Frontend | Vanilla JS + Vite | Template strings, targeted DOM updates |
| Routing | Custom History API router | `data-link` attribute for SPA navigation |
| State | Plain JS objects | `state/auth.js`, `state/lobby.js`, `state/game.js` |
| Game Rendering | PixiJS 8 | 2D sprites, animations, future isometric view |
| Backend | Node.js + Express | REST API + Socket.IO for real-time |
| Real-time | Socket.IO | WebSocket rooms per game instance |
| Database | PostgreSQL | User accounts, game history, reputation |
| ORM | Prisma | Queries, migrations |
| Auth | JWT + bcrypt | Email/password, passkey-ready schema |
| Testing | Vitest | Unit and integration tests |
| Package Manager | pnpm | Workspace monorepo |

## Project Structure

```
mechmarathon/
├── packages/
│   ├── shared/          # Shared constants, game logic (pure JS)
│   │   └── src/
│   │       ├── constants.js
│   │       └── game/    # deck, movement, board, execution
│   ├── server/          # Express + Socket.IO backend
│   │   ├── src/
│   │   │   ├── routes/      # auth.js, lobby.js
│   │   │   ├── socket/      # lobbyHandlers.js, gameHandlers.js
│   │   │   ├── game/        # GameInstance.js, GameManager.js, BotPlayer.js
│   │   │   ├── middleware/   # auth.js
│   │   │   └── lib/         # prisma.js, lobbyUtils.js
│   │   └── prisma/      # Database schema and migrations
│   └── client/          # Vanilla JS + Vite frontend
│       └── src/
│           ├── views/       # home, login, register, lobbyList, lobby, game, boardCanvas
│           ├── state/       # auth.js, lobby.js, game.js
│           ├── lib/         # api.js, socket.js, router.js, board-renderer/
│           └── styles/      # CSS files per view
├── docker-compose.yml   # PostgreSQL for local dev
└── pnpm-workspace.yaml  # Monorepo workspace config
```

## Development Guidelines

### Code Style
- Plain JavaScript with ES module syntax (`import`/`export`)
- No TypeScript, no build step for shared/server packages
- Use shared constants from `@mechmarathon/shared` — never duplicate
- Server-authoritative game state: all game logic validation happens server-side

### Architecture Principles
- Game state mutations only on the server; clients receive state updates via Socket.IO
- REST API for auth, user profiles, lobby CRUD
- WebSocket events for real-time game play (card dealing, programming, execution)
- All socket event names defined in `packages/shared/src/constants.js`
- Views export `render(container, params)` and `unmount()` lifecycle functions
- State modules use callback-based updates (no reactive framework)

### Testing Strategy
- Unit test game logic in `shared` package (card execution, board mechanics)
- Unit test API routes and socket handlers in `server`
- Run all tests: `pnpm test`
- **Test-driven development**: Tests define correct behavior based on stated requirements, NOT based on current implementation. When writing or updating tests:
  - Define expected behavior from RoboRally rules and project requirements first
  - If implementation doesn't match expected behavior, flag the discrepancy — do NOT silently adjust tests to match the implementation
  - Ask questions or make suggestions when requirements are ambiguous or when implementation seems incorrect
  - Never auto-update a failing test to match implementation without explicit user approval
  - This is especially important for game state interactions (robots, options, board elements) where unexpected edge cases arise

### Git Workflow
- `main` branch is the primary branch
- Feature branches: `feature/<description>`
- Bug fixes: `fix/<description>`
- Conventional commit messages

## Common Tasks

```bash
# Start everything (client + server in parallel)
pnpm dev

# Start individual services
pnpm dev:client    # Vite dev server on :5173
pnpm dev:server    # Express server on :3000 (node --watch)

# Database
docker compose up -d              # Start PostgreSQL
pnpm --filter @mechmarathon/server exec prisma migrate dev   # Run migrations
pnpm --filter @mechmarathon/server exec prisma studio        # DB GUI

# Build
pnpm build

# Test
pnpm test

# Install a dependency in a specific package
pnpm --filter @mechmarathon/client add <package>
pnpm --filter @mechmarathon/server add <package>
```

## Game Design Notes

### RoboRally Core Mechanics
- **Turn structure**: Deal cards → Program registers (5 slots) → Execute all registers in order → Cleanup
- **Programming phase**: Each player receives 9 cards, programs 5 registers, 60-second timer
- **Execution phase**: All robots execute register 1, then register 2, etc.
- **Card priority**: Higher priority moves first within each register
- **Board elements**: Conveyors, gears, lasers, pits, repair sites, flags
- **Win condition**: First robot to reach all flags in order wins

### Reputation System
- New accounts start at 100 reputation
- Completing a game: +2
- Winning a game: +10
- Abandoning a game: -15

## Current Status

> **Update this section as work progresses.** This is read by Claude Code on every session start.

### Completed
- [x] Project initialized: monorepo with `shared`, `server`, `client` packages
- [x] Devcontainer configured (Node 20, Docker-outside-of-Docker, PostgreSQL client)
- [x] Shared constants and game logic (deck, movement, board, execution)
- [x] Server scaffolded: Express + Socket.IO, Prisma schema (User, UserStats, Game, GamePlayer)
- [x] Client scaffolded: Vite, custom router (Home, Login, Register, LobbyList, Lobby, Game views)
- [x] Docker Compose for PostgreSQL
- [x] Auth routes (register, login, JWT middleware)
- [x] Lobby CRUD + Socket.IO lobby events
- [x] Core game engine (card dealing, programming, execution)
- [x] Card programming UI (register slots, hand cards, submit, timer)
- [x] PixiJS board renderer (TileLayer, RobotLayer, AnimationQueue)
- [x] Refactored from Vue + Pinia + TypeScript to vanilla JS
- [x] Board library + map configuration system
  - Default board resized to 12x12 (standard RoboRally size)
  - Board model in DB (tiles only, 12x12, author, official/published flags)
  - Board CRUD API (`/api/boards`) with Zod validation
  - Board editor view (tile painter, wall mode, eraser, direction selector)
  - Board library view (Official/Community/My Boards tabs)
  - Board rotation (`rotateBoard`) and multi-board assembly (`assembleMap`)
  - Map configurator in lobby (host adds boards, sets positions/rotation, places flags + spawns)
  - Game engine accepts boardData from map config (with default board fallback)
  - Seed script for default "Factory Floor" board
  - New socket events: `LOBBY_MAP_CONFIG`, `LOBBY_MAP_UPDATE`

### Infrastructure Checklist
- [x] Vitest configuration (`packages/shared/vitest.config.js`, globals enabled)
- [x] Test helpers (`packages/shared/src/game/__tests__/helpers.js`)
- [x] Foundation tests: movement, deck, board, options (104 tests)
- [x] Core execution tests: 88 tests (executeCard, moveRobot, push, conveyors, gears, pushers, crushers, flamers, lasers, flags, repair, radiation, death/respawn, register execution, win condition, virtual status)
- [x] Per-element review session 1: 21 new tests, 3 bug fixes (213 total tests)
  - Fixed: push-off-board (pusher now advances), conveyor off-board (now kills), current event type (`'current'` not `'conveyor'`) + off-board death
  - New coverage: pusher chain/off-board, drain/radioactive_drain, trap_pit (7 tests), randomizer
- [x] Per-element review session 2: 16 new tests, 0 bug fixes (229 total tests)
  - Repulsor: bounce event, edge bounce, move2 bounce (3 tests)
  - Portal: event details, no matching portal, direction preservation (3 tests)
  - Oil slick: slide into pit, wall-blocked slide, robot-blocked slide (3 tests)
  - Water: move2 reduction, backup reduction (2 tests)
  - Teleporter: move2 tripled, backup tripled (2 tests)
  - Elevation/ledge: push off ledge damage, conveyor off ledge damage, lethal ledge fall (3 tests)
- [x] Board editor undo/redo + keyboard shortcuts
- [x] Graphics abstraction layer (tile renderer registry, 3 enhanced renderers: floor, pit, conveyor)
- [x] PDF cross-reference fixes: 6 gameplay corrections, 14 new tests (243 total tests)
  - Renamed checkpoint → flag across entire codebase (~18 files)
  - Split processRepair into processRepairArchive (per-register) + processRepairHeal (end-of-turn)
  - Added processFlagRepair (end-of-turn heal for robots on flags)
  - Teleporter: changed from ×3 multiplier to +2 bonus, backup becomes -2, blocked if occupied
  - Repulsor: reworked from tile type to side feature, pushes back by full card value with chain-push
  - Added processRadioactiveWasteOptionDraw (option card draw event)

### Next Steps
- [x] Session 2: Core execution tests (executeCard, moveRobot, push mechanics, death/respawn, register execution)
- [x] Session 3: Undo/redo system + keyboard shortcut framework for board editor
- [x] Session 4: Graphics abstraction layer (tile renderer registry, enhanced renderers)
- [x] Per-element review session 1: push, conveyor, current, drain, trap_pit, randomizer (done)
- [x] Per-element review session 2: ledge, teleporter, repulsor, portal, water, oil_slick
- [ ] Implement reputation updates on game completion
- [ ] Create the 59 official RoboRally board definitions
