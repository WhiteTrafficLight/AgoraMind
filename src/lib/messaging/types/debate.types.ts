import { BaseMessage, BaseRoom, SocketEvents } from './common.types';

// Debate 메시지 타입
export interface DebateMessage extends BaseMessage {
  metadata?: {
    stage?: string;
    position?: 'pro' | 'con' | 'neutral';
    turnNumber?: number;
    event_type?: 'debate_message' | 'moderator_message';
  };
}

// Debate 방 타입
export interface DebateRoom extends BaseRoom {
  dialogueType: 'debate';
  pro: string[];
  con: string[];
  neutral: string[];
  debate_info?: {
    current_stage: string;
    pro_participants: string[];
    con_participants: string[];
    total_turns: number;
  };
  moderator?: {
    style_id: string;
    style: string;
  };
}

// Debate 소켓 이벤트
export interface DebateSocketEvents extends SocketEvents {
  // 토론 흐름 관련
  'request-next-message': (data: { roomId: string }) => void;
  'next-speaker-update': (data: { roomId: string; nextSpeaker: NextSpeaker }) => void;
  'debate-stage-change': (data: { roomId: string; stage: string }) => void;
  
  // 참가자 관리
  'npc-selected': (data: { npc_id: string; roomId: string }) => void;
  'user_turn': (data: { is_user: boolean; speaker_id?: string }) => void;
  'user_message': (data: { message: string; user_id: string }) => void;
  
  // 토론 메시지
  'debate-message': (data: { roomId: string; message: DebateMessage }) => void;
}

// 다음 발언자 정보
export interface NextSpeaker {
  speaker_id: string;
  role: 'moderator' | 'pro' | 'con' | 'neutral';
  is_user: boolean;
  stage: string;
}

// 토론 설정
export interface DebateConfig {
  roomId: string;
  title: string;
  context?: string;
  pro_npcs: string[];
  con_npcs: string[];
  user_ids: string[];
  moderator_style: string;
}

// 토론 상태
export interface DebateState {
  currentStage: string;
  isUserTurn: boolean;
  selectedNpcId: string | null;
  messagesLength: number;
  isGeneratingResponse: boolean;
} 