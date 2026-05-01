export interface Citation {
  id: string;
  text: string;
  source: string;
  location?: string;
}

export interface RagSource {
  type?: string;
  url?: string;
  title?: string;
  content?: string;
  metadata?: { url?: string; file_path?: string; [key: string]: unknown };
  [key: string]: unknown;
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
  rag_sources?: RagSource[];
}

export interface NpcDetail {
  id: string;
  name: string;
  description?: string;
  communication_style?: string;
  debate_approach?: string;
  voice_style?: string;
  portrait_url?: string;
  reference_philosophers?: string[];
  is_custom: boolean;
  created_by?: string;
}

export interface ChatRoom {
  id: string;
  title: string;
  context?: string;
  participants: {
    users: string[];
    npcs: string[];
  };
  totalParticipants: number;
  lastActivity: string;
  messages?: ChatMessage[];
  isPublic: boolean;
  npcDetails?: NpcDetail[];
  initial_message?: ChatMessage;
  dialogueType?: string;
  pro?: string[];
  con?: string[];
  neutral?: string[];
  moderator?: {
    style_id?: string;
    style?: string;
  };
  debate_info?: {
    current_stage?: string;
    pro_participants?: string[];
    con_participants?: string[];
    total_turns?: number;
  };
  freeDiscussionSessionId?: string;
  freeDiscussionConfig?: {
    auto_play: boolean;
    playback_speed: number;
    turn_interval: number;
    max_turns: number;
    allow_user_interruption: boolean;
  };
}

export interface ChatRoomCreationParams {
  title: string;
  context?: string;
  contextUrl?: string;
  contextFileContent?: string;
  maxParticipants: number;
  npcs: string[];
  isPublic?: boolean;
  currentUser?: string;
  username?: string;
  generateInitialMessage?: boolean;
  llmProvider?: string;
  llmModel?: string;
  dialogueType?: string;
  npcPositions?: Record<string, 'pro' | 'con'>;
  userDebateRole?: 'pro' | 'con' | 'neutral';
  moderator?: {
    style_id?: string;
    style?: string;
  };
}
