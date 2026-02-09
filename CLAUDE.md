# Project: MechMarathon

A web-based real-time multiplayer game inspired by the RoboRally board game. Players program their robots with movement cards each round, then all robots execute their programs simultaneously. Features public/private game lobbies, a reputation system to deter griefing, and animated 2D board rendering.

## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Language | TypeScript | Full-stack, shared types between client/server |
| Frontend | Vue 3 + Vite | Composition API, `<script setup>` syntax |
| State | Pinia | Client-side state management |
| Game Rendering | PixiJS 8 | 2D sprites, animations, future isometric view |
| Backend | Node.js + Express | REST API + Socket.IO for real-time |
| Real-time | Socket.IO | WebSocket rooms per game instance |
| Database | PostgreSQL | User accounts, game history, reputation |
| ORM | Prisma | Type-safe queries, migrations |
| Auth | JWT + bcrypt | Email/password, passkey-ready schema |
| Testing | Vitest | Unit and integration tests |
| Package Manager | pnpm | Workspace monorepo |

## Project Structure

```
mechmarathon/
├── packages/
│   ├── shared/          # Shared types, constants, game logic
│   │   └── src/
│   │       ├── types/   # Game, User, Lobby type definitions
│   │       └── constants.ts
│   ├── server/          # Express + Socket.IO backend
│   │   ├── src/
│   │   └── prisma/      # Database schema and migrations
│   └── client/          # Vue 3 + Vite frontend
│       └── src/
│           ├── views/   # Page components (Home, Login, Lobby, Game)
│           └── router/  # Vue Router configuration
├── docker-compose.yml   # PostgreSQL for local dev
├── pnpm-workspace.yaml  # Monorepo workspace config
└── tsconfig.base.json   # Shared TypeScript config
```

## Development Guidelines

### Code Style
- TypeScript strict mode everywhere
- Vue Composition API with `<script setup lang="ts">`
- Use shared types from `@mechmarathon/shared` — never duplicate type definitions
- Server-authoritative game state: all game logic validation happens server-side

### Architecture Principles
- Game state mutations only on the server; clients receive state updates via Socket.IO
- REST API for auth, user profiles, lobby CRUD
- WebSocket events for real-time game play (card dealing, programming, execution)
- All socket event names defined in `packages/shared/src/constants.ts`

### Testing Strategy
- Unit test game logic in `shared` package (card execution, board mechanics)
- Unit test API routes and socket handlers in `server`
- Component tests for Vue views in `client`
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
pnpm dev:client    # Vue dev server on :5173
pnpm dev:server    # Express server on :3000

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
- [x] Devcontainer configured (Node 20, Docker-outside-of-Docker, PostgreSQL client, Vue/TS extensions)
- [x] Shared types defined: Game, Board, Robot, Card, User, Lobby, constants
- [x] Server scaffolded: Express + Socket.IO, Prisma schema (User, UserStats, Game, GamePlayer)
- [x] Client scaffolded: Vue 3 + Vite, router (Home, Login, Register, LobbyList, Lobby, Game views)
- [x] Docker Compose for PostgreSQL
- [x] Dependencies installed via pnpm

### Next Steps
- [x] ~~Rebuild devcontainer to get Node 20~~ — Done (Node 20.20.0, switched to docker-outside-of-docker)
- [x] ~~Start PostgreSQL and run first Prisma migration~~ — Done (migration `20260208040944_init` applied)
- [x] ~~GitHub remote repository~~ — `yoyot1/mechmarathon` configured
- [x] ~~Implement auth routes (register, login, JWT middleware)~~ — Done (POST /register, POST /login, GET /me, Pinia store, router guards)
- [x] ~~Implement lobby CRUD + Socket.IO lobby events~~ — Done (REST: POST/GET /api/lobbies, Socket: join/leave/ready/start, Pinia store, LobbyListView + LobbyView)
- [x] ~~Implement core game engine (card dealing, programming, execution)~~ — Done (shared game logic, GameInstance, GameManager, socket handlers, Pinia store, CSS grid board view)
- [x] ~~Build card programming UI~~ — Done (register slots, hand cards, submit, timer, integrated into GameView)
- [ ] Build PixiJS board renderer (currently CSS grid — functional but minimal)
- [ ] Add unit tests for shared game logic
- [ ] Implement reputation updates on game completion
