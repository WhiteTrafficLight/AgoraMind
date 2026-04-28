// chatStorage.ts -
import { ChatRoom, ChatMessage } from '@/lib/ai/chatService';
import { loggers } from '@/utils/logger';

// Next.js
const chatStorage: {
  chatRooms: ChatRoom[];
  getChatRooms: () => ChatRoom[];
  getChatRoomById: (id: string | number) => ChatRoom | undefined;
  createChatRoom: (room: ChatRoom) => ChatRoom;
  addMessage: (roomId: string | number, message: ChatMessage) => boolean;
  updateChatRoom: (roomId: string | number, updates: Partial<ChatRoom>) => boolean;
} = {
  chatRooms: ([
    {
      id: '1',
      title: 'The Nature of Consciousness',
      context: 'Exploring the philosophical aspects of consciousness and its relationship to the brain.',
      participants: {
        users: ['User123', 'User456'],
        npcs: ['Socrates', 'Kant']
      },
      totalParticipants: 4,
      lastActivity: '2 hours ago',
      isPublic: true,
      messages: [
        {
          id: 'sys-init-1',
          text: 'Welcome to the philosophical dialogue on "The Nature of Consciousness".',
          sender: 'System',
          isUser: false,
          timestamp: new Date(Date.now() - 7200000)
        }
      ]
    },
    {
      id: '2',
      title: 'Ethics in the Digital Age',
      context: 'Discussing the moral implications of technology and its impacts on society.',
      participants: {
        users: ['User789'],
        npcs: ['Plato', 'Nietzsche']
      },
      totalParticipants: 3,
      lastActivity: '4 hours ago',
      isPublic: true,
      messages: [
        {
          id: 'sys-init-2',
          text: 'Welcome to the philosophical dialogue on "Ethics in the Digital Age".',
          sender: 'System',
          isUser: false,
          timestamp: new Date(Date.now() - 14400000)
        }
      ]
    },
  ] as unknown) as ChatRoom[],

  getChatRooms: function() {
    return this.chatRooms;
  },

  getChatRoomById: function(id: string | number) {
    const idStr = String(id);
    loggers.chat.info(`Storage: chat room ${idStr} lookup request`);
    const room = this.chatRooms.find(r => String(r.id) === idStr);
    loggers.chat.info(`Storage: chat room ${idStr} lookup result:`, room ? 'found' : 'not found');
    return room;
  },

  createChatRoom: function(room: ChatRoom) {
    loggers.chat.info(`Storage: chat room ${room.id} create`);
    this.chatRooms.push(room);
    return room;
  },

  addMessage: function(roomId: string | number, message: ChatMessage) {
    const idStr = String(roomId);
    loggers.chat.info(`Storage: chat room ${idStr}add message request`);
    
    const roomIndex = this.chatRooms.findIndex(r => String(r.id) === idStr);
    if (roomIndex === -1) {
      loggers.chat.info(`Storage: chat room ${idStr} not found`);
      return false;
    }
    
    if (!this.chatRooms[roomIndex].messages) {
      this.chatRooms[roomIndex].messages = [];
    }
    
    const isDuplicate = this.chatRooms[roomIndex].messages?.some(
      existingMsg => existingMsg.id === message.id
    );
    
    if (isDuplicate) {
      loggers.chat.info(`Storage: duplicate message ${message.id}, skipped`);
      return false;
    }
    
    this.chatRooms[roomIndex].messages?.push(message);
    this.chatRooms[roomIndex].lastActivity = 'Just now';
    
    loggers.chat.info(`Storage: Message added; current count: ${this.chatRooms[roomIndex].messages?.length}`);
    return true;
  },

  updateChatRoom: function(roomId: string | number, updates: Partial<ChatRoom>) {
    const idStr = String(roomId);
    const roomIndex = this.chatRooms.findIndex(r => String(r.id) === idStr);
    if (roomIndex === -1) return false;
    
    this.chatRooms[roomIndex] = { ...this.chatRooms[roomIndex], ...updates };
    return true;
  }
};

export default chatStorage; 