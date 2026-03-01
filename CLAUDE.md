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
- **Board elements**: Conveyors, gears, lasers, pits, repair sites, checkpoints
- **Win condition**: First robot to reach all checkpoints in order wins

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

### Next Steps
- [ ] Add unit tests for shared game logic
- [ ] Implement reputation updates on game completion
