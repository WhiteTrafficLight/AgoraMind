// Free Discussion Backend Integration Types

export interface FreeDiscussionConfig {
  max_turns: number;
  turn_timeout_seconds: number;
  min_response_length: number;
  max_response_length: number;
  enable_interruptions: boolean;
  auto_play: boolean;
  turn_interval: number;
  allow_user_interruption: boolean;
  playback_speed: number;
}

export interface FreeDiscussionSession {
  session_id: string;
  topic: string;
  participants: string[];
  status: 'pending' | 'active' | 'paused' | 'completed' | 'error';
  created_at: string;
  last_activity: string;
  message_count: number;
  context?: string;
  user_id?: string;
  user_name?: string;
}

export interface FreeDiscussionMessage {
  id: string;
  session_id: string;
  sender: string;
  content: string;
  timestamp: string;
  message_type: 'moderator' | 'philosopher' | 'user' | 'system';
  metadata?: Record<string, unknown>;
}

export interface CreateFreeDiscussionRequest {
  topic: string;
  philosophers: string[];
  context?: string;
  user_info?: {
    user_id: string;
    user_name: string;
  };
  config?: Partial<FreeDiscussionConfig>;
}

export interface CreateFreeDiscussionResponse {
  session_id: string;
  topic: string;
  philosophers: string[];
  status: string;
}

export interface PlaybackControlEvent {
  event_type: 'pause' | 'resume' | 'speed_change' | 'turn_complete';
  session_id: string;
  data?: {
    speed?: number;
    current_turn?: number;
    max_turns?: number;
  };
}

export interface ConversationSummary {
  message_count: number;
  speaker_stats: Record<string, {
    message_count: number;
    total_words: number;
    avg_response_time?: number;
  }>;
  engagement_score: number;
  topic_shifts: number;
  status: string;
  last_speaker?: string;
}

export interface FreeDiscussionUIState {
  // Playback controls
  isAutoPlay: boolean;
  playbackSpeed: number;
  isPaused: boolean;
  currentTurn: number;
  maxTurns: number;
  
  // Session info
  sessionId: string | null;
  sessionStatus: FreeDiscussionSession['status'];
  sessionContext?: string;
  conversationMode: 'general_discussion' | 'focused_debate' | 'conclusion_building';
  
  // Speaker stats
  speakerStats: ConversationSummary['speaker_stats'];
  engagementScore: number;
  
  // User interaction
  allowInterruption: boolean;
  userQueuePosition: number | null;
  isProcessingControl: boolean;
  
  // UI state
  showPlaybackControls: boolean;
  showContextPanel: boolean;
  showStatsPanel: boolean;
  timelineView: 'compact' | 'expanded';
}

export interface PlaybackControls {
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (turn: number) => void;
  onInterrupt: () => void;
}

export interface PhilosopherTurn {
  philosopher: string;
  turnNumber: number;
  timestamp: string;
  preview?: string;
  relevanceScore?: number;
  isUserTurn?: boolean;
}

export interface TimelineMarker {
  turn: number;
  speaker: string;
  timestamp: string;
  color: string;
  isHighlight?: boolean;
}

