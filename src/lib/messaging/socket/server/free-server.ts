import { Socket } from 'socket.io';
import { socketCore } from './socket-core';
import { FreeMessage, FreeSocketEvents } from '../../types/free.types';
import { SendMessageData } from '../../types/common.types';
import chatRoomDB from '@/lib/db/chatRoomDB';

export class FreeSocketServer {
  
  // Free 채팅 이벤트 핸들러 등록
  registerHandlers(socket: Socket): void {
    // 기존 핸들러 제거 (중복 등록 방지)
    socket.removeAllListeners('send-message');
    socket.removeAllListeners('auto-conversation-start');
    socket.removeAllListeners('auto-conversation-stop');
    
    console.log(`🔧 [FREE] Registering fresh handlers for socket ${socket.id}`);
    
    // 메시지 전송 처리
    socket.on('send-message', (data: SendMessageData) => this.handleSendMessage(socket, data));
    
    // 자동 대화 관련
    socket.on('auto-conversation-start', (data) => this.handleAutoConversationStart(socket, data));
    socket.on('auto-conversation-stop', (data) => this.handleAutoConversationStop(socket, data));
    
    console.log(`✅ [FREE] Handlers registered for socket ${socket.id}`);
  }

  // 메시지 전송 처리
  private async handleSendMessage(socket: Socket, data: SendMessageData): Promise<void> {
    try {
      const roomId = String(data.roomId);
      const messageText = typeof data.message === 'string' ? data.message : data.message;

      // 메시지 객체 생성
      const message: FreeMessage = {
        id: `user-${Date.now()}`,
        text: messageText,
        sender: data.sender,
        senderType: 'user',
        isUser: true,
        timestamp: new Date(),
        metadata: {
          conversationId: roomId
        }
      };

      console.log(`💬 [FREE] Message from ${data.sender} in room ${roomId}: ${messageText.substring(0, 50)}...`);

      // MongoDB에 메시지 저장
      try {
        const dbMessage = { ...message, timestamp: message.timestamp as Date };
        await chatRoomDB.addMessage(roomId, dbMessage as any);
        console.log(`✅ [FREE] Message saved to MongoDB: ${message.id}`);
      } catch (dbError) {
        console.error('❌ [FREE] MongoDB 저장 오류:', dbError);
      }

      // 다른 사용자들에게 브로드캐스트 (발신자 제외)
      socket.broadcast.to(roomId).emit('new-message', {
        roomId: roomId,
        message: message
      });
      console.log(`📢 [FREE] Message broadcasted to room ${roomId}`);

      // AI 응답 생성 (사용자 메시지인 경우)
      if (message.isUser) {
        await this.generateAIResponse(roomId, message);
      }

    } catch (error) {
      console.error('❌ [FREE] Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  // AI 응답 생성
  private async generateAIResponse(roomId: string, userMessage: FreeMessage): Promise<void> {
    try {
      console.log(`🤖 [FREE] Generating AI response for room ${roomId}`);

      // 방 정보 가져오기
      const room = await chatRoomDB.getChatRoomById(roomId);
      if (!room) {
        console.error(`❌ [FREE] Room not found: ${roomId}`);
        return;
      }

      // 자동 대화 모드 확인
      const isAutoActive = await this.checkAutoConversationStatus(roomId);
      if (isAutoActive) {
        console.log(`🔍 [FREE] Auto conversation active - skipping manual AI response`);
        return;
      }

      // Python 백엔드에 AI 응답 요청
      const response = await this.requestAIResponse(roomId, userMessage, room);
      if (response) {
        // AI 메시지 브로드캐스트
        socketCore.broadcastToRoom(roomId, 'new-message', {
          roomId: roomId,
          message: response
        });
        console.log(`✅ [FREE] AI response broadcasted to room ${roomId}`);
      }

    } catch (error) {
      console.error('❌ [FREE] AI response generation error:', error);
    }
  }

  // Python 백엔드에 AI 응답 요청
  private async requestAIResponse(roomId: string, userMessage: FreeMessage, room: any): Promise<FreeMessage | null> {
    try {
      const response = await fetch('http://localhost:8000/api/chat/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          room_id: roomId,
          user_message: userMessage.text,
          npcs: room?.participants?.npcs || [],
          topic: room?.title,
          context: room?.context,
          llm_provider: 'openai',
          llm_model: 'gpt-4o',
          api_key: process.env.OPENAI_API_KEY
        }),
      });

      if (!response.ok) {
        throw new Error(`Python API error: ${response.status}`);
      }

      const responseData = await response.json();
      if (responseData && responseData.response && responseData.philosopher) {
        const aiMessage: FreeMessage = {
          id: `ai-${Date.now()}`,
          text: responseData.response,
          sender: responseData.philosopher,
          senderType: 'npc',
          isUser: false,
          timestamp: new Date(),
          metadata: {
            isAutoGenerated: false,
            conversationId: roomId,
            ...responseData.metadata
          },
          citations: responseData.citations || []
        };

        // MongoDB에 AI 메시지 저장
        const dbMessage = { ...aiMessage, timestamp: aiMessage.timestamp as Date };
        await chatRoomDB.addMessage(roomId, dbMessage as any);
        return aiMessage;
      }

      return null;
    } catch (error) {
      console.error('❌ [FREE] Python API request failed:', error);
      return null;
    }
  }

  // 자동 대화 상태 확인
  private async checkAutoConversationStatus(roomId: string): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:8000/api/auto-conversation/status?room_id=${roomId}`);
      if (response.ok) {
        const data = await response.json();
        return data.active === true;
      }
    } catch (error) {
      console.error('❌ [FREE] Auto conversation status check failed:', error);
    }
    return false;
  }

  // 자동 대화 시작
  private async handleAutoConversationStart(socket: Socket, data: { roomId: string; npcs: string[] }): Promise<void> {
    try {
      console.log(`🔄 [FREE] Starting auto conversation in room ${data.roomId}`);
      
      // Python 백엔드에 자동 대화 시작 요청
      const response = await fetch('http://localhost:8000/api/auto-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: data.roomId,
          npcs: data.npcs
        })
      });

      if (response.ok) {
        socketCore.broadcastToRoom(data.roomId, 'auto-conversation-status', {
          roomId: data.roomId,
          isActive: true
        });
        console.log(`✅ [FREE] Auto conversation started in room ${data.roomId}`);
      }
    } catch (error) {
      console.error('❌ [FREE] Auto conversation start failed:', error);
    }
  }

  // 자동 대화 중지
  private async handleAutoConversationStop(socket: Socket, data: { roomId: string }): Promise<void> {
    try {
      console.log(`⏹️ [FREE] Stopping auto conversation in room ${data.roomId}`);
      
      const response = await fetch('http://localhost:8000/api/auto-conversation', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: data.roomId })
      });

      if (response.ok) {
        socketCore.broadcastToRoom(data.roomId, 'auto-conversation-status', {
          roomId: data.roomId,
          isActive: false
        });
        console.log(`✅ [FREE] Auto conversation stopped in room ${data.roomId}`);
      }
    } catch (error) {
      console.error('❌ [FREE] Auto conversation stop failed:', error);
    }
  }
}

export const freeSocketServer = new FreeSocketServer(); 