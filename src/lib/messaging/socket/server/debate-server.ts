import { Socket } from 'socket.io';
import { socketCore } from './socket-core';
import { DebateMessage, NextSpeaker } from '../../types/debate.types';
import { SendMessageData } from '../../types/common.types';
import chatRoomDB from '@/lib/db/chatRoomDB';
import type { ChatMessage } from '@/lib/ai/chatService';

export class DebateSocketServer {
  
  // Debate 채팅 이벤트 핸들러 등록
  registerHandlers(socket: Socket): void {
    // 기존 핸들러 제거 (중복 등록 방지)
    socket.removeAllListeners('send-message');
    socket.removeAllListeners('request-next-message');
    socket.removeAllListeners('npc-selected');
    socket.removeAllListeners('user_message');
    
    console.log(`🔧 [DEBATE] Registering fresh handlers for socket ${socket.id}`);
    
    // 메시지 전송 처리
    socket.on('send-message', (data: SendMessageData) => this.handleSendMessage(socket, data));
    
    // 토론 흐름 관련
    socket.on('request-next-message', (data) => this.handleRequestNextMessage(socket, data));
    
    // 참가자 관리
    socket.on('npc-selected', (data) => this.handleNpcSelected(socket, data));
    socket.on('user_message', (data) => this.handleUserMessage(socket, data));
    
    console.log(`✅ [DEBATE] Handlers registered for socket ${socket.id}`);
  }

  // 메시지 전송 처리 (토론 컨텍스트)
  private async handleSendMessage(socket: Socket, data: SendMessageData): Promise<void> {
    try {
      const roomId = String(data.roomId);
      const messageText = typeof data.message === 'string' ? data.message : data.message;

      // 토론 메시지 객체 생성
      const message: DebateMessage = {
        id: `user-${Date.now()}`,
        text: messageText,
        sender: data.sender,
        senderType: 'user',
        isUser: true,
        timestamp: new Date(),
        metadata: {
          event_type: 'debate_message',
          position: await this.getUserPosition(roomId, data.sender)
        }
      };

      console.log(`🎭 [DEBATE] Message from ${data.sender} in room ${roomId}: ${messageText.substring(0, 50)}...`);

      // MongoDB에 메시지 저장
      try {
        const dbMessage: ChatMessage = { ...message, timestamp: message.timestamp as Date };
        await chatRoomDB.addMessage(roomId, dbMessage);
        console.log(`✅ [DEBATE] Message saved to MongoDB: ${message.id}`);
      } catch (dbError) {
        console.error('❌ [DEBATE] MongoDB 저장 오류:', dbError);
      }

      // 다른 사용자들에게 브로드캐스트 (발신자 제외)
      socket.broadcast.to(roomId).emit('new-message', {
        roomId: roomId,
        message: message
      });
      console.log(`📢 [DEBATE] Message broadcasted to room ${roomId}`);

      // 다음 발언자 정보 업데이트
      await this.updateNextSpeaker(roomId);

    } catch (error) {
      console.error('❌ [DEBATE] Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  // 다음 메시지 요청 처리
  private async handleRequestNextMessage(socket: Socket, data: { roomId: string }): Promise<void> {
    try {
      console.log(`🔄 [DEBATE] Next message requested for room ${data.roomId}`);

      // Python 백엔드에 다음 메시지 생성 요청
      const response = await fetch(`http://localhost:8000/api/chat/debate/${data.roomId}/next-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        await response.json();
        console.log(`✅ [DEBATE] Next message generation initiated for room ${data.roomId}`);
        
        // 응답은 Python 백엔드에서 Socket.IO로 직접 전송됨
        // 여기서는 성공 응답만 보냄
        socket.emit('next-message-requested', { 
          roomId: data.roomId, 
          status: 'processing' 
        });
      } else {
        throw new Error(`Python API error: ${response.status}`);
      }

    } catch (error) {
      console.error('❌ [DEBATE] Request next message error:', error);
      socket.emit('error', { message: 'Failed to request next message' });
    }
  }

  // NPC 선택 처리
  private async handleNpcSelected(socket: Socket, data: { npc_id: string; roomId: string }): Promise<void> {
    try {
      console.log(`👤 [DEBATE] NPC selected: ${data.npc_id} in room ${data.roomId}`);

      // 방의 모든 사용자에게 NPC 선택 알림
      socketCore.broadcastToRoom(data.roomId, 'npc-selected', {
        npc_id: data.npc_id,
        roomId: data.roomId
      });

      // 사용자 턴 상태 업데이트
      socketCore.broadcastToRoom(data.roomId, 'user_turn', {
        is_user: false,
        speaker_id: data.npc_id
      });

    } catch (error) {
      console.error('❌ [DEBATE] NPC selection error:', error);
    }
  }

  // 사용자 메시지 처리
  private async handleUserMessage(socket: Socket, data: { message: string; user_id: string }): Promise<void> {
    try {
      console.log(`💬 [DEBATE] User message from ${data.user_id}: ${data.message.substring(0, 50)}...`);

      // 사용자 메시지 정보를 방의 다른 참가자들에게 브로드캐스트
      socket.broadcast.emit('user_message', {
        message: data.message,
        user_id: data.user_id
      });

    } catch (error) {
      console.error('❌ [DEBATE] User message handling error:', error);
    }
  }

  // 사용자 포지션 조회 (pro/con/neutral)
  private async getUserPosition(roomId: string, username: string): Promise<'pro' | 'con' | 'neutral'> {
    try {
      const room = await chatRoomDB.getChatRoomById(roomId);
      if (room && room.dialogueType === 'debate') {
        // 사용자가 어느 포지션에 속하는지 확인
        if (room.pro?.includes(username)) return 'pro';
        if (room.con?.includes(username)) return 'con';
        return 'neutral';
      }
    } catch (error) {
      console.error('❌ [DEBATE] Error getting user position:', error);
    }
    return 'neutral';
  }

  // 다음 발언자 정보 업데이트
  private async updateNextSpeaker(roomId: string): Promise<void> {
    try {
      // Python 백엔드에서 다음 발언자 정보 조회
      const response = await fetch(`http://localhost:8000/api/dialogue/${roomId}/next-speaker`, {
        method: 'POST'
      });

      if (response.ok) {
        const nextSpeaker: NextSpeaker = await response.json();
        
        // 다음 발언자 정보 브로드캐스트
        socketCore.broadcastToRoom(roomId, 'next-speaker-update', {
          roomId: roomId,
          nextSpeaker: nextSpeaker
        });

        console.log(`📢 [DEBATE] Next speaker updated: ${nextSpeaker.speaker_id} (${nextSpeaker.role})`);
      }
    } catch (error) {
      console.error('❌ [DEBATE] Error updating next speaker:', error);
    }
  }

  // Python 백엔드로부터 받은 메시지를 처리 (Socket.IO를 통해)
  handleIncomingDebateMessage(roomId: string, message: DebateMessage): void {
    try {
      console.log(`📨 [DEBATE] Incoming message from Python backend: ${message.sender}`);

      // 방의 모든 사용자에게 새 메시지 브로드캐스트
      socketCore.broadcastToRoom(roomId, 'new-message', {
        roomId: roomId,
        message: message
      });

      console.log(`✅ [DEBATE] Backend message broadcasted to room ${roomId}`);
    } catch (error) {
      console.error('❌ [DEBATE] Error handling incoming message:', error);
    }
  }
}

export const debateSocketServer = new DebateSocketServer(); 