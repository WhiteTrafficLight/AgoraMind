'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DebateChatContainer from '@/components/chat/v2/DebateChatContainer';
import chatService, { ChatRoom, ChatMessage } from '@/lib/ai/chatService';

export default function ChatPageV2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatIdParam = searchParams ? searchParams.get('id') : null;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatData, setChatData] = useState<ChatRoom | null>(null);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  const [socketClient, setSocketClient] = useState<any>(null);
  const [username, setUsername] = useState<string>('');

  // 사용자 정보 로드
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
          const userData = await response.json();
          const userDisplayName = userData.username || userData.name || `User_${Math.floor(Math.random() * 10000)}`;
          setUsername(userDisplayName);
          sessionStorage.setItem('chat_username', userDisplayName);
          console.log('✅ V2: 사용자 정보 로드됨:', userDisplayName);
        } else {
          const storedUsername = sessionStorage.getItem('chat_username') || `User_${Math.floor(Math.random() * 10000)}`;
          setUsername(storedUsername);
          sessionStorage.setItem('chat_username', storedUsername);
        }
      } catch (error) {
        console.error('V2: 사용자 정보 로드 실패:', error);
        const fallbackUsername = `User_${Math.floor(Math.random() * 10000)}`;
        setUsername(fallbackUsername);
        sessionStorage.setItem('chat_username', fallbackUsername);
      }
    };
    
    loadUserInfo();
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setChatData(null);
    
    if (!chatIdParam) {
      setError('No chat ID provided');
      setLoading(false);
      return;
    }

    const chatId = Number(chatIdParam);
    
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
        
        console.log(`🔍 CHAT PAGE V2: Fetching chat room with ID: ${chatId}`);
        const room = await chatService.getChatRoomById(chatId);
        
        if (!room) {
          console.error('Room not found for ID:', chatId);
          setError('Chat room not found');
          return;
        }
        
        console.log(`🔍 CHAT PAGE V2: Successfully loaded room #${room.id} (${room.title})`);
        
        // Ensure dialogueType is set
        if (!room.dialogueType) {
          room.dialogueType = 'free';
        }
        
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

  // Socket.IO 연결 및 실시간 메시지 수신 설정
  useEffect(() => {
    let socketInstance: any = null;

    const initializeSocket = async () => {
      if (!chatData?.id || !username) return;

      try {
        // socketClient 인스턴스 임포트 
        const socketClient = (await import('@/lib/socket/socketClient')).default;
        socketInstance = socketClient;
        await socketInstance.init(username);
        
        // 방에 참가 (username 전달)
        const roomIdNum = typeof chatData.id === 'string' ? parseInt(chatData.id) : chatData.id;
        socketInstance.joinRoom(roomIdNum, username);
        
        // new-message 이벤트 리스너 설정
        socketInstance.on('new-message', (data: { roomId: string, message: ChatMessage }) => {
          console.log('🎯 [V2] 소켓 이벤트 수신: new-message');
          console.log('🎯 [V2] 수신 데이터:', JSON.stringify(data).substring(0, 300));
          console.log('🎯 [V2] 현재 방 ID:', String(chatData.id));
          console.log('🎯 [V2] 수신된 방 ID:', String(data.roomId));
          
          // 현재 방의 메시지인지 확인
          const currentRoomId = String(chatData.id);
          const receivedRoomId = String(data.roomId);
          
          if (currentRoomId === receivedRoomId && data.message) {
            console.log('✅ [V2] 방 ID 일치! 메시지 UI에 추가');
            console.log('✅ [V2] 메시지 내용:', data.message.text?.substring(0, 100));
            
            setChatData(prev => {
              if (!prev) return prev;
              
              console.log('🔄 [V2] setChatData 호출 - 새 메시지 추가');
              console.log('🔄 [V2] 기존 메시지 수:', prev.messages?.length || 0);
              console.log('🔄 [V2] 추가할 메시지 ID:', data.message.id);
              
              const newChatData = {
                ...prev,
                messages: [...(prev.messages || []), data.message]
              };
              
              console.log('🔄 [V2] 업데이트 후 메시지 수:', newChatData.messages?.length || 0);
              return newChatData;
            });
          } else {
            console.log('❌ [V2] 방 ID 불일치 또는 메시지 없음');
            console.log('❌ [V2] 현재 방:', currentRoomId, '수신 방:', receivedRoomId, '메시지 존재:', !!data.message);
          }
        });
        
        // 추가 디버그 이벤트들
        socketInstance.on('connect', () => {
          console.log('🔗 [V2] Socket 연결됨:', socketInstance.getSocket()?.id);
        });
        
        socketInstance.on('disconnect', () => {
          console.log('❌ [V2] Socket 연결 해제됨');
        });
        
        // 모든 이벤트 캐치
        socketInstance.getSocket()?.onAny((eventName: string, ...args: any[]) => {
          console.log(`🎧 [V2] 받은 이벤트: ${eventName}`, args);
        });
        
        setSocketClient(socketInstance);
        console.log('V2: Socket.IO 연결 완료');
        
      } catch (error) {
        console.error('V2: Socket.IO 연결 실패:', error);
      }
    };

    if (chatData?.id) {
      initializeSocket();
    }

    return () => {
      if (socketInstance) {
        if (chatData?.id && username) {
          const roomIdNum = typeof chatData.id === 'string' ? parseInt(chatData.id) : chatData.id;
          socketInstance.leaveRoom(roomIdNum, username);
        }
        socketInstance.disconnect();
      }
    };
  }, [chatData?.id, username]);

  const handleBackToOpenChat = () => {
    router.push('/open-chat');
  };

  const handleSendMessage = async (message: string) => {
    if (!chatData) return;
    
    try {
      console.log(`💬 V2: User message sent: ${message}`);
      
      // 간단한 메시지 전송 (기존 로직 단순화)
      const result = await chatService.sendMessage(chatData.id, message, {
        id: `user-${Date.now()}`,
        text: message.trim(),
        sender: username || 'User',
        isUser: true,
        timestamp: new Date().toISOString(),
        role: 'user'
      });
      
      console.log(`✅ V2: Message sent successfully:`, result);
      
      // 채팅 데이터 새로고침
      const updatedRoom = await chatService.getChatRoomById(chatData.id);
      if (updatedRoom) {
        setChatData(updatedRoom);
      }
    } catch (error) {
      console.error('❌ V2: Message sending failed:', error);
    }
  };

  const handleRefreshChat = async () => {
    if (!chatData) return;
    
    console.log('🔄 [V2] handleRefreshChat 호출됨');
    console.log('🔄 [V2] 새로고침 전 메시지 수:', chatData.messages?.length || 0);
    
    setLoading(true);
    try {
      const refreshedRoom = await chatService.getChatRoomById(chatData.id);
      if (refreshedRoom) {
        console.log('🔄 [V2] 서버에서 가져온 메시지 수:', refreshedRoom.messages?.length || 0);
        setChatData(JSON.parse(JSON.stringify(refreshedRoom)));
        console.log('🔄 [V2] 새로고침 완료 - 데이터 교체됨');
      }
    } catch (error) {
      console.error('Failed to refresh chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNextMessage = async () => {
    if (!chatData) return;
    
    try {
      setIsGeneratingResponse(true);
      console.log('🔄 V2: Requesting next debate message for room:', chatData.id);
      
      // 간단한 다음 메시지 요청 (기존 로직 단순화)
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const roomIdNum = typeof chatData.id === 'string' ? parseInt(chatData.id) : chatData.id;
      
      const response = await fetch(`${apiBaseUrl}/api/chat/debate/${roomIdNum}/next-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Next 메시지 요청 실패');
      }
      
      const data = await response.json();
      console.log('✅ V2: Next 메시지 요청 성공:', data);
      
      // 데이터 새로고침 - 임시로 비활성화하여 테스트
      console.log('⏸️ [V2] 자동 새로고침 비활성화됨 - Socket 메시지만 사용');
      /*
      setTimeout(() => {
        handleRefreshChat();
      }, 1000);
      */
      
    } catch (error) {
      console.error('❌ V2: Next 메시지 요청 중 오류:', error);
    } finally {
      setIsGeneratingResponse(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 w-screen h-screen bg-white flex justify-center items-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
          <div className="text-sm text-blue-600 mt-4">V2 Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 w-screen h-screen bg-white flex justify-center items-center flex-col">
        <p className="text-xl text-gray-500 mb-4">{error}</p>
        <div className="text-sm text-red-600 mb-4">V2 Error Page</div>
        <button 
          onClick={handleBackToOpenChat}
          className="px-4 py-2 bg-black text-white rounded-md"
        >
          Back to Open Chat
        </button>
      </div>
    );
  }

  if (!chatData) {
    return (
      <div className="fixed inset-0 z-50 w-screen h-screen bg-white flex justify-center items-center">
        <p className="text-xl text-gray-500">Chat not found (V2)</p>
      </div>
    );
  }

  // V2 구조에서는 debate 타입만 지원 (점진적 확장 예정)
  if (chatData.dialogueType !== 'debate') {
    return (
      <div className="fixed inset-0 z-50 w-screen h-screen bg-white flex justify-center items-center flex-col">
        <p className="text-xl text-gray-500 mb-4">
          V2 구조는 현재 토론(debate) 채팅만 지원합니다.
        </p>
        <div className="text-sm text-blue-600 mb-4">
          현재 채팅 타입: {chatData.dialogueType}
        </div>
        <button 
          onClick={() => router.push(`/chat?id=${chatData.id}`)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md mr-2"
        >
          기존 버전으로 보기
        </button>
        <button 
          onClick={handleBackToOpenChat}
          className="px-4 py-2 bg-gray-600 text-white rounded-md"
        >
          Back to Open Chat
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen bg-white">
      {/* 메인 채팅 컨테이너 */}
      <div className="h-full">
        <DebateChatContainer
          room={{
            ...chatData,
            id: typeof chatData.id === 'string' ? parseInt(chatData.id) : chatData.id,
            dialogueType: chatData.dialogueType || 'debate'
          }}
          messages={chatData.messages || []}
          npcDetails={chatData.npcDetails || []}
          onSendMessage={handleSendMessage}
          onRefresh={handleRefreshChat}
          isLoading={loading}
          isGeneratingResponse={isGeneratingResponse}
          username={username || 'You'}
          onEndChat={() => router.push('/open-chat')}
          userRole={
            chatData.pro?.includes(username) || chatData.pro?.includes('You') ? 'pro' :
            chatData.con?.includes(username) || chatData.con?.includes('You') ? 'con' :
            'neutral'
          }
          onRequestNextMessage={handleRequestNextMessage}
        />
      </div>
      
      {/* 글로벌 스타일 */}
      <style jsx global>{`
        body.chat-page-open header {
          display: none !important;
        }
        body.chat-page-open {
          overflow: hidden;
        }
      `}</style>
    </div>
  );
} 