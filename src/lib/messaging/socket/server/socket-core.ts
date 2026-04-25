import { Server } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Socket } from 'net';
import { ConnectedUser } from '../../types/common.types';

// Socket 서버 관련 타입 정의
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

// 연결된 사용자들 추적
const connectedUsers: { [socketId: string]: ConnectedUser } = {};

export class SocketCore {
  private io: Server | null = null;

  // Socket.IO 서버 초기화
  initializeServer(req: NextApiRequest, res: NextApiResponseWithSocket): Server {
    if (!res.socket.server.io) {
      console.log('🔌 Socket.IO server initializing...');
      
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
      
      console.log('✅ Socket.IO server initialized with path: /api/socket/io');
    } else {
      this.io = res.socket.server.io;
    }

    return this.io;
  }

  // 서버 인스턴스 반환
  getServer(): Server | null {
    return this.io;
  }

  // 사용자 관리 메서드들
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

  // 방송 메서드들
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

  // 로깅 유틸리티
  logConnection(socketId: string): void {
    console.log(`🔗 New client connected: ${socketId}`);
  }

  logDisconnection(socketId: string): void {
    console.log(`❌ Client disconnected: ${socketId}`);
  }

  logRoomJoin(username: string, roomId: string): void {
    console.log(`👤 User ${username} joined room ${roomId}`);
  }

  logRoomLeave(username: string, roomId: string): void {
    console.log(`👋 User ${username} left room ${roomId}`);
  }
}

// 싱글톤 인스턴스
export const socketCore = new SocketCore(); 