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
  // RAG 관련 정보 추가
  rag_used?: boolean;
  rag_source_count?: number;
  rag_sources?: Array<{
    source: string;
    content: string;
    relevance_score?: number;
    type?: 'web' | 'context' | 'dialogue' | 'philosopher';
  }>;
}

// 방 정보 타입
export interface BaseRoom {
  id: string;
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
  roomId: string;
  username: string;
}

export interface SendMessageData {
  roomId: string;
  message: string;
  sender: string;
}

export interface GetActiveUsersData {
  roomId: string;
}

// 인용 정보 인터페이스
export interface Citation {
  id: string;       // 각주 ID (예: "1", "2")
  text: string;     // 원문 텍스트
  source: string;   // 출처 (책 이름)
  location?: string; // 위치 정보 (선택사항)
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  isUser: boolean;
  timestamp: Date;
  citations?: Citation[];
  isSystemMessage?: boolean;
  role?: string;
  skipAnimation?: boolean;
  isGenerating?: boolean;
  metadata?: { [key: string]: any };
  // RAG 관련 정보 추가
  rag_used?: boolean;
  rag_source_count?: number;
  rag_sources?: Array<{
    source: string;
    content: string;
    relevance_score?: number;
    type?: 'web' | 'context' | 'dialogue' | 'philosopher';
  }>;
}

export interface ClientToServerEvents {
  // ... existing code ...
  'user-joined': (data: { roomId: string; username: string; userCount: number }) => void;
  'user-left': (data: { roomId: string; username: string; userCount: number }) => void;
  'new-message': (message: ChatMessage) => void;
  'typing': (data: { username: string; isTyping: boolean }) => void;
  'room-updated': (room: any) => void;
  'error': (error: { message: string; code?: string }) => void;
  'notification': (data: { type: string; message: string }) => void;
  'debate-turn-changed': (data: { 
    currentSpeaker: string; 
    stage: string; 
    roomId: string; 
  }) => void;
  'user-message-complete': (data: { message: ChatMessage; roomId: string }) => void;
  
  // 토론 관련 이벤트
  'debate-phase-change': (data: { 
    roomId: string;
    newPhase: string; 
    message?: string 
  }) => void;
  
  'debate-turn-notification': (data: { 
    roomId: string;
    currentSpeaker: string; 
    turnType: 'user' | 'npc';
    timeRemaining?: number;
  }) => void;
  
  'debate-message-complete': (data: { 
    roomId: string;
    message: ChatMessage;
    nextSpeaker?: string;
  }) => void;
} 