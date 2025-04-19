// chatStorage.ts - 채팅 데이터를 저장하고 공유하는 모듈
import { ChatRoom, ChatMessage } from '@/lib/ai/chatService';

// 글로벌 변수로 채팅룸 데이터 저장
// Next.js 서버리스 함수들이 이 변수를 공유할 수 있음
const chatStorage = {
  chatRooms: [
    {
      id: 1,
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
      id: 2,
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
  ],

  // 채팅룸 조회
  getChatRooms: function() {
    return this.chatRooms;
  },

  // ID로 채팅룸 조회
  getChatRoomById: function(id: string | number) {
    const idStr = String(id);
    console.log(`Storage: 채팅룸 ${idStr} 조회 요청`);
    const room = this.chatRooms.find(r => String(r.id) === idStr);
    console.log(`Storage: 채팅룸 ${idStr} 조회 결과:`, room ? '찾음' : '없음');
    return room;
  },

  // 채팅룸 생성
  createChatRoom: function(room: ChatRoom) {
    console.log(`Storage: 채팅룸 ${room.id} 생성`);
    this.chatRooms.push(room);
    return room;
  },

  // 메시지 추가
  addMessage: function(roomId: string | number, message: ChatMessage) {
    const idStr = String(roomId);
    console.log(`Storage: 채팅룸 ${idStr}에 메시지 추가 요청`);
    
    const roomIndex = this.chatRooms.findIndex(r => String(r.id) === idStr);
    if (roomIndex === -1) {
      console.log(`Storage: 채팅룸 ${idStr} 없음`);
      return false;
    }
    
    if (!this.chatRooms[roomIndex].messages) {
      this.chatRooms[roomIndex].messages = [];
    }
    
    // 중복 메시지 확인
    const isDuplicate = this.chatRooms[roomIndex].messages?.some(
      existingMsg => existingMsg.id === message.id
    );
    
    if (isDuplicate) {
      console.log(`Storage: 중복 메시지 ${message.id}, 건너뜀`);
      return false;
    }
    
    // 메시지 추가
    this.chatRooms[roomIndex].messages?.push(message);
    this.chatRooms[roomIndex].lastActivity = 'Just now';
    
    console.log(`Storage: 메시지 추가 완료, 현재 메시지 수: ${this.chatRooms[roomIndex].messages?.length}`);
    return true;
  },

  // 채팅룸 정보 업데이트
  updateChatRoom: function(roomId: string | number, updates: Partial<ChatRoom>) {
    const idStr = String(roomId);
    const roomIndex = this.chatRooms.findIndex(r => String(r.id) === idStr);
    if (roomIndex === -1) return false;
    
    this.chatRooms[roomIndex] = { ...this.chatRooms[roomIndex], ...updates };
    return true;
  }
};

export default chatStorage; 