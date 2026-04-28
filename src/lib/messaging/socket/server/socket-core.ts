import { Server } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Socket } from 'net';
import { ConnectedUser } from '../../types/common.types';
import { loggers } from '@/utils/logger';

interface SocketServer extends HTTPServer {
  io?: Server;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: Socket & {
    server: HTTPServer & {
      io?: Server;
    };
  };
}

const connectedUsers: { [socketId: string]: ConnectedUser } = {};

export class SocketCore {
  private io: Server | null = null;

  initializeServer(req: NextApiRequest, res: NextApiResponseWithSocket): Server {
    if (!res.socket.server.io) {
      loggers.socket.info('🔌 Socket.IO server initializing...');
      
      const io = new Server(res.socket.server as SocketServer, {
        path: '/api/socket/io',
        addTrailingSlash: false,
        cors: {
          origin: "*",
          methods: ["GET", "POST"],
          credentials: false
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 120000,
        pingInterval: 25000,
        allowEIO3: true,
        upgradeTimeout: 30000,
        maxHttpBufferSize: 1e6
      });

      res.socket.server.io = io;
      this.io = io;
      
      loggers.socket.info('✅ Socket.IO server initialized with path: /api/socket/io');
    } else {
      this.io = res.socket.server.io;
    }

    return this.io;
  }

  getServer(): Server | null {
    return this.io;
  }

  addUser(socketId: string, username: string): void {
    connectedUsers[socketId] = {
      socketId,
      username,
      rooms: []
    };
  }

  removeUser(socketId: string): ConnectedUser | undefined {
    const user = connectedUsers[socketId];
    delete connectedUsers[socketId];
    return user;
  }

  addUserToRoom(socketId: string, roomId: string): void {
    if (connectedUsers[socketId] && !connectedUsers[socketId].rooms.includes(roomId)) {
      connectedUsers[socketId].rooms.push(roomId);
    }
  }

  removeUserFromRoom(socketId: string, roomId: string): void {
    if (connectedUsers[socketId]) {
      connectedUsers[socketId].rooms = connectedUsers[socketId].rooms.filter(r => r !== roomId);
    }
  }

  getUsersInRoom(roomId: string): string[] {
    return Object.values(connectedUsers)
      .filter(user => user.rooms.includes(roomId))
      .map(user => user.username);
  }

  getConnectedUser(socketId: string): ConnectedUser | undefined {
    return connectedUsers[socketId];
  }

  broadcastToRoom(roomId: string, event: string, data: unknown): void {
    if (this.io) {
      this.io.to(roomId).emit(event, data);
    }
  }

  broadcastToAll(event: string, data: unknown): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  logConnection(socketId: string): void {
    loggers.socket.info(`🔗 New client connected: ${socketId}`);
  }

  logDisconnection(socketId: string): void {
    loggers.socket.info(`❌ Client disconnected: ${socketId}`);
  }

  logRoomJoin(username: string, roomId: string): void {
    loggers.socket.info(`👤 User ${username} joined room ${roomId}`);
  }

  logRoomLeave(username: string, roomId: string): void {
    loggers.socket.info(`👋 User ${username} left room ${roomId}`);
  }
}

export const socketCore = new SocketCore(); 