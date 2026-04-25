import { BaseMessage, BaseRoom, SocketEvents } from './common.types';

// Debate
export interface DebateMessage extends BaseMessage {
  metadata?: {
    stage?: string;
    position?: 'pro' | 'con' | 'neutral';
    turnNumber?: number;
    event_type?: 'debate_message' | 'moderator_message';
  };
}

// Debate
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

// Debate
export interface DebateSocketEvents extends SocketEvents {
  'request-next-message': (data: { roomId: string }) => void;
  'next-speaker-update': (data: { roomId: string; nextSpeaker: NextSpeaker }) => void;
  'debate-stage-change': (data: { roomId: string; stage: string }) => void;
  
  'npc-selected': (data: { npc_id: string; roomId: string }) => void;
  'user_turn': (data: { is_user: boolean; speaker_id?: string }) => void;
  'user_message': (data: { message: string; user_id: string }) => void;
  
  'debate-message': (data: { roomId: string; message: DebateMessage }) => void;
}

export interface NextSpeaker {
  speaker_id: string;
  role: 'moderator' | 'pro' | 'con' | 'neutral';
  is_user: boolean;
  stage: string;
}

export interface DebateConfig {
  roomId: string;
  title: string;
  context?: string;
  pro_npcs: string[];
  con_npcs: string[];
  user_ids: string[];
  moderator_style: string;
}

export interface DebateState {
  currentStage: string;
  isUserTurn: boolean;
  selectedNpcId: string | null;
  messagesLength: number;
  isGeneratingResponse: boolean;
} 