import { useState } from 'react';
import { ChatRoomCreationParams } from '../types/openChat.types';
import { freeDiscussionService } from '@/lib/api/freeDiscussionService';
import { loggers } from '@/utils/logger';

export const useCreateChat = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createChat = async (params: ChatRoomCreationParams) => {
    setIsCreating(true);
    setError(null);

    try {
      console.log('🚀 useCreateChat: Starting chat creation...', { dialogueType: params.dialogueType });
      
      // Check if this is a free discussion
      if (params.dialogueType === 'free' && params.freeDiscussionConfig) {
        console.log('🎭 Creating Free Discussion session...');
        
        // Create Free Discussion session
        const response = await freeDiscussionService.createSession({
          topic: params.title,
          philosophers: params.npcs,
          context: params.context,
          user_info: {
            user_id: params.username || 'anonymous',
            user_name: params.username || 'Anonymous User',
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
            playback_speed: params.freeDiscussionConfig.playback_speed,
          },
        });

        console.log('✅ Free Discussion session created:', response);
        loggers.ui.info('Free Discussion session created:', response);
        
        // Create a chat room entry for UI consistency
        const chatRoom = {
          id: response.session_id,
          title: params.title,
          context: params.context,
          participants: {
            users: [params.username || 'anonymous'],
            npcs: params.npcs,
          },
          totalParticipants: params.npcs.length + 1,
          lastActivity: new Date().toISOString(),
          messages: [],
          isPublic: params.isPublic,
          dialogueType: 'free',
          freeDiscussionSessionId: response.session_id,
          freeDiscussionConfig: params.freeDiscussionConfig,
        };

        console.log('📦 Created chat room object:', chatRoom);
        
        // Store in local storage or state management
        return chatRoom;
      } else {
        console.log('🎪 Creating regular chat room...');
        
        // Handle regular chat creation (debate, socratic, etc.)
        const response = await fetch('/api/rooms/create', {
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
    }
  };

  return {
    createChat,
    isCreating,
    error,
  };
};
