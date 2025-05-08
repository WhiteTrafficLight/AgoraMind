'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ChatUI from '@/components/chat/ChatUI';
import CircularChatUI from '@/components/chat/CircularChatUI';
import chatService, { ChatRoom } from '@/lib/ai/chatService';

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 컴포넌트 초기화 시 한 번만 id 값을 추출하고 null 체크
  const chatIdParam = searchParams ? searchParams.get('id') : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatData, setChatData] = useState<ChatRoom | null>(null);

  // 페이지 진입 시 body 스타일 변경
  useEffect(() => {
    // 헤더를 숨기기 위한 클래스 추가
    document.body.classList.add('chat-page-open');
    
    // 페이지 나갈 때 스타일 복원
    return () => {
      document.body.classList.remove('chat-page-open');
    };
  }, []);

  useEffect(() => {
    // 마운트 시 상태 초기화
    setLoading(true);
    setError(null);
    setChatData(null);
    
    if (!chatIdParam) {
      setError('No chat ID provided');
      setLoading(false);
      return;
    }

    console.log('Chat page received ID:', chatIdParam, typeof chatIdParam);

    // 숫자형 ID로 변환 시도
    let chatId: string | number = chatIdParam;
    if (!isNaN(Number(chatIdParam))) {
      chatId = Number(chatIdParam);
      console.log('Converted ID to number:', chatId);
    }

    const loadChatData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // URL의 chatId와 함께 실행되는 요청임을 명확히 로깅
        console.log(`🔍 CHAT PAGE: Fetching chat room with ID: ${chatId}, (type: ${typeof chatId})`);
        const room = await chatService.getChatRoomById(chatId);
        
        if (!room) {
          console.error('Room not found for ID:', chatId);
          setError('Chat room not found');
          return;
        }
        
        // ID 일치 여부 확인 - 중요!
        if (room.id && String(room.id) !== String(chatId)) {
          console.error(`ID mismatch: requested=${chatId}, received=${room.id}`);
          setError('Incorrect chat room loaded');
          return;
        }
        
        // 채팅방 메시지 상태 확인
        const messageCount = room.messages?.length || 0;
        console.log(`🔍 CHAT PAGE: Successfully loaded room #${room.id} (${room.title}) with ${messageCount} messages`);
        
        if (messageCount > 0 && room.messages) {
          // 메시지 내용 간략히 로깅
          console.log(`🔍 CHAT PAGE: First message: "${room.messages[0].text.substring(0, 30)}..."`);
          if (messageCount > 1) {
            console.log(`🔍 CHAT PAGE: Last message: "${room.messages[messageCount-1].text.substring(0, 30)}..."`);
          }
        }
        
        // Check if room has any users (excluding NPCs)
        if (room.participants.users.length === 0) {
          // No users left in the chat room, redirect to open chat page
          console.log('🔍 CHAT PAGE: No users in room, redirecting to open chat');
          router.push('/open-chat');
          return;
        }
        
        // 이전 상태와 완전히 다른 새 객체로 설정하여 상태 격리
        setChatData(JSON.parse(JSON.stringify(room)));
      } catch (error) {
        console.error('Failed to load chat:', error);
        setError('Failed to load chat data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadChatData();
  }, [chatIdParam, router]);

  const handleBackToOpenChat = () => {
    router.push('/open-chat');
  };

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen bg-white">
      {loading ? (
        <div className="flex h-full justify-center items-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 w-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      ) : error ? (
        <div className="flex h-full justify-center items-center flex-col">
          <p className="text-xl text-gray-500 mb-4">{error}</p>
          <button 
            onClick={handleBackToOpenChat}
            className="px-4 py-2 bg-black text-white rounded-md"
          >
            Back to Open Chat
          </button>
        </div>
      ) : chatData ? (
        chatData.dialogueType === 'free' ? (
          <CircularChatUI
            chatId={chatData.id}
            chatTitle={chatData.title}
            participants={chatData.participants}
            initialMessages={chatData.messages}
            onBack={() => router.push('/open-chat')}
          />
        ) : (
          <ChatUI 
            chatId={chatData.id}
            chatTitle={chatData.title}
            participants={chatData.participants}
            initialMessages={chatData.messages}
            onBack={() => router.push('/open-chat')}
          />
        )
      ) : (
        <div className="flex h-full justify-center items-center">
          <p className="text-xl text-gray-500">Chat not found</p>
        </div>
      )}
      
      {/* 스타일 추가 */}
      <style jsx global>{`
        /* 채팅 페이지에서 헤더 숨기기 */
        body.chat-page-open header {
          display: none !important;
        }
        
        /* 채팅 페이지가 열렸을 때 body 스크롤 방지 */
        body.chat-page-open {
          overflow: hidden;
        }
      `}</style>
    </div>
  );
} 