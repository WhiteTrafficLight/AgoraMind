'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ChatUI from '@/components/chat/ChatUI';
import CircularChatUI from '@/components/chat/CircularChatUI';
import DebateChatUI from '@/components/chat/DebateChatUI';
import chatService, { ChatRoom, ChatMessage } from '@/lib/ai/chatService';

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 컴포넌트 초기화 시 한 번만 id 값을 추출하고 null 체크
  const chatIdParam = searchParams ? searchParams.get('id') : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatData, setChatData] = useState<ChatRoom | null>(null);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);

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

    // ID를 숫자로 변환 - 명시적으로 숫자 타입으로 변환
    const chatId = Number(chatIdParam);
    console.log('Using chat ID as number:', chatId, `(${typeof chatId})`);
    
    // ID 추가 검증 
    if (isNaN(chatId) || chatId <= 0) {
      console.error(`Invalid chat ID format: ${chatIdParam}`);
      setError('Invalid chat room ID format');
      setLoading(false);
      return;
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
        
        // ID 타입 및 일치 여부 확인
        console.log(`🔍 CHAT PAGE: Room returned with ID: ${room.id} (${typeof room.id})`);
        
        // 🔧 ID 타입이 숫자인지 확인하여 일관성 유지
        const roomIdNum = typeof room.id === 'string' ? parseInt(room.id) : room.id;
        
        if (roomIdNum !== chatId) {
          console.error(`ID mismatch: requested=${chatId}, received=${roomIdNum}`);
          setError('Incorrect chat room loaded');
          return;
        }
        
        // 🔧 ID를 명시적으로 숫자로 설정
        room.id = chatId;
        
        // 채팅방 메시지 상태 확인
        const messageCount = room.messages?.length || 0;
        console.log(`🔍 CHAT PAGE: Successfully loaded room #${room.id} (${room.title}) with ${messageCount} messages`);
        console.log(`🔍 CHAT PAGE: Dialog type: "${room.dialogueType || 'not set'}"`, room);
        
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
        
        // Ensure dialogueType is set (default to 'free' if not explicitly set in database)
        if (!room.dialogueType) {
          console.log('🔧 CHAT PAGE: Setting default dialogueType to "free"');
          room.dialogueType = 'free';
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

  // 메시지 전송 및 AI 응답 생성 함수
  const handleSendMessage = async (message: string) => {
    if (!chatData) return;
    
    try {
      // 사용자 메시지 전송
      await chatService.sendMessage(chatData.id, message);
      
      // AI 응답 생성 시작
      setIsGeneratingResponse(true);
      
      // 채팅룸 데이터 새로고침 (사용자 메시지 포함)
      const updatedRoom = await chatService.getChatRoomById(chatData.id);
      if (updatedRoom) {
        setChatData(JSON.parse(JSON.stringify(updatedRoom)));
      }
      
      // AI 응답 생성 요청 - ID를 string으로 변환하여 전달
      await chatService.getAIResponse(String(chatData.id));
      
      // 최종 채팅룸 데이터 새로고침 (AI 응답 포함)
      const finalRoom = await chatService.getChatRoomById(chatData.id);
      if (finalRoom) {
        setChatData(JSON.parse(JSON.stringify(finalRoom)));
      }
    } catch (error) {
      console.error('Failed to send message or get AI response:', error);
    } finally {
      setIsGeneratingResponse(false);
    }
  };

  // 채팅룸 새로고침 함수
  const handleRefreshChat = async () => {
    if (!chatData) return;
    
    setLoading(true);
    try {
      const refreshedRoom = await chatService.getChatRoomById(chatData.id);
      if (refreshedRoom) {
        setChatData(JSON.parse(JSON.stringify(refreshedRoom)));
      }
    } catch (error) {
      console.error('Failed to refresh chat:', error);
    } finally {
      setLoading(false);
    }
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
        chatData.dialogueType === 'free' || !chatData.dialogueType ? (
          <CircularChatUI
            chatId={Number(chatData.id)}
            chatTitle={chatData.title}
            participants={chatData.participants}
            initialMessages={chatData.messages || []}
            onBack={() => router.push('/open-chat')}
          />
        ) : chatData.dialogueType === 'debate' ? (
          <DebateChatUI
            room={{
              ...chatData,
              id: Number(chatData.id) // Ensure ID is a number
            }}
            messages={chatData.messages || []}
            npcDetails={chatData.npcDetails || []}
            onSendMessage={handleSendMessage}
            onRefresh={handleRefreshChat}
            isLoading={loading}
            isGeneratingResponse={isGeneratingResponse}
            username="You"
            onEndChat={() => router.push('/open-chat')}
          />
        ) : (
        <ChatUI 
          chatId={Number(chatData.id)}
          chatTitle={chatData.title}
          participants={chatData.participants}
          initialMessages={chatData.messages || []}
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