'use client';

import { Dispatch, SetStateAction, useCallback, useState } from 'react';
import { ChatMessage, ChatRoom } from '@/lib/ai/chatService';
import { apiUrl, ENDPOINTS } from '@/lib/api/endpoints';
import { loggers } from '@/utils/logger';

interface UseDebateChatDeps {
  chatData: ChatRoom | null;
  setChatData: Dispatch<SetStateAction<ChatRoom | null>>;
  username: string;
}

interface UserTurn {
  speaker_id: string;
  role: string;
}

interface UseDebateChatResult {
  isGeneratingResponse: boolean;
  waitingForUserInput: boolean;
  currentUserTurn: UserTurn | null;
  requestNextMessage: () => Promise<void>;
  processUserMessage: (message: string) => Promise<void>;
}

const focusDebateInput = () => {
  setTimeout(() => {
    const el = document.querySelector('.debate-input-field') as HTMLTextAreaElement | null;
    el?.focus();
  }, 500);
};

const roleLabel = (role: string) => (role === 'pro' ? 'Pro' : role === 'con' ? 'Con' : role);

export function useDebateChat(deps: UseDebateChatDeps): UseDebateChatResult {
  const { chatData, setChatData, username } = deps;

  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  const [waitingForUserInput, setWaitingForUserInput] = useState(false);
  const [currentUserTurn, setCurrentUserTurn] = useState<UserTurn | null>(null);

  const requestNextMessage = useCallback(async () => {
    if (!chatData) return;

    try {
      setIsGeneratingResponse(true);
      loggers.chat.info('Requesting next debate message  room:', chatData.id);

      const roomId = String(chatData.id);
      const response = await fetch(apiUrl(ENDPOINTS.chat.debateNextMessage(roomId)), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Next message request failed');
      }

      const data = await response.json();
      loggers.chat.info('Next speaker info received:', data);

      if (data.status === 'success') {
        if (data.next_speaker) {
          const { speaker_id, role, is_user } = data.next_speaker;
          loggers.chat.info('Next speaker details:', { speaker_id, role, is_user });
          loggers.chat.info('Current username:', username);

          if (is_user === true) {
            loggers.chat.info('USER TURN CONFIRMED - activating input');
            loggers.chat.info('Speaker ID:', speaker_id, 'Role:', role);
            setCurrentUserTurn({ speaker_id, role });
            setWaitingForUserInput(true);
            setIsGeneratingResponse(false);
            const message = `It's your turn to speak as the ${roleLabel(role)} side. Please enter your opinion.`;
            loggers.chat.info('Showing user turn alert:', message);
            alert(message);
            focusDebateInput();
            return;
          }
          loggers.chat.info('Not user turn - is_user is false');
        } else {
          loggers.chat.warn('No next_speaker data in success response');
        }
        loggers.chat.info('Success response but not user turn - treating as AI turn');
        setIsGeneratingResponse(false);
      } else if (data.status === 'generating') {
        loggers.chat.info('AI generating message - showing thinking animation');
        const tempMessage: ChatMessage = {
          id: `temp-waiting-${Date.now()}`,
          text: 'Generating message...',
          sender: data.speaker_id,
          isUser: false,
          timestamp: new Date(),
          isGenerating: true,
          skipAnimation: true,
        };
        setChatData((prev) =>
          prev ? { ...prev, messages: [...(prev.messages || []), tempMessage] } : prev,
        );
        loggers.chat.info('Temporary message added, waiting  AI response via Socket.IO');
      } else if (data.status === 'completed') {
        loggers.chat.info('Debate completed');
        alert('The debate has been completed!');
        setIsGeneratingResponse(false);
      } else {
        throw new Error(data.message || 'Unknown response status');
      }
    } catch (error) {
      loggers.chat.error('Error requesting next message:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      alert(`Error occurred while requesting next message: ${errorMessage}`);
      setIsGeneratingResponse(false);
    }
  }, [chatData, setChatData, username]);

  const processUserMessage = useCallback(async (message: string) => {
    if (!currentUserTurn || !chatData) {
      loggers.chat.error('Cannot process user message - missing currentUserTurn or chatData');
      return;
    }

    try {
      loggers.chat.info('Processing user message:', message);
      loggers.chat.info('Current user turn:', currentUserTurn);
      loggers.chat.info('Username:', username);

      const roomId = String(chatData.id);
      const requestBody = {
        message,
        user_id: currentUserTurn.speaker_id,
      };
      loggers.chat.info('Sending user message request:', requestBody);

      const response = await fetch(
        apiUrl(ENDPOINTS.chat.debateProcessUserMessage(roomId)),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to process user message');
      }

      const result = await response.json();
      loggers.chat.info('User message processed:', result);

      if (result.status === 'success') {
        loggers.chat.info('User message successfully processed - clearing user turn state');
        setWaitingForUserInput(false);
        setCurrentUserTurn(null);
        loggers.chat.info('Requesting next AI message...');
        setTimeout(() => {
          requestNextMessage();
        }, 1000);
      } else if (result.status === 'error' && result.reason === 'not_your_turn') {
        loggers.chat.error('Not user turn:', result.message);
        alert(`It's currently ${result.next_speaker}'s turn.`);
        setWaitingForUserInput(false);
        setCurrentUserTurn(null);
      } else {
        throw new Error(result.message || 'Failed to process user message');
      }
    } catch (error) {
      loggers.chat.error('Error processing user message:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      alert(`Error occurred while processing message: ${errorMessage}`);
      setWaitingForUserInput(false);
      setCurrentUserTurn(null);
    }
  }, [chatData, currentUserTurn, username, requestNextMessage]);

  return {
    isGeneratingResponse,
    waitingForUserInput,
    currentUserTurn,
    requestNextMessage,
    processUserMessage,
  };
}
