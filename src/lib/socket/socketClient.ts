// 새로운 리팩터링된 Socket 클라이언트
// 기존 코드와의 호환성을 위한 래퍼

import { socketClientCore } from '@/lib/messaging/socket/client/socket-client-core';
import { BaseMessage } from '@/lib/messaging/types/common.types';
import { Socket } from 'socket.io-client';

// 기존 인터페이스와의 호환성을 위한 래퍼 클래스
class SocketClient {
  private core = socketClientCore;

  // 초기화 (기존 코드 호환성)
  async initialize(): Promise<Socket> {
    return await this.core.connect();
  }

  // 기존 코드 호환성을 위한 init 메서드 (initialize의 별칭)
  async init(username?: string): Promise<Socket> {
    const socket = await this.core.connect();
    // username이 제공된 경우 저장 (필요시 사용)
    return socket;
  }

  // 방 입장
  joinRoom(roomId: string | number, username: string): void {
    this.core.joinRoom(roomId, username);
  }

  // 방 떠나기  
  leaveRoom(roomId: string | number, username: string): void {
    this.core.leaveRoom(roomId, username);
  }

  // 메시지 전송
  sendMessage(roomId: string | number, message: string, sender: string): void {
    this.core.sendMessage(roomId, message, sender);
  }

  // 이벤트 리스너 등록
  on(event: string, handler: (...args: any[]) => void): void {
    this.core.on(event as any, handler);
  }

  // 이벤트 리스너 제거
  off(event: string, handler?: (...args: any[]) => void): void {
    this.core.off(event as any, handler);
  }

  // 이벤트 발송
  emit(event: string, data: any): void {
    this.core.emit(event, data);
  }

  // 연결 상태 확인
  isConnected(): boolean {
    return this.core.getConnectionStatus();
  }

  // Socket 인스턴스 반환
  getSocket(): Socket | null {
    return this.core.getSocket();
  }

  // 연결 해제
  disconnect(): void {
    this.core.disconnect();
  }

  // 디버그 정보
  getDebugInfo(): any {
    return this.core.getDebugInfo();
  }
}

// 싱글톤 인스턴스 export (기존 코드 호환성)
const socketClient = new SocketClient();
export default socketClient;

// 새로운 구조도 함께 export
export { socketClientCore }; 