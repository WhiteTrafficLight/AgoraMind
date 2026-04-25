
import { socketClientCore } from '@/lib/messaging/socket/client/socket-client-core';
import { SocketEvents } from '@/lib/messaging/types/common.types';
import { Socket } from 'socket.io-client';

/* eslint-disable @typescript-eslint/no-explicit-any -- handler payloads vary per event; consumers narrow at use site. */
type SocketHandler = (...args: any[]) => void | Promise<void>;
/* eslint-enable @typescript-eslint/no-explicit-any */

class SocketClient {
  private core = socketClientCore;

  async initialize(): Promise<Socket> {
    return await this.core.connect();
  }

  // init (initialize )
  async init(_username?: string): Promise<Socket> {
    return await this.core.connect();
  }

  joinRoom(roomId: string, username: string): void {
    this.core.joinRoom(roomId, username);
  }

  leaveRoom(roomId: string, username: string): void {
    this.core.leaveRoom(roomId, username);
  }

  sendMessage(roomId: string, message: string, sender: string): void {
    this.core.sendMessage(roomId, message, sender);
  }

  on(event: string, handler: SocketHandler): void {
    this.core.on(event as keyof SocketEvents, handler as SocketEvents[keyof SocketEvents]);
  }

  off(event: string, handler?: SocketHandler): void {
    this.core.off(event as keyof SocketEvents, handler as SocketEvents[keyof SocketEvents] | undefined);
  }

  emit(event: string, data: unknown): void {
    this.core.emit(event, data);
  }

  isConnected(): boolean {
    return this.core.getConnectionStatus();
  }

  getSocket(): Socket | null {
    return this.core.getSocket();
  }

  disconnect(): void {
    this.core.disconnect();
  }

  getDebugInfo(): ReturnType<typeof socketClientCore.getDebugInfo> {
    return this.core.getDebugInfo();
  }
}

// export ( )
const socketClient = new SocketClient();
export default socketClient;

// export
export { socketClientCore }; 