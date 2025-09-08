'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DebateChatContainer from '@/components/chat/main_components/DebateChatContainer';
import CircularChatUI from '@/components/chat/CircularChatUI';
import EnhancedCircularChatUI from '@/components/chat/EnhancedCircularChatUI';
import { chatService, ChatRoom, ChatMessage } from '@/lib/ai/chatService';
import { useSocket } from '@/hooks/useSocket';
import { loggers } from '@/utils/logger';

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatIdParam = searchParams ? searchParams.get('id') : null;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatData, setChatData] = useState<ChatRoom | null>(null);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [typingMessageIds, setTypingMessageIds] = useState<Set<string>>(new Set());
  const [waitingForUserInput, setWaitingForUserInput] = useState(false);
  const [currentUserTurn, setCurrentUserTurn] = useState<{speaker_id: string, role: string} | null>(null);

  // Socket.IO client connection
  const { socket, isConnected, joinRoom, leaveRoom } = useSocket({
    roomId: chatData?.id ? String(chatData.id) : undefined,
    userId: username,
    onConnect: () => {
      loggers.socket.info('V2 소켓이 백엔드 서버에 연결됨');
    },
    onDisconnect: () => {
      loggers.socket.info('V2 소켓이 백엔드 서버에서 연결 해제됨');
    },
    onMessage: async (data: { roomId: string, message: ChatMessage }) => {
      loggers.chat.debug('소켓 이벤트 수신: new-message');
      loggers.chat.debug('수신 데이터', { 
        roomId: data.roomId, 
        messagePreview: JSON.stringify(data).substring(0, 300) 
      });
      loggers.chat.debug('방 ID 비교', { 
        currentRoomId: String(chatData?.id), 
        receivedRoomId: String(data.roomId) 
      });
      
      // 현재 방의 메시지인지 확인
      const currentRoomId = String(chatData?.id);
      const receivedRoomId = String(data.roomId);
      
      if (currentRoomId === receivedRoomId && data.message) {
        loggers.chat.info('방 ID 일치! 메시지를 DB에 저장 후 UI에 업데이트');
        loggers.chat.debug('메시지 내용', { 
          preview: data.message.text?.substring(0, 100),
          eventType: data.message.metadata?.event_type 
        });
        
        // 완성된 메시지인지 확인
        const isCompleteMessage = data.message.metadata?.event_type === 'debate_message_complete';
        const isUserMessage = data.message.isUser === true;
        
        try {
          // 1. DB에 메시지 저장 (완성된 AI 메시지 또는 사용자 메시지)
          if (isCompleteMessage || isUserMessage) {
            loggers.db.info('메시지 DB 저장 시작', { 
              messageType: isUserMessage ? '사용자 메시지' : 'AI 메시지' 
            });
            const saveResponse = await fetch('/api/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                roomId: currentRoomId,
                message: {
                  ...data.message,
                  timestamp: data.message.timestamp || new Date().toISOString()
                }
              }),
            });
            
            if (saveResponse.ok) {
              loggers.db.info('DB 저장 성공');
            } else {
              const errorData = await saveResponse.json();
              loggers.db.error('DB 저장 실패', errorData);
            }
          }
          
          // 2. UI 업데이트
          setChatData(prev => {
            if (!prev) return prev;
            
            // 완성된 메시지인 경우 임시 생성 중 메시지를 교체
            if (isCompleteMessage) {
              loggers.chat.debug('임시 메시지를 완성된 메시지로 교체');
              
              // 같은 발언자의 생성 중인 임시 메시지 찾기
              const messagesCopy = [...(prev.messages || [])];
              const tempMessageIndex = messagesCopy.findIndex(msg => 
                msg.isGenerating && msg.sender === data.message.sender
              );
              
              if (tempMessageIndex >= 0) {
                // 임시 메시지를 완성된 메시지로 교체
                const completeMessage = {
                  ...data.message,
                  skipAnimation: false,  // 완성된 메시지는 타이핑 애니메이션 적용
                  // metadata에서 RAG 정보 추출
                  rag_used: data.message.metadata?.rag_used || false,
                  rag_source_count: data.message.metadata?.rag_source_count || 0,
                  rag_sources: data.message.metadata?.rag_sources || [],
                  citations: data.message.metadata?.citations || []
                };
                messagesCopy[tempMessageIndex] = completeMessage;
                loggers.chat.info('임시 메시지 교체 완료');
                loggers.rag.debug('RAG 정보', {
                  rag_used: completeMessage.rag_used,
                  rag_source_count: completeMessage.rag_source_count,
                  rag_sources_length: completeMessage.rag_sources?.length || 0
                });
                
                // 타이핑 애니메이션 시작을 위해 typingMessageIds에 추가
                setTimeout(() => {
                  setTypingMessageIds(prev => new Set([...prev, completeMessage.id]));
                }, 100);
              } else {
                // 임시 메시지가 없으면 새로 추가
                loggers.chat.warn('임시 메시지를 찾을 수 없어 새로 추가');
                const newMessage = {
                  ...data.message,
                  skipAnimation: false,
                  // metadata에서 RAG 정보 추출
                  rag_used: data.message.metadata?.rag_used || false,
                  rag_source_count: data.message.metadata?.rag_source_count || 0,
                  rag_sources: data.message.metadata?.rag_sources || [],
                  citations: data.message.metadata?.citations || []
                };
                
                loggers.rag.debug('일반 메시지 RAG 정보', {
                  rag_used: newMessage.rag_used,
                  rag_source_count: newMessage.rag_source_count,
                  rag_sources_length: newMessage.rag_sources?.length || 0
                });
                
                messagesCopy.push(newMessage);
              }
              
              return {
                ...prev,
                messages: messagesCopy
              };
            } else {
              // 일반 메시지인 경우 기존 로직 사용
              loggers.chat.debug('일반 메시지 추가');
              const newMessage = {
                ...data.message,
                skipAnimation: false,
                // metadata에서 RAG 정보 추출
                rag_used: data.message.metadata?.rag_used || false,
                rag_source_count: data.message.metadata?.rag_source_count || 0,
                rag_sources: data.message.metadata?.rag_sources || [],
                citations: data.message.metadata?.citations || []
              };
              
              loggers.rag.debug('일반 메시지 RAG 정보', {
                rag_used: newMessage.rag_used,
                rag_source_count: newMessage.rag_source_count,
                rag_sources_length: newMessage.rag_sources?.length || 0
              });
              
              return {
                ...prev,
                messages: [...(prev.messages || []), newMessage]
              };
            }
          });
          
        } catch (error) {
          loggers.chat.error('메시지 처리 중 오류', error);
        }
        
      } else {
        loggers.chat.warn('방 ID 불일치 또는 메시지 없음', {
          currentRoom: currentRoomId,
          receivedRoom: receivedRoomId,
          hasMessage: !!data.message
        });
      }
    }
  });

  // 타이핑 완료 핸들러
  const handleTypingComplete = (messageId: string) => {
    setTypingMessageIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      return newSet;
    });
  };

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
          loggers.auth.info('V2 사용자 정보 로드됨', { username: userDisplayName });
        } else {
          const storedUsername = sessionStorage.getItem('chat_username') || `User_${Math.floor(Math.random() * 10000)}`;
          setUsername(storedUsername);
          sessionStorage.setItem('chat_username', storedUsername);
        }
      } catch (error) {
        loggers.auth.error('V2 사용자 정보 로드 실패', error);
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

    const chatId = chatIdParam;
    
    if (!chatId || chatId.trim() === '') {
      loggers.chat.error(`Invalid chat ID format: ${chatIdParam}`);
      setError('Invalid chat room ID format');
      setLoading(false);
      return;
    }

    const loadChatData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        loggers.chat.info(`CHAT PAGE V2: Fetching chat room with ID: ${chatId}`);
        const room = await chatService.getChatRoomById(chatId);
        
        if (!room) {
          loggers.chat.error('Room not found for ID:', chatId);
          setError('Chat room not found');
          return;
        }
        
        loggers.chat.info(`CHAT PAGE V2: Successfully loaded room #${room.id} (${room.title})`);
        
        // Ensure dialogueType is set
        if (!room.dialogueType) {
          room.dialogueType = 'free';
        }
        
        setChatData(JSON.parse(JSON.stringify(room)));
      } catch (error) {
        loggers.chat.error('Failed to load chat:', error);
        setError('Failed to load chat data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadChatData();
  }, [chatIdParam, router]);

  // 소켓이 연결되고 채팅 데이터와 사용자명이 준비되면 방에 참여
  useEffect(() => {
    if (isConnected && chatData?.id && username && joinRoom) {
      const roomId = String(chatData.id);
      loggers.chat.info(`V2 방 ${roomId}에 참여, 사용자: ${username}`);
      joinRoom(roomId, username);
    }
  }, [isConnected, chatData?.id, username, joinRoom]);

  const handleBackToOpenChat = () => {
    router.push('/open-chat');
  };

  const handleSendMessage = async (message: string) => {
    if (!chatData) return;
    
    try {
      loggers.chat.info(`V2: User message sent: ${message}`);
      
      // 간단한 메시지 전송 (기존 로직 단순화)
      const result = await chatService.sendMessage(chatData.id, message, {
        id: `user-${Date.now()}`,
        text: message.trim(),
        sender: username || 'User',
        isUser: true,
        timestamp: new Date().toISOString(),
        role: 'user'
      });
      
      loggers.chat.info('Message sent successfully:', result);
      
      // 채팅 데이터 새로고침
      const updatedRoom = await chatService.getChatRoomById(chatData.id);
      if (updatedRoom) {
        setChatData(updatedRoom);
      }
    } catch (error) {
      loggers.chat.error('Message sending failed:', error);
    }
  };

  const handleRefreshChat = async () => {
    if (!chatData) return;
    
    loggers.chat.debug('handleRefreshChat 호출됨');
    loggers.chat.debug('새로고침 전 메시지 수:', chatData.messages?.length || 0);
    
    setLoading(true);
    try {
      const refreshedRoom = await chatService.getChatRoomById(chatData.id);
      if (refreshedRoom) {
        loggers.chat.debug('서버에서 가져온 메시지 수:', refreshedRoom.messages?.length || 0);
        setChatData(JSON.parse(JSON.stringify(refreshedRoom)));
        loggers.chat.info('새로고침 완료 - 데이터 교체됨');
      }
    } catch (error) {
      loggers.chat.error('Failed to refresh chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNextMessage = async () => {
    if (!chatData) return;
    
    try {
      setIsGeneratingResponse(true);
      loggers.chat.info('Requesting next debate message for room:', chatData.id);
      
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const roomId = String(chatData.id);
      
      const response = await fetch(`${apiBaseUrl}/api/chat/debate/${roomId}/next-message`, {
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
      loggers.chat.info('Next speaker info received:', data);
      
      if (data.status === 'success') {
        // 백엔드에서 next_speaker 정보가 있는 경우
        if (data.next_speaker) {
          const { speaker_id, role, is_user } = data.next_speaker;
          
          loggers.chat.info('Next speaker details:', { speaker_id, role, is_user });
          loggers.chat.info('Current username:', username);
          
          if (is_user === true) {
            loggers.chat.info('USER TURN CONFIRMED - activating input');
            loggers.chat.info('Speaker ID:', speaker_id, 'Role:', role);
            
            // 사용자 차례 상태 설정 (테스트 파일과 동일한 로직)
            setCurrentUserTurn({ speaker_id, role });
            setWaitingForUserInput(true);
            setIsGeneratingResponse(false);
            
            // 사용자에게 명확한 알림 (테스트 파일과 유사한 메시지)
            const roleText = role === 'pro' ? 'Pro' : role === 'con' ? 'Con' : role;
            const message = `It's your turn to speak as the ${roleText} side. Please enter your opinion.`;
            
            loggers.chat.info('Showing user turn alert:', message);
            alert(message);
            
            // 입력창 포커스를 위한 약간의 지연
            setTimeout(() => {
              loggers.chat.info('Attempting to focus input');
              if (document.querySelector('.debate-input-field')) {
                (document.querySelector('.debate-input-field') as HTMLTextAreaElement)?.focus();
              }
            }, 500);
            
            return; // 사용자 차례인 경우 여기서 종료
          } else {
            loggers.chat.info('Not user turn - is_user is false');
          }
        } else {
          loggers.chat.warn('No next_speaker data in success response');
        }
        
        // AI 차례인 경우 (기존 로직은 generating 상태에서 처리)
        loggers.chat.info('Success response but not user turn - treating as AI turn');
        setIsGeneratingResponse(false);
      } else if (data.status === 'generating') {
        // 백엔드에서 "generating" 상태를 반환한 경우 처리
        loggers.chat.info('AI generating message - showing thinking animation');
        
        const tempMessage: ChatMessage = {
          id: `temp-waiting-${Date.now()}`,
          text: 'Generating message...',
          sender: data.speaker_id,
          isUser: false,
          timestamp: new Date(),
          isGenerating: true,
          skipAnimation: true
        };
        
        setChatData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: [...(prev.messages || []), tempMessage]
          };
        });
        
        loggers.chat.info('Temporary message added, waiting for AI response via Socket.IO');
        
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
  };

  // 사용자 메시지 처리 함수 (테스트 파일과 동일한 로직)
  const handleProcessUserMessage = async (message: string) => {
    if (!currentUserTurn || !chatData) {
      loggers.chat.error('Cannot process user message - missing currentUserTurn or chatData');
      return;
    }
    
    try {
      loggers.chat.info('Processing user message:', message);
      loggers.chat.info('Current user turn:', currentUserTurn);
      loggers.chat.info('Username:', username);
      
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const roomId = String(chatData.id);
      
      // 테스트 파일과 동일한 방식으로 사용자 메시지 처리
      const requestBody = {
        message: message,
        user_id: currentUserTurn.speaker_id  // 백엔드에서 받은 speaker_id 사용
      };
      
      loggers.chat.info('Sending user message request:', requestBody);
      
      const response = await fetch(`${apiBaseUrl}/api/chat/debate/${roomId}/process-user-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '사용자 메시지 처리 실패');
      }
      
      const result = await response.json();
      loggers.chat.info('User message processed:', result);
      
      if (result.status === 'success') {
        loggers.chat.info('User message successfully processed - clearing user turn state');
        
        // 사용자 차례 종료 (테스트 파일과 동일한 플로우)
        setWaitingForUserInput(false);
        setCurrentUserTurn(null);
        
        // 다음 AI 응답 자동 요청 (약간의 지연 후)
        loggers.chat.info('Requesting next AI message...');
        setTimeout(() => {
          handleRequestNextMessage();
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
  };

  // 디버깅용 헬퍼 함수들
  const debugHelpers = {
    getCurrentState: () => ({
      waitingForUserInput,
      currentUserTurn,
      username,
      chatData: chatData ? { id: chatData.id, title: chatData.title } : null,
      isGeneratingResponse
    }),
    forceUserTurn: (speaker_id: string, role: string) => {
      loggers.chat.debug('Forcing user turn:', { speaker_id, role });
      setCurrentUserTurn({ speaker_id, role });
      setWaitingForUserInput(true);
      setIsGeneratingResponse(false);
    },
    clearUserTurn: () => {
      loggers.chat.debug('Clearing user turn');
      setWaitingForUserInput(false);
      setCurrentUserTurn(null);
    }
  };

  // 브라우저 콘솔에서 디버깅할 수 있도록 window 객체에 노출
  useEffect(() => {
    (window as any).debugChat = debugHelpers;
    loggers.chat.info('Debug helpers available: window.debugChat');
  }, [waitingForUserInput, currentUserTurn, username, chatData, isGeneratingResponse]);

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

  // V2 구조에서는 debate와 free 타입 지원
  if (chatData.dialogueType !== 'debate' && chatData.dialogueType !== 'free') {
    return (
      <div className="fixed inset-0 z-50 w-screen h-screen bg-white flex justify-center items-center flex-col">
        <p className="text-xl text-gray-500 mb-4">
          V2 구조는 현재 토론(debate)과 자유 토론(free) 채팅만 지원합니다.
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
      {/* 메인 채팅 컨테이너 - dialogueType에 따라 다른 UI 로드 */}
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
            typingMessageIds={typingMessageIds}
            onTypingComplete={handleTypingComplete}
            waitingForUserInput={waitingForUserInput}
            currentUserTurn={currentUserTurn}
            onProcessUserMessage={handleProcessUserMessage}
          />
        )}
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

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatContent />
    </Suspense>
  );
} 