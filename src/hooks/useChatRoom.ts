'use client';

import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react';
import { chatService, ChatRoom } from '@/lib/ai/chatService';
import { loggers } from '@/utils/logger';

interface UseChatRoomResult {
  chatData: ChatRoom | null;
  setChatData: Dispatch<SetStateAction<ChatRoom | null>>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

async function fetchRoom(chatId: string): Promise<ChatRoom | null> {
  loggers.chat.info(`CHAT PAGE V2: Fetching chat room with ID: ${chatId}`);
  const room = await chatService.getChatRoomById(chatId);
  if (!room) return null;
  loggers.chat.info(`CHAT PAGE V2: Successfully loaded room #${room.id} (${room.title})`);
  if (!room.dialogueType) {
    room.dialogueType = 'free';
  }
  return room;
}

export function useChatRoom(chatIdParam: string | null): UseChatRoomResult {
  const [chatData, setChatData] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setChatData(null);

    if (!chatIdParam || chatIdParam.trim() === '') {
      if (chatIdParam !== null) {
        loggers.chat.error(`Invalid chat ID format: ${chatIdParam}`);
        setError('Invalid chat room ID format');
      } else {
        setError('No chat ID provided');
      }
      setLoading(false);
      return;
    }

    const chatId = chatIdParam;
    let cancelled = false;

    (async () => {
      try {
        const room = await fetchRoom(chatId);
        if (cancelled) return;
        if (!room) {
          loggers.chat.error('Room not found  ID:', chatId);
          setError('Chat room not found');
          return;
        }
        setChatData(room);
      } catch (err) {
        if (cancelled) return;
        loggers.chat.error('Failed to load chat:', err);
        setError('Failed to load chat data. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chatIdParam]);

  const refresh = useCallback(async () => {
    if (!chatData) return;
    loggers.chat.debug('useChatRoom.refresh called');
    setLoading(true);
    try {
      const room = await fetchRoom(String(chatData.id));
      if (room) {
        loggers.chat.debug('Messages fetched from server:', room.messages?.length || 0);
        setChatData(room);
        loggers.chat.info('Refresh complete - data replaced');
      }
    } catch (err) {
      loggers.chat.error('Failed to refresh chat:', err);
    } finally {
      setLoading(false);
    }
  }, [chatData]);

  return { chatData, setChatData, loading, error, refresh };
}
