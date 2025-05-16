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

  // 사용자 역할 결정 헬퍼 함수
  const getUserRole = () => {
    if (!chatData) return 'neutral';
    
    console.log('⚡ 유저 역할 결정 - 분석 중', {
      roomData: chatData,
      proParticipants: chatData.pro || [],
      conParticipants: chatData.con || [],
      userInPro: chatData.pro?.some(id => id === 'User' || id === 'User123' || id === 'You'),
      userInCon: chatData.con?.some(id => id === 'User' || id === 'User123' || id === 'You')
    });
    
    // 명시적으로 pro 배열에 사용자가 있는지 확인
    if (chatData.pro?.some(id => id === 'User' || id === 'User123' || id === 'You')) {
      console.log('⚡ 유저는 PRO(찬성) 측입니다');
      return 'pro';
    }
    
    // 명시적으로 con 배열에 사용자가 있는지 확인
    if (chatData.con?.some(id => id === 'User' || id === 'User123' || id === 'You')) {
      console.log('⚡ 유저는 CON(반대) 측입니다');
      return 'con';
    }
    
    console.log('⚡ 유저 역할을 결정할 수 없습니다. neutral로 설정합니다.');
    return 'neutral';
  };

  // 메시지 전송 및 AI 응답 생성 함수
  const handleSendMessage = async (message: string) => {
    if (!chatData) return;
    
    try {
      // 디베이트 모드인지 확인
      const isDebateMode = chatData.dialogueType === 'debate';
      
      // 현재 사용자 역할 확인
      const currentUserRole = getUserRole();
      console.log(`💬 사용자 메시지 전송 시작 - 역할: ${currentUserRole}, 디베이트 모드: ${isDebateMode}`);
      
      // 사용자 메시지 객체 생성 - 모든 필수 필드 명시적으로 설정
      const userMessageObj = {
        id: `user-${Date.now()}`,
        text: message.trim(),
        sender: 'User',
        isUser: true,
        timestamp: new Date().toISOString(),
        role: currentUserRole
      };
      
      console.log(`📝 사용자 메시지 객체:`, userMessageObj);
      
      // 1. Next.js API를 통해 메시지 DB 저장 (중요: debate 모드여도 먼저 저장)
      try {
        console.log(`💾 Next.js API에 메시지 저장 시도...`);
        const saveResult = await chatService.sendMessage(chatData.id, message, userMessageObj);
        console.log(`✅ 메시지 저장 결과:`, saveResult);
      } catch (error) {
        console.error('❌ Next.js API 메시지 저장 실패:', error);
      }
      
      // 2. 디베이트 모드인 경우, Python API에게 메시지 처리 요청
      if (isDebateMode) {
        console.log('🔄 디베이트 API에 사용자 메시지 처리 요청...');
        
        // Python API URL 설정
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        
        try {
          // 메시지 처리 API 호출 - 사용자 역할 정보 포함
          console.log(`📤 Python API 요청: ${apiBaseUrl}/api/dialogue/${chatData.id}/process-message`, {
            message: message,
            user_id: 'User',
            role: currentUserRole
          });
          
          const processResponse = await fetch(`${apiBaseUrl}/api/dialogue/${chatData.id}/process-message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: message,
              user_id: 'User', // 일관된 사용자 ID 사용
              role: currentUserRole // 사용자 역할 정보 추가
            })
          });
          
          if (processResponse.ok) {
            const processResult = await processResponse.json();
            console.log('✅ Debate API 처리 결과:', processResult);
            
            // 사용자 메시지 처리 후, 자동으로 다음 발언자 요청 (짧은 지연 후)
            setTimeout(() => {
              handleRequestNextMessage();
            }, 1000);
          } else {
            console.error('❌ Debate API 처리 오류:', processResponse.status);
            const errorText = await processResponse.text();
            console.error('오류 내용:', errorText);
            
            // 오류가 발생해도 다음 발언자 요청을 시도
            setTimeout(() => {
              handleRequestNextMessage();
            }, 1000);
          }
        } catch (error) {
          console.error('❌ Debate API 호출 오류:', error);
        }
      }
      
      // 항상 UI 상태 업데이트
      setIsGeneratingResponse(true);
      
      // 채팅 목록 새로고침
      const updatedRoom = await chatService.getChatRoomById(chatData.id);
      if (updatedRoom) {
        setChatData(updatedRoom);
      }
    } catch (error) {
      console.error('❌ 메시지 처리 중 예외 발생:', error);
    } finally {
      // 처리 완료 상태로 변경
      setTimeout(() => {
      setIsGeneratingResponse(false);
      }, 500);
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

  // Debate 모드에서 다음 메시지 요청 함수
  const handleRequestNextMessage = async () => {
    if (!chatData || chatData.dialogueType !== 'debate') return;
    
    try {
      // 응답 생성 중 상태 표시
      setIsGeneratingResponse(true);
      
      console.log('🔄 Requesting next debate message for room:', chatData.id);
      
      // Socket.io 클라이언트를 통한 요청
      const socketModule = await import('@/lib/socket/socketClient');
      const socketClient = await socketModule.default.init();
      
      // Socket 연결 확인
      if (!socketClient.isConnected()) {
        console.warn('Socket not connected, attempting to initialize...');
        await socketClient.init();
        
        if (!socketClient.isConnected()) {
          throw new Error('Failed to establish socket connection');
        }
      }
      
      // 1. 방 입장 확인
      const roomIdNum = typeof chatData.id === 'string' ? parseInt(chatData.id) : chatData.id;
      socketClient.joinRoom(roomIdNum);
      
      // 이벤트 리스너 설정 - 다음 발언자 업데이트 수신
      socketClient.on('next-speaker-update', (data: { roomId: string, nextSpeaker: any }) => {
        console.log('Next speaker update from socket:', data);
        if (data.roomId === String(roomIdNum) && data.nextSpeaker) {
          // 전역 이벤트로 발행하여 DebateChatUI에서 감지하도록 함
          window.dispatchEvent(new CustomEvent('next-speaker-updated', { 
            detail: data.nextSpeaker 
          }));
          
          // 사용자 차례인 경우 자동 응답 생성하지 않음
          if (data.nextSpeaker.is_user) {
            console.log('👤 User is the next speaker - waiting for input');
            setIsGeneratingResponse(false);
            return;
          }
        }
      });
      
      // 새로운 메시지를 위한 이벤트 리스너 추가
      socketClient.on('new-message', (data: { roomId: string, message: ChatMessage }) => {
        console.log('New message received from socket:', data);
        if (data.roomId === String(roomIdNum) && data.message) {
          console.log('Adding new message to chatData state:', data.message);
          if (chatData) {
            // 기존 메시지 배열에 새 메시지 추가
            const updatedMessages = [...(chatData.messages || []), data.message];
            // 채팅방 데이터 업데이트
            setChatData(prevData => {
              if (!prevData) return null;
              return {
                ...prevData,
                messages: updatedMessages
              };
            });
          }
        }
      });
      
      // Python API URL 설정
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      // 2. 디베이트 다음 메시지 요청 (백엔드 API 직접 호출)
      const response = await fetch(`${apiBaseUrl}/api/dialogue/${roomIdNum}/next-speaker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to request next debate message: ${response.status}`);
      }
      
      const nextSpeakerData = await response.json();
      console.log('Next speaker data:', nextSpeakerData);
      
      // 응답할 NPC ID 확인 - speaker_id 속성 사용 (API 반환 값과 일치)
      const speakerId = nextSpeakerData.speaker_id;
      if (!speakerId) {
        throw new Error('No next speaker returned from API');
      }
      
      console.log(`Next speaker determined: ${speakerId} (${nextSpeakerData.role || 'unknown role'})`);
      console.log(`Is user turn: ${nextSpeakerData.is_user}`);
      
      // 다음 발언자 정보를 localStorage에 저장 (UI에서 사용자 차례를 감지하는 데 활용)
      window.localStorage.setItem('lastNextSpeakerData', JSON.stringify(nextSpeakerData));
      
      // 사용자에게 차례 알림을 위한 전역 이벤트 발행
      window.dispatchEvent(new CustomEvent('next-speaker-updated', { 
        detail: nextSpeakerData 
      }));
      
      // NPC 선택 이벤트 발송
      socketClient.emit('npc-selected', {
        roomId: roomIdNum,
        npcId: speakerId
      });
      
      // 사용자 ID 확인 (API 응답의 is_user 플래그 사용)
      const isUserNextSpeaker = nextSpeakerData.is_user === true;
      
      // 사용자가 다음 발언자이면 AI 응답 생성 건너뛰기
      if (isUserNextSpeaker) {
        console.log('👤 User is the next speaker, waiting for user input...');
        // 사용자 차례이므로 상태 업데이트만 하고 함수 종료
        setIsGeneratingResponse(false);
        return;
      }
      
      // 3. 다음 발언자 메시지 생성 요청 (사용자가 아닌 경우에만)
      const generateResponse = await fetch(`${apiBaseUrl}/api/dialogue/${roomIdNum}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          npc_id: speakerId
        })
      });
      
      if (!generateResponse.ok) {
        throw new Error(`Failed to generate next debate message: ${generateResponse.status}`);
      }
      
      const messageData = await generateResponse.json();
      console.log('Generated message:', messageData);
      
      // 4. 생성된 메시지를 DB에 저장
      if (messageData && messageData.response_text) {
        // NextJS API에 메시지 저장 요청
        const saveMessageUrl = `/api/messages`;
        const messageToSave = {
          id: `ai-${Date.now()}`,
          text: messageData.response_text,
          sender: speakerId,
          isUser: false,
          timestamp: new Date().toISOString(),
          role: nextSpeakerData.role  // 역할 정보 추가
        };
        
        console.log('Saving message to database:', messageToSave);
        
        // API 요청 형식에 맞게 roomId와 message를 별도로 구성
        const saveResponse = await fetch(saveMessageUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            roomId: roomIdNum,
            message: messageToSave
          })
        });
        
        if (!saveResponse.ok) {
          console.error('Failed to save message to database:', await saveResponse.text());
        } else {
          console.log('Message saved to database successfully');
          
          // UI에 직접 메시지 추가 (Socket 업데이트를 기다리지 않고 즉시 반영)
          if (chatData) {
            setChatData(prevData => {
              if (!prevData) return null;
              // 이미 동일한 ID의 메시지가 있는지 확인
              const messageExists = prevData.messages?.some(msg => msg.id === messageToSave.id);
              if (messageExists) {
                return prevData; // 이미 존재하면 상태 변경 없음
              }
              
              // ChatMessage 타입에 맞게 변환
              const newMessage: ChatMessage = {
                id: messageToSave.id,
                text: messageToSave.text,
                sender: messageToSave.sender,
                isUser: messageToSave.isUser,
                timestamp: new Date(messageToSave.timestamp), // string을 Date 객체로 변환
                role: messageToSave.role
              };
              
              // 새 메시지 추가
              return {
                ...prevData,
                messages: [...(prevData.messages || []), newMessage]
              };
            });
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to request next debate message:', error);
    } finally {
      setIsGeneratingResponse(false);
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
            userRole={
              // 사용자 역할 확인 (pro, con, neutral)
              chatData.pro?.includes('You') || chatData.pro?.includes('User123') ? 'pro' :
              chatData.con?.includes('You') || chatData.con?.includes('User123') ? 'con' :
              'neutral'
            }
            onRequestNextMessage={handleRequestNextMessage}
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