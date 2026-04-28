import { io, Socket } from 'socket.io-client';
import { SocketEvents } from '../../types/common.types';
import { loggers } from '@/utils/logger';
import { API_BASE_URL } from '@/lib/api/baseUrl';

export class SocketClientCore {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private roomId: string | null = null;
  private username: string | null = null;

  async connect(url: string = API_BASE_URL): Promise<Socket> {
    try {
      loggers.socket.info('Initializing Socket.IO connection');
      loggers.socket.debug('Connection details', { 
        url, 
        currentLocation: typeof window !== 'undefined' ? window.location.origin : 'SSR'
      });

      if (this.socket?.connected) {
        loggers.socket.info('Socket already connected');
        return this.socket;
      }

      if (this.socket) {
        loggers.socket.debug('Cleaning up existing socket');
        this.socket.disconnect();
        this.socket = null;
      }

      // Socket.IO -
      loggers.socket.debug('Creating new Socket.IO instance');
      this.socket = io(url, {
        path: '/socket.io/',
        transports: ['polling', 'websocket'],  // polling
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 60000,
        forceNew: true,
        upgrade: true,  // WebSocket
        withCredentials: false
      });

      loggers.socket.debug('Socket.IO instance created, setting up events');

      this.setupConnectionEvents();

      loggers.socket.info('Starting connection');
      this.socket.connect();

      await this.waitForConnection();

      loggers.socket.info('Socket.IO connection established (polling)');
      return this.socket;

    } catch (error) {
      loggers.socket.error('Socket connection failed', error);
      throw error;
    }
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      if (this.socket.connected) {
        this.isConnected = true;
        resolve();
        return;
      }

      const connectHandler = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve();
      };

      const errorHandler = (error: unknown) => {
        loggers.socket.error('Connection error during wait', error);
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      this.socket.once('connect', connectHandler);
      this.socket.once('connect_error', errorHandler);

      setTimeout(() => {
        if (!this.isConnected) {
          this.socket?.off('connect', connectHandler);
          this.socket?.off('connect_error', errorHandler);
          reject(new Error('Connection timeout'));
        }
      }, 30000);
    });
  }

  private setupConnectionEvents(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      loggers.socket.info('Socket connected', { socketId: this.socket?.id });
      this.isConnected = true;
      this.reconnectAttempts = 0;

      if (this.roomId && this.username) {
        this.joinRoom(this.roomId, this.username);
      }
    });

    this.socket.on('disconnect', (reason) => {
      loggers.socket.warn('Socket disconnected', { reason });
      this.isConnected = false;
    });

    this.socket.on('reconnect', (attemptNumber) => {
      loggers.socket.info(`Socket reconnected after ${attemptNumber} attempts`);
      this.isConnected = true;
    });

    this.socket.on('reconnect_error', (error) => {
      this.reconnectAttempts++;
      loggers.socket.error(`Reconnection attempt ${this.reconnectAttempts} failed`, error);
    });

    this.socket.on('reconnect_failed', () => {
      loggers.socket.error(`All reconnection attempts failed (${this.maxReconnectAttempts})`);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error: Error & { type?: string; description?: string; context?: string; code?: string }) => {
      loggers.socket.error('Socket connection error', {
        message: error.message || String(error),
        type: error.type || 'unknown',
        description: error.description || 'No description',
        context: error.context || 'No context',
        code: error.code || 'No code'
      });
    });

    this.socket.on('error', (error) => {
      loggers.socket.error('Socket general error', error);
    });

    // Transport
    this.socket.on('connect', () => {
      loggers.socket.info('Connected via transport', { 
        transport: this.socket?.io?.engine?.transport?.name 
      });
    });

    this.socket.io.on('error', (error) => {
      loggers.socket.error('Socket.IO engine error', error);
    });
  }

  joinRoom(roomId: string, username: string): void {
    if (!this.socket || !this.isConnected) {
      loggers.socket.warn('Cannot join room: Socket not connected', { roomId, username });
      return;
    }

    this.roomId = roomId;
    this.username = username;

    loggers.socket.info('Joining room', { roomId, username });
    
    this.socket.emit('join-room', {
      roomId,
      username
    });

    this.socket.emit('register-handlers', { roomId });
  }

  leaveRoom(roomId: string, username: string): void {
    if (!this.socket) return;

    loggers.socket.info('Leaving room', { roomId, username });
    
    this.socket.emit('leave-room', {
      roomId,
      username
    });

    this.roomId = null;
    this.username = null;
  }

  sendMessage(roomId: string, message: string, sender: string): void {
    if (!this.socket || !this.isConnected) {
      loggers.socket.warn('Cannot send message: Socket not connected', { roomId, sender });
      return;
    }

    loggers.socket.debug('Sending message', { roomId, sender, messageLength: message.length });
    this.socket.emit('send-message', {
      roomId,
      message,
      sender
    });
  }

  on<K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]): void {
    if (!this.socket) return;
    this.socket.on(event as string, handler);
  }

  off<K extends keyof SocketEvents>(event: K, handler?: SocketEvents[K]): void {
    if (!this.socket) return;
    this.socket.off(event as string, handler);
  }

  emit(event: string, data: unknown): void {
    if (!this.socket || !this.isConnected) {
      loggers.socket.warn(`Cannot emit ${event}: Socket not connected`);
      return;
    }
    this.socket.emit(event, data);
  }

  getConnectionStatus(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      loggers.socket.info('Disconnecting socket');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.roomId = null;
      this.username = null;
    }
  }

  getDebugInfo(): {
    connected: boolean;
    socketId: string | undefined;
    roomId: string | null;
    username: string | null;
    reconnectAttempts: number;
    transport: string | undefined;
  } {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
      roomId: this.roomId,
      username: this.username,
      reconnectAttempts: this.reconnectAttempts,
      transport: this.socket?.io?.engine?.transport?.name
    };
  }
}

export const socketClientCore = new SocketClientCore(); 