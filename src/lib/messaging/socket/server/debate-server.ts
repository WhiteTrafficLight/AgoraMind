import { Socket } from 'socket.io';
import { socketCore } from './socket-core';
import { DebateMessage, NextSpeaker } from '../../types/debate.types';
import { SendMessageData } from '../../types/common.types';
import chatRoomDB from '@/lib/db/chatRoomDB';
import type { ChatMessage } from '@/lib/ai/chatService';
import { API_BASE_URL } from '@/lib/api/baseUrl';
import { loggers } from '@/utils/logger';

export class DebateSocketServer {
  
  // Debate
  registerHandlers(socket: Socket): void {
    socket.removeAllListeners('send-message');
    socket.removeAllListeners('request-next-message');
    socket.removeAllListeners('npc-selected');
    socket.removeAllListeners('user_message');
    
    loggers.socket.info(`🔧 [DEBATE] Registering fresh handlers for socket ${socket.id}`);
    
    socket.on('send-message', (data: SendMessageData) => this.handleSendMessage(socket, data));
    
    socket.on('request-next-message', (data) => this.handleRequestNextMessage(socket, data));
    
    socket.on('npc-selected', (data) => this.handleNpcSelected(socket, data));
    socket.on('user_message', (data) => this.handleUserMessage(socket, data));
    
    loggers.socket.info(`✅ [DEBATE] Handlers registered for socket ${socket.id}`);
  }

  private async handleSendMessage(socket: Socket, data: SendMessageData): Promise<void> {
    try {
      const roomId = String(data.roomId);
      const messageText = typeof data.message === 'string' ? data.message : data.message;

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

      loggers.socket.info(`🎭 [DEBATE] Message from ${data.sender} in room ${roomId}: ${messageText.substring(0, 50)}...`);

      try {
        const dbMessage: ChatMessage = { ...message, timestamp: message.timestamp as Date };
        await chatRoomDB.addMessage(roomId, dbMessage);
        loggers.socket.info(`✅ [DEBATE] Message saved to MongoDB: ${message.id}`);
      } catch (dbError) {
        loggers.socket.error('[DEBATE] MongoDB save error:', dbError);
      }

      socket.broadcast.to(roomId).emit('new-message', {
        roomId: roomId,
        message: message
      });
      loggers.socket.info(`📢 [DEBATE] Message broadcasted to room ${roomId}`);

      await this.updateNextSpeaker(roomId);

    } catch (error) {
      loggers.socket.error('❌ [DEBATE] Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  private async handleRequestNextMessage(socket: Socket, data: { roomId: string }): Promise<void> {
    try {
      loggers.socket.info(`🔄 [DEBATE] Next message requested for room ${data.roomId}`);

      // Python
      const response = await fetch(`${API_BASE_URL}/api/chat/debate/${data.roomId}/next-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        await response.json();
        loggers.socket.info(`✅ [DEBATE] Next message generation initiated for room ${data.roomId}`);
        
        // Python Socket.IO
        socket.emit('next-message-requested', { 
          roomId: data.roomId, 
          status: 'processing' 
        });
      } else {
        throw new Error(`Python API error: ${response.status}`);
      }

    } catch (error) {
      loggers.socket.error('❌ [DEBATE] Request next message error:', error);
      socket.emit('error', { message: 'Failed to request next message' });
    }
  }

  private async handleNpcSelected(socket: Socket, data: { npc_id: string; roomId: string }): Promise<void> {
    try {
      loggers.socket.info(`👤 [DEBATE] NPC selected: ${data.npc_id} in room ${data.roomId}`);

      socketCore.broadcastToRoom(data.roomId, 'npc-selected', {
        npc_id: data.npc_id,
        roomId: data.roomId
      });

      socketCore.broadcastToRoom(data.roomId, 'user_turn', {
        is_user: false,
        speaker_id: data.npc_id
      });

    } catch (error) {
      loggers.socket.error('❌ [DEBATE] NPC selection error:', error);
    }
  }

  private async handleUserMessage(socket: Socket, data: { message: string; user_id: string }): Promise<void> {
    try {
      loggers.socket.info(`💬 [DEBATE] User message from ${data.user_id}: ${data.message.substring(0, 50)}...`);

      socket.broadcast.emit('user_message', {
        message: data.message,
        user_id: data.user_id
      });

    } catch (error) {
      loggers.socket.error('❌ [DEBATE] User message handling error:', error);
    }
  }

  // (pro/con/neutral)
  private async getUserPosition(roomId: string, username: string): Promise<'pro' | 'con' | 'neutral'> {
    try {
      const room = await chatRoomDB.getChatRoomById(roomId);
      if (room && room.dialogueType === 'debate') {
        if (room.pro?.includes(username)) return 'pro';
        if (room.con?.includes(username)) return 'con';
        return 'neutral';
      }
    } catch (error) {
      loggers.socket.error('❌ [DEBATE] Error getting user position:', error);
    }
    return 'neutral';
  }

  private async updateNextSpeaker(roomId: string): Promise<void> {
    try {
      // Python
      const response = await fetch(`${API_BASE_URL}/api/dialogue/${roomId}/next-speaker`, {
        method: 'POST'
      });

      if (response.ok) {
        const nextSpeaker: NextSpeaker = await response.json();
        
        socketCore.broadcastToRoom(roomId, 'next-speaker-update', {
          roomId: roomId,
          nextSpeaker: nextSpeaker
        });

        loggers.socket.info(`📢 [DEBATE] Next speaker updated: ${nextSpeaker.speaker_id} (${nextSpeaker.role})`);
      }
    } catch (error) {
      loggers.socket.error('❌ [DEBATE] Error updating next speaker:', error);
    }
  }

  // Python (Socket.IO )
  handleIncomingDebateMessage(roomId: string, message: DebateMessage): void {
    try {
      loggers.socket.info(`📨 [DEBATE] Incoming message from Python backend: ${message.sender}`);

      socketCore.broadcastToRoom(roomId, 'new-message', {
        roomId: roomId,
        message: message
      });

      loggers.socket.info(`✅ [DEBATE] Backend message broadcasted to room ${roomId}`);
    } catch (error) {
      loggers.socket.error('❌ [DEBATE] Error handling incoming message:', error);
    }
  }
}

export const debateSocketServer = new DebateSocketServer(); 