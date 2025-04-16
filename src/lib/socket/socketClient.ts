import { io, Socket } from 'socket.io-client';
import { ChatMessage } from '@/lib/ai/chatService';

// Type definitions for events
interface ServerToClientEvents {
  'new-message': (message: ChatMessage) => void;
  'thinking': (data: { sender: string }) => void;
  'user-joined': (data: { username: string; usersInRoom: string[]; participants: any }) => void;
  'user-left': (data: { username: string; usersInRoom: string[] }) => void;
  'error': (data: { message: string }) => void;
}

interface ClientToServerEvents {
  'join-room': (data: { roomId: string | number; username: string }) => void;
  'leave-room': (data: { roomId: string | number; username: string }) => void;
  'send-message': (data: { roomId: string | number; message: string; sender: string }) => void;
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
    'error': [],
    'connect': [],
    'disconnect': []
  };
  
  // Initialize the socket connection
  public init(username: string = 'User') {
    this.username = username;
    
    // Clean up any existing connection
    if (this.socket) {
      this.socket.disconnect();
    }
    
    // Create new socket connection
    // In development, connect to the same host; in production use your deployment URL
    const socketUrl = process.env.NODE_ENV === 'development' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;
      
    this.socket = io(socketUrl, {
      path: '/api/socket',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    // Bind event listeners
    this._bindEvents();
    
    return this;
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
    this.socket.on('new-message', (message) => {
      console.log('New message received:', message);
      this._triggerListeners('new-message', message);
    });
    
    this.socket.on('thinking', (data) => {
      console.log('Thinking indicator:', data);
      this._triggerListeners('thinking', data);
    });
    
    this.socket.on('user-joined', (data) => {
      console.log('User joined:', data);
      this._triggerListeners('user-joined', data);
    });
    
    this.socket.on('user-left', (data) => {
      console.log('User left:', data);
      this._triggerListeners('user-left', data);
    });
    
    this.socket.on('error', (data) => {
      console.error('Socket error:', data);
      this._triggerListeners('error', data);
    });
  }
  
  // Join a chat room
  public joinRoom(roomId: string | number) {
    if (!this.socket?.connected) {
      console.error('Socket not connected');
      return;
    }
    
    this.socket.emit('join-room', {
      roomId,
      username: this.username
    });
  }
  
  // Leave a chat room
  public leaveRoom(roomId: string | number) {
    if (!this.socket?.connected) {
      console.error('Socket not connected');
      return;
    }
    
    this.socket.emit('leave-room', {
      roomId,
      username: this.username
    });
  }
  
  // Send a message to a chat room
  public sendMessage(roomId: string | number, message: string) {
    if (!this.socket?.connected) {
      console.error('Socket not connected');
      return false;
    }
    
    this.socket.emit('send-message', {
      roomId,
      message,
      sender: this.username
    });
    
    return true;
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
}

// Export as singleton
const socketClient = new SocketClient();
export default socketClient; 