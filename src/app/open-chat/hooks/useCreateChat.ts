import { useState, useRef } from 'react';
import { ChatRoomCreationParams } from '../types/openChat.types';
import { freeDiscussionService } from '@/lib/api/freeDiscussionService';
import { loggers } from '@/utils/logger';

export const useCreateChat = () => {
  const [isCreating, setIsCreating] = useState(false);
  const isCreatingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const createChat = async (params: ChatRoomCreationParams) => {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreating(true);
    setError(null);

    try {
      console.log('🚀 useCreateChat: Starting chat creation...', { dialogueType: params.dialogueType });
      
      // Check if this is a free discussion
      if (params.dialogueType === 'free' && params.freeDiscussionConfig) {
        // 1) Create room in MongoDB first
        const roomResponse = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...params,
            dialogueType: 'free',
            generateInitialMessage: false
          })
        });
        if (!roomResponse.ok) throw new Error('Failed to create chat room');
        const dbRoom = await roomResponse.json();

        // 2) Create Free Discussion session in backend
        const session = await freeDiscussionService.createSession({
          topic: params.title,
          philosophers: params.npcs,
          context: params.context,
          user_info: {
            user_id: params.username || 'anonymous',
            user_name: params.username || 'Anonymous User'
          },
          config: {
            max_turns: params.freeDiscussionConfig.max_turns,
            turn_timeout_seconds: 30,
            min_response_length: 50,
            max_response_length: 500,
            enable_interruptions: params.freeDiscussionConfig.allow_user_interruption,
            auto_play: params.freeDiscussionConfig.auto_play,
            turn_interval: params.freeDiscussionConfig.turn_interval,
            allow_user_interruption: params.freeDiscussionConfig.allow_user_interruption,
            playback_speed: params.freeDiscussionConfig.playback_speed
          }
        });

        // 3) Fire-and-forget mapping PUT (do not block UX)
        fetch(`/api/rooms?id=${encodeURIComponent(dbRoom.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ freeDiscussionSessionId: session.session_id })
        }).catch(() => {});

        // 4) Route to session for immediate usability
        if (typeof window !== 'undefined') {
          window.location.href = `/chat?id=${encodeURIComponent(session.session_id)}`;
        }

        // Return minimal info (not used after redirect)
        return { ...dbRoom, dialogueType: 'free', freeDiscussionSessionId: session.session_id } as any;
      } else {
        console.log('🎪 Creating regular chat room...');
        
        // Handle regular chat creation (debate, socratic, etc.)
        const response = await fetch('/api/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          throw new Error('Failed to create chat room');
        }

        const chatRoom = await response.json();
        return chatRoom;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      loggers.ui.error('Error creating chat:', err);
      throw err;
    } finally {
      setIsCreating(false);
      isCreatingRef.current = false;
    }
  };

  return {
    createChat,
    isCreating,
    error,
  };
};
