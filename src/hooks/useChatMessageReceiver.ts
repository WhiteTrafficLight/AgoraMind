'use client';

import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from 'react';
import { ChatMessage, ChatRoom } from '@/lib/ai/chatService';
import { enrichFromMetadata } from '@/lib/chat/messageEnrichment';
import { loggers } from '@/utils/logger';

interface UseChatMessageReceiverDeps {
  chatData: ChatRoom | null;
  setChatData: Dispatch<SetStateAction<ChatRoom | null>>;
  setTypingMessageIds: Dispatch<SetStateAction<Set<string>>>;
}

interface IncomingPayload {
  roomId: string;
  message: ChatMessage;
}

const logRagInfo = (label: string, msg: ChatMessage) => {
  loggers.rag.debug(label, {
    rag_used: msg.rag_used,
    rag_source_count: msg.rag_source_count,
    rag_sources_length: msg.rag_sources?.length || 0,
  });
};

const persistMessage = async (roomId: string, message: ChatMessage) => {
  try {
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        message: {
          ...message,
          timestamp: message.timestamp || new Date().toISOString(),
        },
      }),
    });
    if (response.ok) {
      loggers.db.info('DB save successful');
    } else {
      const errorData = await response.json();
      loggers.db.error('DB save failed', errorData);
    }
  } catch (error) {
    loggers.db.error('DB save threw', error);
  }
};

/**
 * Returns a stable onMessage callback for the chat socket. Reads chatData
 * via a ref so the callback identity never changes (avoiding socket
 * rebinds) while it always sees the latest room id at call time.
 */
export function useChatMessageReceiver(
  deps: UseChatMessageReceiverDeps,
): (data: IncomingPayload) => Promise<void> {
  const { chatData, setChatData, setTypingMessageIds } = deps;

  const chatDataRef = useRef(chatData);
  useEffect(() => {
    chatDataRef.current = chatData;
  }, [chatData]);

  return useCallback(async (data: IncomingPayload) => {
    loggers.chat.debug('Socket event received: new-message');
    loggers.chat.debug('Received data', {
      roomId: data.roomId,
      messagePreview: JSON.stringify(data).substring(0, 300),
    });

    const currentRoomId = String(chatDataRef.current?.id);
    const receivedRoomId = String(data.roomId);

    loggers.chat.debug('Room ID comparison', { currentRoomId, receivedRoomId });

    if (currentRoomId !== receivedRoomId || !data.message) {
      loggers.chat.warn('Room ID mismatch or no message', {
        currentRoom: currentRoomId,
        receivedRoom: receivedRoomId,
        hasMessage: !!data.message,
      });
      return;
    }

    loggers.chat.info('Room IDs match — saving message to DB then updating UI');
    loggers.chat.debug('Message content', {
      preview: data.message.text?.substring(0, 100),
      eventType: data.message.metadata?.event_type,
    });

    const isCompleteMessage = data.message.metadata?.event_type === 'debate_message_complete';
    const isUserMessage = data.message.isUser === true;

    try {
      if (isCompleteMessage || isUserMessage) {
        loggers.db.info('Starting message DB save', {
          messageType: isUserMessage ? 'User message' : 'AI message',
        });
        await persistMessage(currentRoomId, data.message);
      }

      setChatData((prev) => {
        if (!prev) return prev;

        if (isCompleteMessage) {
          loggers.chat.debug('Replacing temporary message with completed message');
          const messagesCopy = [...(prev.messages || [])];
          const tempIndex = messagesCopy.findIndex(
            (msg) => msg.isGenerating && msg.sender === data.message.sender,
          );

          if (tempIndex >= 0) {
            const completeMessage = enrichFromMetadata(data.message);
            messagesCopy[tempIndex] = completeMessage;
            loggers.chat.info('Temporary message replaced');
            logRagInfo('RAG info', completeMessage);
            setTimeout(() => {
              setTypingMessageIds((ids) => new Set([...ids, completeMessage.id]));
            }, 100);
          } else {
            loggers.chat.warn('Temporary message not found; adding new');
            const newMessage = enrichFromMetadata(data.message);
            logRagInfo('RAG info  regular message', newMessage);
            messagesCopy.push(newMessage);
          }
          return { ...prev, messages: messagesCopy };
        }

        loggers.chat.debug('Adding regular message');
        const newMessage = enrichFromMetadata(data.message);
        logRagInfo('RAG info  regular message', newMessage);
        return { ...prev, messages: [...(prev.messages || []), newMessage] };
      });
    } catch (error) {
      loggers.chat.error('Error processing message', error);
    }
  }, [setChatData, setTypingMessageIds]);
}
