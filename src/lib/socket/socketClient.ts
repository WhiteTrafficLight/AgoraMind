import { io, Socket } from 'socket.io-client';
import { ChatMessage } from '@/lib/ai/chatService';

// Type definitions for events
interface ServerToClientEvents {
  'new-message': (data: { roomId: string, message: ChatMessage }) => void;
  'thinking': (data: { sender: string }) => void;
  'user-joined': (data: { username: string; usersInRoom: string[]; participants: any }) => void;
  'user-left': (data: { username: string; usersInRoom: string[] }) => void;
  'active-users': (data: { roomId: string; users: string[] }) => void;
  'error': (data: { message: string }) => void;
  'room-created': (data: { roomId: string; roomName: string }) => void;
  'pong': (data: { time: number, serverTime: number }) => void;
}

interface ClientToServerEvents {
  'join-room': (data: { roomId: string | number; username: string }) => void;
  'leave-room': (data: { roomId: string | number; username: string }) => void;
  'send-message': (data: { roomId: string | number; message: ChatMessage }) => void;
  'get-active-users': (roomId: string | number) => void;
  'ping': (data: { time: number, username: string }) => void;
}

// Socket.io client wrapper class
class SocketClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private username: string = '';
  private listeners: Record<string, Function[]> = {
    'new-message': [],
    'thinking': [],
    'user-joined': [],
    'user-left': [],
    'active-users': [],
    'error': [],
    'connect': [],
    'disconnect': []
  };
  
  // Initialize the socket connection
  public async init(username: string = 'User'): Promise<SocketClient> {
    this.username = username;
    
    // ❶ 서버에 SocketHandler를 한 번 띄워 줍니다 - await the fetch
    try {
      console.log('Initializing server socket handler...');
      
      // 서버 초기화 방식 수정 - GET 요청 사용
      const res = await fetch('/api/socket', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        console.error(`Socket initialization failed with status: ${res.status}, message: ${errorText}`);
        throw new Error(`Failed to initialize socket server: ${res.status}`);
      } else {
        console.log('✅ Server socket handler ready');
      }
    } catch (error) {
      console.error('Error fetching /api/socket:', error);
      // 오류를 기록하되 계속 진행
      console.log('Attempting to connect directly to socket server...');
    }
    
    // Clean up any existing connection
    if (this.socket) {
      this.socket.disconnect();
    }
    
    // 네트워크 주소 확인 및 설정
    // 내부 개발 환경에서 localhost나 IP 주소를 자동으로 감지하여 사용
    const getSocketUrl = () => {
      // 브라우저 환경에서만 실행
      if (typeof window === 'undefined') return '';
      
      // 현재 URL 정보 가져오기
      const currentUrl = window.location.origin;
      console.log('Current URL:', currentUrl);
      
      // 명시적인 환경변수 값이 있으면 그것을 사용
      if (process.env.NEXT_PUBLIC_SOCKET_URL) {
        return process.env.NEXT_PUBLIC_SOCKET_URL;
      }
      
      // 현재 접속 URL 사용 (LAN 환경에서 접속 시 IP 주소 자동 감지)
      return currentUrl;
    };
    
    // Socket.IO 연결 URL 생성
    const socketUrl = getSocketUrl();
    console.log('Connecting to socket server at:', socketUrl);
    
    // Connection 로그 메시지 출력 (디버깅 및 사용자 안내용)
    console.log(`
==== Socket.IO Connection Info ====
URL: ${socketUrl}
Path: /api/socket/io
User: ${username}
Time: ${new Date().toLocaleTimeString()}
================================
    `);
    
    // Create new socket connection with improved options
    this.socket = io(socketUrl, {
      path: '/api/socket/io', // ⚡️ Must match server's path setting exactly!
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,  // 재연결 시도 횟수 증가
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000, // 최대 10초까지 지수적으로 대기
      timeout: 30000,  // 타임아웃 증가
      transports: ['websocket', 'polling'], // 웹소켓 먼저 시도, 실패 시 폴링으로 폴백
      forceNew: true,
      auth: {
        username: username,
        clientId: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      },
      extraHeaders: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
    
    // Socket.IO 연결 디버깅 함수 추가
    this._setupDebugListeners(socketUrl);
    
    // Bind event listeners
    this._bindEvents();
    
    // Wait for connection or timeout
    try {
      await this._waitForConnection(5000);
    } catch (err) {
      console.warn('Socket connection timeout or error, continuing anyway:', err);
    }
    
    // Return this instance explicitly with the SocketClient type
    return this as SocketClient;
  }
  
  // Helper method to wait for connection with timeout
  private _waitForConnection(timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // If already connected, resolve immediately
      if (this.socket?.connected) {
        resolve();
        return;
      }
      
      // Wait for connect event
      const onConnectSuccess = () => {
        console.log('Socket connected in waitForConnection promise');
        this.socket?.off('connect_error', onConnectError);
        clearTimeout(timeoutId);
        resolve();
      };
      
      // Handle connection error
      const onConnectError = (err?: any) => {
        console.error('Socket connection error in waitForConnection promise:', err);
        this.socket?.off('connect', onConnectSuccess);
        clearTimeout(timeoutId);
        reject(new Error('Socket connection error'));
      };
      
      // Set a timeout to avoid hanging
      const timeoutId = setTimeout(() => {
        console.warn('Socket connection timed out in waitForConnection promise');
        this.socket?.off('connect', onConnectSuccess);
        this.socket?.off('connect_error', onConnectError);
        reject(new Error('Socket connection timeout'));
      }, timeoutMs);
      
      // Listen for connection events
      this.socket?.once('connect', onConnectSuccess);
      this.socket?.once('connect_error', onConnectError);
    });
  }
  
  // Socket.IO 연결 디버깅을 위한 리스너 설정
  private _setupDebugListeners(socketUrl: string) {
    if (!this.socket) return;
    
    // 연결 오류 리스너
    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      // 연결 정보 출력 (타입 안전하게)
      console.log('Socket ID:', this.socket?.id || 'unknown');
      console.log('Connected:', this.socket?.connected || false);
      console.log('Current URL:', window.location.href);
      console.log('Socket URL being used:', socketUrl);
      console.log('Socket Transport:', this.socket?.io?.engine?.transport?.name || 'unknown');
      
      // Socket.IO 타임아웃 오류인 경우 추가 정보 표시
      if (err.message === 'timeout') {
        console.error('Connection timed out. Check if server is running and accessible from your network.');
        console.log('If you are connecting from a different device, make sure both devices are on the same network.');
        console.log('You might need to allow connections through your firewall or antivirus.');
      }
      
      // 웹소켓 관련 오류인 경우 추가 정보
      if (err.message.includes('websocket')) {
        console.error('WebSocket error detected. This might be due to:');
        console.log('1. Proxy or firewall blocking WebSocket connections');
        console.log('2. Network configuration issues between client and server');
        console.log('3. Browser WebSocket implementation issues');
        console.log('Attempting to use polling as a fallback...');
        
        // 소켓 설정 수정 시도 - 폴링으로만 시도
        if (this.socket?.io) {
          this.socket.io.opts.transports = ['polling'];
          console.log('Changed transport to polling only');
        }
      }
      
      // 서버 오류인 경우 추가 정보 표시 
      if (err.message === 'server error') {
        console.error('Server error occurred. The socket.io server might be misconfigured or experiencing issues.');
        console.log('Try restarting the server with "npm run dev"');
        
        // 1초 후 재연결 시도 
        setTimeout(() => {
          console.log('Attempting to reconnect...');
          this.socket?.connect();
        }, 1000);
      }
      
      // 디버깅: 글로벌 창에 소켓 에러 설정
      if (typeof window !== 'undefined') {
        // @ts-ignore
        if (!window._socketDebug) window._socketDebug = {};
        // @ts-ignore
        window._socketDebug.error = err.message;
        // @ts-ignore
        window._socketDebug.connected = false;
      }
    });
    
    // 연결 이벤트
    this.socket.on('connect', () => {
      console.log('Socket successfully connected!');
      console.log('Socket ID:', this.socket?.id);
      console.log('Transport:', this.socket?.io?.engine?.transport?.name || 'unknown');
      
      // 디버깅: 글로벌 창에 소켓 ID 설정
      if (typeof window !== 'undefined') {
        // @ts-ignore
        if (!window._socketDebug) window._socketDebug = {};
        // @ts-ignore
        window._socketDebug.socketId = this.socket?.id;
        // @ts-ignore
        window._socketDebug.connected = true;
        // @ts-ignore
        window._socketDebug.url = this.socket?.io.uri;
      }
    });
    
    // 연결 끊김 이벤트
    this.socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected. Reason: ${reason}`);
      
      // 서버 측 연결 끊김인 경우에만 자동 재연결 시도
      if (reason === 'io server disconnect' || reason === 'transport error') {
        console.log('Attempting to reconnect in 2 seconds...');
        setTimeout(() => {
          this.socket?.connect();
        }, 2000);
      }
      
      // 디버깅: 글로벌 창 업데이트
      if (typeof window !== 'undefined') {
        // @ts-ignore
        if (!window._socketDebug) window._socketDebug = {};
        // @ts-ignore
        window._socketDebug.connected = false;
        // @ts-ignore
        window._socketDebug.disconnectReason = reason;
      }
    });
  }
  
  // Private method to bind the built-in socket events
  private _bindEvents() {
    if (!this.socket) return;
    
    // Basic Socket.io events
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this._triggerListeners('connect');
    });
    
    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this._triggerListeners('disconnect');
    });
    
    // Custom app events
    this.socket.on('new-message', (data) => {
      console.log('New message received via socket:', data);
      this._triggerListeners('new-message', data);
    });
    
    this.socket.on('thinking', (data) => {
      console.log('Thinking indicator:', data);
      this._triggerListeners('thinking', data);
    });
    
    // Pong response for connection testing
    this.socket.on('pong', (data) => {
      const roundTripTime = Date.now() - data.time;
      console.log(`📡 PONG received! Round-trip time: ${roundTripTime}ms`);
      console.log(`📡 Server time: ${new Date(data.serverTime).toISOString()}`);
      
      // Show an alert for easy testing
      if (typeof window !== 'undefined') {
        window.alert(`Socket connection working! Round-trip time: ${roundTripTime}ms`);
      }
    });
    
    // 채팅방 참가자 이벤트 
    this.socket.on('user-joined', (data) => {
      console.log('User joined:', data);
      this._triggerListeners('user-joined', data);
    });
    
    this.socket.on('user-left', (data) => {
      console.log('User left:', data);
      this._triggerListeners('user-left', data);
    });
    
    this.socket.on('active-users', (data) => {
      console.log('Active users update:', data);
      this._triggerListeners('active-users', data);
    });
    
    this.socket.on('error', (data) => {
      console.error('Socket error:', data);
      this._triggerListeners('error', data);
    });
    
    // Room Created 이벤트 추가 - 새 채팅방이 만들어졌을 때
    this.socket.on('room-created', (data) => {
      console.log('🔊 SOCKET EVENT: room-created received', data);
      this._triggerListeners('room-created', data);
    });
  }
  
  // Join a chat room
  public joinRoom(roomId: string | number) {
    console.log(`Attempting to join room: ${roomId}`);
    
    // Check if socket exists and is connected before attempting to join
    if (!this.socket) {
      console.error('Cannot join room: Socket not initialized');
      return false;
    }
    
    // Always try to join, but log connection status
    if (!this.socket.connected) {
      console.warn(`Socket not connected when joining room ${roomId}, connection will be pending`);
    }
    
    try {
      this.socket.emit('join-room', {
        roomId,
        username: this.username
      });
      console.log(`Join room request sent for: ${roomId}`);
      return true;
    } catch (error) {
      console.error('Error joining room:', error);
      return false;
    }
  }
  
  // Leave a chat room
  public leaveRoom(roomId: string | number) {
    if (!this.socket?.connected) {
      console.error('Socket not connected');
      return;
    }
    
    console.log('Socket leaving room:', roomId, typeof roomId);
    
    this.socket.emit('leave-room', {
      roomId,
      username: this.username
    });
  }
  
  // Send a message to a chat room
  public sendMessage(roomId: string | number, message: string) {
    console.log('⚡️ socketClient.sendMessage 호출됨 - TRACE:', new Error().stack);
    console.log('⚡️ 전송 파라미터:', { roomId, messageText: message });
    console.log('⚡️ Socket 객체 존재 여부:', !!this.socket);
    console.log('⚡️ Socket 연결 상태:', this.socket?.connected ? '연결됨' : '연결안됨');
    
    if (!this.socket) {
      console.error('❌ Socket 객체가 존재하지 않음 - Cannot send message');
      return false;
    }
    
    if (!this.socket.connected) {
      console.error('❌ Socket not connected - Cannot send message');
      return false;
    }
    
    try {
      console.log('📨 Socket 메시지 전송 시작 - 방:', roomId, '타입:', typeof roomId);
      
      // IMPORTANT: Convert roomId to string for consistency
      const roomIdStr = String(roomId);
      
      // Create a formatted message object - simplified for reliable transmission
      const messageObj = {
        id: `socket-${Date.now()}`,
        text: message,
        sender: this.username,
        isUser: true,
        timestamp: new Date()  // Keep as Date object for type compatibility
      };
      
      console.log('📨 생성된 메시지 객체:', messageObj);
      
      // Emit the message object
      console.log('🔆 Emit 직전 - Socket 객체 존재 여부:', !!this.socket);
      console.log('🔆 Emit 직전 - Socket 연결 상태:', this.socket?.connected);
      console.log('🔆 Socket ID:', this.socket?.id);
      
      try {
        // Directly use this.socket.emit with a simplified payload
        console.log('⚡️ 실제 socket.emit 직전:', {
          eventName: 'send-message',
          payload: {
            roomId: roomIdStr,
            message: messageObj
          }
        });
        
        // Get internal socket details for debugging
        console.log('⚡️ Socket 내부 상태:', {
          id: this.socket.id,
          connected: this.socket.connected,
          disconnected: this.socket.disconnected,
          transport: this.socket.io?.engine?.transport?.name
        });
        
        this.socket.emit('send-message', {
          roomId: roomIdStr,
          message: messageObj
        });
        console.log('✅ 메시지 emit 완료 - 이벤트명: "send-message", 데이터:', { roomId: roomIdStr, message: messageObj });
      } catch (emitError) {
        console.error('🔥 EMIT ERROR:', emitError);
        throw emitError;
      }
      
      return true;
    } catch (error) {
      console.error('💥 메시지 전송 중 오류 발생:', error);
      return false;
    }
  }
  
  // Get active users in a room
  public getActiveUsers(roomId: string | number) {
    if (!this.socket?.connected) {
      console.error('Socket not connected');
      return;
    }
    
    this.socket.emit('get-active-users', roomId);
  }
  
  // Add an event listener
  public on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return this;
  }
  
  // Remove an event listener
  public off(event: string, callback: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
    return this;
  }
  
  // Trigger all listeners for an event
  private _triggerListeners(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        callback(...args);
      });
    }
  }
  
  // Disconnect the socket
  public disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
  
  // Check if socket is connected
  public isConnected() {
    return this.socket?.connected || false;
  }
  
  // Get current username
  public getUsername() {
    return this.username;
  }
  
  // Set username
  public setUsername(username: string) {
    this.username = username;
    return this;
  }
  
  // Generate a random username
  public static generateRandomUsername() {
    return `User_${Math.floor(Math.random() * 10000)}`;
  }
  
  // Simple ping method to test socket communication
  public ping() {
    console.log('⚡ Sending ping to server...');
    if (!this.socket?.connected) {
      console.error('❌ Cannot ping: Socket not connected');
      return false;
    }
    
    try {
      this.socket.emit('ping', { time: Date.now(), username: this.username });
      console.log('✅ Ping sent successfully');
      return true;
    } catch (error) {
      console.error('❌ Error sending ping:', error);
      return false;
    }
  }
}

// Export as singleton
export const socketClient = new SocketClient();
export default socketClient;
export type { SocketClient }; 