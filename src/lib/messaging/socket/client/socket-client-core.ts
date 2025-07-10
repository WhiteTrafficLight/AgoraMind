import { io, Socket } from 'socket.io-client';
import { BaseMessage, SocketEvents } from '../../types/common.types';
import { loggers } from '@/utils/logger';

export class SocketClientCore {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private roomId: string | null = null;
  private username: string | null = null;

  // 소켓 연결 초기화
  async connect(url: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'): Promise<Socket> {
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

      // 기존 소켓이 있다면 정리
      if (this.socket) {
        loggers.socket.debug('Cleaning up existing socket');
        this.socket.disconnect();
        this.socket = null;
      }

      // Socket.IO 클라이언트 생성 - 백엔드와 일치하는 설정
      loggers.socket.debug('Creating new Socket.IO instance');
      this.socket = io(url, {
        path: '/socket.io/',  // 백엔드와 일치하는 기본 경로
        transports: ['polling', 'websocket'], // polling 우선
        autoConnect: false, // 수동 연결
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 60000,     // 20초 → 60초 (연결 타임아웃)
        forceNew: true, // 항상 새 연결
        upgrade: true, // WebSocket으로 업그레이드 활성화
        withCredentials: false
      });

      loggers.socket.debug('Socket.IO instance created, setting up events');

      // 연결 이벤트 설정
      this.setupConnectionEvents();

      // 수동으로 연결 시작
      loggers.socket.info('Starting connection');
      this.socket.connect();

      // 연결 대기
      await this.waitForConnection();

      loggers.socket.info('Socket.IO connection established (polling)');
      return this.socket;

    } catch (error) {
      loggers.socket.error('Socket connection failed', error);
      throw error;
    }
  }

  // 연결 대기
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

      const errorHandler = (error: any) => {
        loggers.socket.error('Connection error during wait', error);
        reject(error);
      };

      this.socket.once('connect', connectHandler);
      this.socket.once('connect_error', errorHandler);

      // 타임아웃 설정
      setTimeout(() => {
        if (!this.isConnected) {
          this.socket?.off('connect', connectHandler);
          this.socket?.off('connect_error', errorHandler);
          reject(new Error('Connection timeout'));
        }
      }, 30000); // 10초 → 30초 (연결 대기 타임아웃)
    });
  }

  // 연결 이벤트 설정
  private setupConnectionEvents(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      loggers.socket.info('Socket connected', { socketId: this.socket?.id });
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // 재연결 시 방에 다시 입장
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

    this.socket.on('connect_error', (error: any) => {
      loggers.socket.error('Socket connection error', {
        message: error.message || error,
        type: error.type || 'unknown',
        description: error.description || 'No description',
        context: error.context || 'No context',
        code: error.code || 'No code'
      });
    });

    this.socket.on('error', (error) => {
      loggers.socket.error('Socket general error', error);
    });

    // Transport 관련 이벤트
    this.socket.on('connect', () => {
      loggers.socket.info('Connected via transport', { 
        transport: this.socket?.io?.engine?.transport?.name 
      });
    });

    this.socket.io.on('error', (error) => {
      loggers.socket.error('Socket.IO engine error', error);
    });
  }

  // 방 입장
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

    // 방 타입별 핸들러 등록 요청
    this.socket.emit('register-handlers', { roomId });
  }

  // 방 떠나기
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

  // 메시지 전송
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

  // 이벤트 리스너 등록
  on<K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]): void {
    if (!this.socket) return;
    this.socket.on(event as string, handler);
  }

  // 이벤트 리스너 제거
  off<K extends keyof SocketEvents>(event: K, handler?: SocketEvents[K]): void {
    if (!this.socket) return;
    this.socket.off(event as string, handler);
  }

  // 이벤트 발송
  emit(event: string, data: any): void {
    if (!this.socket || !this.isConnected) {
      loggers.socket.warn(`Cannot emit ${event}: Socket not connected`);
      return;
    }
    this.socket.emit(event, data);
  }

  // 연결 상태 확인
  getConnectionStatus(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  // 소켓 인스턴스 반환
  getSocket(): Socket | null {
    return this.socket;
  }

  // 연결 해제
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

  // 디버그 정보 출력
  getDebugInfo(): any {
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

// 싱글톤 인스턴스
export const socketClientCore = new SocketClientCore(); 