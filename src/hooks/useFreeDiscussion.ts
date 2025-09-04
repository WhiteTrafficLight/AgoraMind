import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  FreeDiscussionUIState, 
  FreeDiscussionMessage,
  CreateFreeDiscussionRequest,
  FreeDiscussionConfig,
  PlaybackControlEvent
} from '@/app/open-chat/types/freeDiscussion.types';
import { freeDiscussionService } from '@/lib/api/freeDiscussionService';
import socketClient from '@/lib/socket/socketClient';

const DEFAULT_CONFIG: Partial<FreeDiscussionConfig> = {
  auto_play: true,
  turn_interval: 3.0,
  playback_speed: 1.0,
  max_turns: 50,
  allow_user_interruption: true,
};

export const useFreeDiscussion = (chatId: string, username: string) => {
  const [state, setState] = useState<FreeDiscussionUIState>({
    isAutoPlay: true,
    playbackSpeed: 1.0,
    isPaused: false,
    currentTurn: 0,
    maxTurns: 50,
    sessionId: null,
    sessionStatus: 'pending',
    conversationMode: 'general_discussion',
    speakerStats: {},
    engagementScore: 0,
    allowInterruption: true,
    userQueuePosition: null,
    isProcessingControl: false,
    showPlaybackControls: true,
    showContextPanel: false,
    showStatsPanel: false,
    timelineView: 'compact',
  });

  const [messages, setMessages] = useState<FreeDiscussionMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<any>(null);

  // Initialize Free Discussion session
  const initializeSession = useCallback(async (request: CreateFreeDiscussionRequest) => {
    try {
      const config = { ...DEFAULT_CONFIG, ...request.config };
      const response = await freeDiscussionService.createSession({
        ...request,
        config,
      });

      setState(prev => ({
        ...prev,
        sessionId: response.session_id,
        sessionStatus: 'active',
        isAutoPlay: config.auto_play || true,
        playbackSpeed: config.playback_speed || 1.0,
        maxTurns: config.max_turns || 50,
      }));

      return response.session_id;
    } catch (error) {
      console.error('Failed to initialize session:', error);
      setState(prev => ({ ...prev, sessionStatus: 'error' }));
      throw error;
    }
  }, []);

  // Playback control handlers
  const handlePlay = useCallback(async () => {
    if (!state.sessionId) return;
    
    setState(prev => ({ ...prev, isProcessingControl: true }));
    try {
      await freeDiscussionService.resumeSession(state.sessionId);
      setState(prev => ({ 
        ...prev, 
        isPaused: false,
        isProcessingControl: false 
      }));
    } catch (error) {
      console.error('Failed to resume:', error);
      setState(prev => ({ ...prev, isProcessingControl: false }));
    }
  }, [state.sessionId]);

  const handlePause = useCallback(async () => {
    if (!state.sessionId) return;
    
    setState(prev => ({ ...prev, isProcessingControl: true }));
    try {
      await freeDiscussionService.pauseSession(state.sessionId);
      setState(prev => ({ 
        ...prev, 
        isPaused: true,
        isProcessingControl: false 
      }));
    } catch (error) {
      console.error('Failed to pause:', error);
      setState(prev => ({ ...prev, isProcessingControl: false }));
    }
  }, [state.sessionId]);

  const handleSpeedChange = useCallback(async (speed: number) => {
    if (!state.sessionId) return;
    
    setState(prev => ({ ...prev, isProcessingControl: true }));
    try {
      await freeDiscussionService.updateSettings(state.sessionId, { 
        playback_speed: speed 
      });
      setState(prev => ({ 
        ...prev, 
        playbackSpeed: speed,
        isProcessingControl: false 
      }));
    } catch (error) {
      console.error('Failed to update speed:', error);
      setState(prev => ({ ...prev, isProcessingControl: false }));
    }
  }, [state.sessionId]);

  const handleUserInterruption = useCallback(async (content: string) => {
    if (!state.sessionId || !state.allowInterruption) return;
    
    try {
      await freeDiscussionService.sendUserMessage(
        state.sessionId, 
        username, 
        content
      );
    } catch (error) {
      console.error('Failed to send interruption:', error);
    }
  }, [state.sessionId, state.allowInterruption, username]);

  // Socket event handlers
  useEffect(() => {
    if (!isConnected || !socketRef.current || !state.sessionId) return;

    const handleControlEvent = (event: PlaybackControlEvent) => {
      if (event.session_id !== state.sessionId) return;

      switch (event.event_type) {
        case 'pause':
          setState(prev => ({ ...prev, isPaused: true }));
          break;
        case 'resume':
          setState(prev => ({ ...prev, isPaused: false }));
          break;
        case 'speed_change':
          if (event.data?.speed) {
            setState(prev => ({ ...prev, playbackSpeed: event.data!.speed! }));
          }
          break;
        case 'turn_complete':
          if (event.data?.current_turn) {
            setState(prev => ({ 
              ...prev, 
              currentTurn: event.data!.current_turn! 
            }));
          }
          break;
      }
    };

    const handleNewMessage = (data: { roomId: string; message: any }) => {
      if (String(data.roomId) === String(chatId)) {
        const raw = data.message || {};
        const normalized = {
          id: raw.id || `${Date.now()}`,
          session_id: state.sessionId || String(chatId),
          sender: raw.sender || raw.senderName || 'Unknown',
          content: raw.content || raw.text || '',
          text: raw.text || raw.content || '',
          timestamp: raw.timestamp || new Date().toISOString(),
          message_type: raw.message_type 
            || (raw.isUser ? 'user' : ((raw.role === 'philosopher' || raw.senderType === 'npc') ? 'philosopher' : 'system')),
          senderType: raw.senderType || (raw.isUser ? 'user' : ((raw.role === 'philosopher') ? 'philosopher' : 'system')),
          isUser: raw.isUser ?? (raw.message_type === 'user'),
          npc_id: raw.npc_id,
          role: raw.role,
          metadata: raw.metadata || {},
          senderName: raw.senderName,
        } as any;

        setMessages(prev => [...prev, normalized]);

        // Update turn count
        if (normalized.message_type === 'philosopher') {
          setState(prev => ({ ...prev, currentTurn: prev.currentTurn + 1 }));
        }
      }
    };

    socketRef.current.on('control:conversation:paused', handleControlEvent);
    socketRef.current.on('control:conversation:resumed', handleControlEvent);
    socketRef.current.on('control:playback:speed_changed', handleControlEvent);
    // Backend emits "new_message" (underscore), align listener name
    socketRef.current.on('new_message', handleNewMessage);

    return () => {
      socketRef.current.off('control:conversation:paused', handleControlEvent);
      socketRef.current.off('control:conversation:resumed', handleControlEvent);
      socketRef.current.off('control:playback:speed_changed', handleControlEvent);
      socketRef.current.off('new_message', handleNewMessage);
    };
  }, [state.sessionId, chatId, isConnected]);

  // Initialize socket connection
  useEffect(() => {
    const initSocket = async () => {
      try {
        const instance = await socketClient.init(username);
        socketRef.current = instance;
        setIsConnected(true);
        
        if (state.sessionId) {
          // Join backend Socket.IO room using server's expected event/payload
          (instance as any).emit?.('join_room', {
            room_id: String(chatId),
            user_id: username || 'anonymous'
          });
        }
      } catch (error) {
        console.error('Socket initialization failed:', error);
        setIsConnected(false);
      }
    };

    initSocket();

    return () => {
      if (socketRef.current && state.sessionId) {
        (socketRef.current as any).emit?.('leave_room', {
          room_id: String(chatId),
          user_id: username || 'anonymous'
        });
      }
    };
  }, [username, chatId, state.sessionId]);

  // Update conversation stats periodically
  useEffect(() => {
    if (!state.sessionId || state.sessionStatus !== 'active') return;

    const updateStats = async () => {
      try {
        const summary = await freeDiscussionService.getConversationSummary(state.sessionId!);
        setState(prev => ({
          ...prev,
          speakerStats: summary.speaker_stats,
          engagementScore: summary.engagement_score,
        }));
      } catch (error) {
        console.error('Failed to update stats:', error);
      }
    };

    const interval = setInterval(updateStats, 10000); // Every 10 seconds
    updateStats(); // Initial update

    return () => clearInterval(interval);
  }, [state.sessionId, state.sessionStatus]);

  return {
    state,
    messages,
    isConnected,
    controls: {
      onPlay: handlePlay,
      onPause: handlePause,
      onSpeedChange: handleSpeedChange,
      onSeek: () => {}, // TODO: Implement seek functionality
      onInterrupt: handleUserInterruption,
    },
    initializeSession,
    updateUIState: (updates: Partial<FreeDiscussionUIState>) => {
      setState(prev => ({ ...prev, ...updates }));
    },
  };
};
