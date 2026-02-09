import type { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

/** Socket.IO middleware that verifies JWT from handshake auth */
export function registerAuthMiddleware(io: Server): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
      socket.data.userId = payload.sub as string;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });
}
