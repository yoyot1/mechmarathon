import express, { type Express } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.js';
import { lobbyRouter } from './routes/lobby.js';
import { registerAuthMiddleware } from './socket/authMiddleware.js';
import { registerLobbyHandlers } from './socket/lobbyHandlers.js';
import { registerGameHandlers } from './socket/gameHandlers.js';

dotenv.config();

const app: Express = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
app.use('/api/auth', authRouter);

// Lobby routes
app.use('/api/lobbies', lobbyRouter);

// Socket.IO auth middleware
registerAuthMiddleware(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id} (user: ${socket.data.userId})`);

  registerLobbyHandlers(io, socket);
  registerGameHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`MechMarathon server running on port ${PORT}`);
});

export { app, io };
