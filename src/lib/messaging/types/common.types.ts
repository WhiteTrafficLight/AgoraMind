export interface BaseMessage {
  id: string;
  text: string;
  sender: string;
  senderType: 'user' | 'npc' | 'moderator' | 'system';
  isUser: boolean;
  timestamp: Date | string;
  metadata?: Record<string, unknown>;
  citations?: Citation[];
  rag_used?: boolean;
  rag_source_count?: number;
  rag_sources?: Array<{
    source: string;
    content: string;
    relevance_score?: number;
    type?: 'web' | 'context' | 'dialogue' | 'philosopher';
  }>;
}

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

export interface SocketEvents {
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

export interface ConnectedUser {
  socketId: string;
  username: string;
  rooms: string[];
}

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

export interface Citation {
  id: string;
  text: string;
  source: string;
  location?: string;
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
  metadata?: { [key: string]: unknown };
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
  'room-updated': (room: BaseRoom) => void;
  'error': (error: { message: string; code?: string }) => void;
  'notification': (data: { type: string; message: string }) => void;
  'debate-turn-changed': (data: { 
    currentSpeaker: string; 
    stage: string; 
    roomId: string; 
  }) => void;
  'user-message-complete': (data: { message: ChatMessage; roomId: string }) => void;
  
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