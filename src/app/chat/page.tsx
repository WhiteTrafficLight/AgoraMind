'use client';
import React, { ReactNode, useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DebateChatContainer from '@/components/debate/DebateChatContainer';
import EnhancedCircularChatUI from '@/components/chat/EnhancedCircularChatUI';
import { chatService, ChatRoom } from '@/lib/ai/chatService';
import { useSocket } from '@/hooks/useSocket';
import { useChatRoom } from '@/hooks/useChatRoom';
import { useChatUsername } from '@/hooks/useChatUsername';
import { useChatMessageReceiver } from '@/hooks/useChatMessageReceiver';
import { useDebateChat } from '@/hooks/useDebateChat';
import { loggers } from '@/utils/logger';
import { ROUTES } from '@/lib/routes';

const FullScreenState = ({ children }: { children: ReactNode }) => (
  <div className="fixed inset-0 z-50 w-screen h-screen bg-white flex justify-center items-center flex-col">
    {children}
  </div>
);

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatIdParam = searchParams ? searchParams.get('id') : null;

  const username = useChatUsername();
  const { chatData, setChatData, loading, error, refresh: refreshChat } = useChatRoom(chatIdParam);

  const [typingMessageIds, setTypingMessageIds] = useState<Set<string>>(new Set());

  const {
    isGeneratingResponse,
    waitingForUserInput,
    currentUserTurn,
    requestNextMessage,
    processUserMessage,
  } = useDebateChat({ chatData, setChatData, username });

  const onMessage = useChatMessageReceiver({
    chatData,
    setChatData,
    setTypingMessageIds,
  });

  const { isConnected, joinRoom } = useSocket({
    roomId: chatData?.id ? String(chatData.id) : undefined,
    userId: username,
    onConnect: () => loggers.socket.info('V2 socket connected to backend'),
    onDisconnect: () => loggers.socket.info('V2 socket disconnected from backend'),
    onMessage,
  });

  const handleTypingComplete = (messageId: string) => {
    setTypingMessageIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      return newSet;
    });
  };

  useEffect(() => {
    if (isConnected && chatData?.id && username && joinRoom) {
      const roomId = String(chatData.id);
      loggers.chat.info(`V2 room ${roomId}joined, user: ${username}`);
      joinRoom(roomId, username);
    }
  }, [isConnected, chatData?.id, username, joinRoom]);

  const handleBackToOpenChat = () => {
    router.push(ROUTES.openChat);
  };

  const handleSendMessage = async (message: string) => {
    if (!chatData) return;
    
    try {
      loggers.chat.info(`V2: User message sent: ${message}`);
      
      const result = await chatService.sendMessage(chatData.id, message, {
        id: `user-${Date.now()}`,
        text: message.trim(),
        sender: username || 'User',
        isUser: true,
        timestamp: new Date(),
        role: 'user'
      });
      
      loggers.chat.info('Message sent successfully:', result);
      
      const updatedRoom = await chatService.getChatRoomById(chatData.id);
      if (updatedRoom) {
        setChatData(updatedRoom);
      }
    } catch (error) {
      loggers.chat.error('Message sending failed:', error);
    }
  };

  if (loading) {
    return (
      <FullScreenState>
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
          <div className="text-sm text-blue-600 mt-4">V2 Loading...</div>
        </div>
      </FullScreenState>
    );
  }

  if (error) {
    return (
      <FullScreenState>
        <p className="text-xl text-gray-500 mb-4">{error}</p>
        <div className="text-sm text-red-600 mb-4">V2 Error Page</div>
        <button
          onClick={handleBackToOpenChat}
          className="px-4 py-2 bg-black text-white rounded-md"
        >
          Back to Open Chat
        </button>
      </FullScreenState>
    );
  }

  if (!chatData) {
    return (
      <FullScreenState>
        <p className="text-xl text-gray-500">Chat not found (V2)</p>
      </FullScreenState>
    );
  }

  if (chatData.dialogueType !== 'debate' && chatData.dialogueType !== 'free') {
    return (
      <FullScreenState>
        <p className="text-xl text-gray-500 mb-4">
          V2 structure currently supports only debate and free chat types.
        </p>
        <div className="text-sm text-blue-600 mb-4">
          Current chat type: {chatData.dialogueType}
        </div>
        <button
          onClick={() => router.push(ROUTES.chat(String(chatData.id)))}
          className="px-4 py-2 bg-blue-600 text-white rounded-md mr-2"
        >
          View in legacy mode
        </button>
        <button
          onClick={handleBackToOpenChat}
          className="px-4 py-2 bg-gray-600 text-white rounded-md"
        >
          Back to Open Chat
        </button>
      </FullScreenState>
    );
  }

  const userRole: 'pro' | 'con' | 'neutral' =
    chatData.pro?.includes(username) || chatData.pro?.includes('You')
      ? 'pro'
      : chatData.con?.includes(username) || chatData.con?.includes('You')
      ? 'con'
      : 'neutral';

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen bg-white">
      {/* Main chat container — loads different UI based on dialogueType */}
      <div className="h-full">
        {chatData.dialogueType === 'free' ? (
          <EnhancedCircularChatUI
            chatId={chatData.id}
            chatTitle={chatData.title}
            participants={chatData.participants}
            initialMessages={chatData.messages || []}
            onBack={handleBackToOpenChat}
            dialogueType="free"
            context={chatData.context}
            freeDiscussionConfig={chatData.freeDiscussionConfig}
            freeDiscussionSessionId={chatData.freeDiscussionSessionId}
          />
        ) : (
          <DebateChatContainer
            room={{
              ...chatData,
              id: String(chatData.id),
              dialogueType: chatData.dialogueType || 'debate'
            }}
            messages={chatData.messages || []}
            npcDetails={chatData.npcDetails || []}
            onSendMessage={handleSendMessage}
            onRefresh={refreshChat}
            isLoading={loading}
            isGeneratingResponse={isGeneratingResponse}
            username={username || 'You'}
            onEndChat={() => router.push(ROUTES.openChat)}
            userRole={userRole}
            onRequestNextMessage={requestNextMessage}
            typingMessageIds={typingMessageIds}
            onTypingComplete={handleTypingComplete}
            waitingForUserInput={waitingForUserInput}
            currentUserTurn={currentUserTurn}
            onProcessUserMessage={processUserMessage}
          />
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatContent />
    </Suspense>
  );
} 