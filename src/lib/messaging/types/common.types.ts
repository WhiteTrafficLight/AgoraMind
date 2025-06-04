// 공통 메시지 타입
export interface BaseMessage {
  id: string;
  text: string;
  sender: string;
  senderType: 'user' | 'npc' | 'moderator' | 'system';
  isUser: boolean;
  timestamp: Date | string;
  metadata?: Record<string, any>;
  citations?: any[];
}

// 방 정보 타입
export interface BaseRoom {
  id: string | number;
  title: string;
  context?: string;
  participants: {
    users: string[];
    npcs: string[];
  };
  totalParticipants: number;
  lastActivity: string;
  messages: BaseMessage[];
  isPublic: boolean;
  dialogueType: 'free' | 'debate' | 'socratic' | 'dialectical';
}

// 소켓 이벤트 타입
export interface SocketEvents {
  // 공통 이벤트
  'join-room': (data: { roomId: string; username: string }) => void;
  'leave-room': (data: { roomId: string; username: string }) => void;
  'send-message': (data: { roomId: string; message: BaseMessage }) => void;
  'new-message': (data: { roomId: string; message: BaseMessage }) => void;
  'user-joined': (data: { roomId: string; username: string; userCount: number }) => void;
  'user-left': (data: { roomId: string; username: string; userCount: number }) => void;
  'room-created': (room: BaseRoom) => void;
  'typing': (data: { roomId: string; username: string; isTyping: boolean }) => void;
  'error': (data: { message: string; code?: string }) => void;
}

// 연결된 사용자 정보
export interface ConnectedUser {
  socketId: string;
  username: string;
  rooms: string[];
}

// 이벤트 데이터 타입들
export interface JoinRoomData {
  roomId: string | number;
  username: string;
}

export interface SendMessageData {
  roomId: string | number;
  message: string;
  sender: string;
}

export interface GetActiveUsersData {
  roomId: string | number;
} 