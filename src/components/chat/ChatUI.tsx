'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/navigation';
import chatService, { ChatMessage } from '@/lib/ai/chatService';
import socketClient, { SocketClient } from '@/lib/socket/socketClient';

interface ChatUIProps {
  chatId: string | number;
  chatTitle: string;
  participants: {
    users: string[];
    npcs: string[];
  };
  initialMessages?: ChatMessage[];
  onBack?: () => void; // Optional callback for back button click
}

const ChatUI: React.FC<ChatUIProps> = ({ 
  chatId, 
  chatTitle, 
  participants, 
  initialMessages = [],
  onBack 
}) => {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isThinking, setIsThinking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [socketClientInstance, setSocketClientInstance] = useState<SocketClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [sentMessageIds, setSentMessageIds] = useState<string[]>([]);
  
  // Prompt for username if not already set
  useEffect(() => {
    if (!username) {
      // In a real app, this would be handled by an authentication system
      // or a profile setting. For now, we just generate a random username
      const randomUsername = `User_${Math.floor(Math.random() * 10000)}`;
      setUsername(randomUsername);
    }
  }, [username]);
  
  // Process and deduplicate messages
  const processedMessages = messages.filter((msg, index, self) => {
    // 이전 메시지와 동일한 내용과 발신자를 가진 메시지 제거 (5초 이내 발송된 경우)
    if (index > 0) {
      const prevMsg = self[index - 1];
      const timeDiff = new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime();
      
      // 같은 사람이 5초 이내에 동일한 텍스트를 보낸 경우 중복으로 간주
      if (
        msg.sender === prevMsg.sender && 
        msg.text === prevMsg.text && 
        msg.isUser === prevMsg.isUser && 
        timeDiff < 5000
      ) {
        return false;
      }
    }
    
    // 동일한 ID를 가진 첫 번째 메시지만 유지
    return index === self.findIndex(m => m.id === msg.id);
  });

  // 채팅방 ID가 변경될 때마다 완전히 새로운 채팅방으로 초기화
  useEffect(() => {
    // chatId가 변경되면 메시지와 상태를 완전히 초기화
    console.log(`🔄 채팅방 ID 변경: ${chatId}`);
    
    // 이전 메시지 상태 초기화
    setMessages([]);
    setIsThinking(false);
    setIsSending(false);
    setError(null);
    
    // 채팅방 별 고유한 ID로 빈 메시지 배열 초기화
    if (initialMessages && initialMessages.length > 0) {
      console.log(`⚡ 채팅방 ${chatId}에 대한 ${initialMessages.length}개 초기 메시지 설정`);
      setMessages([...initialMessages]);
    }
    
    // 화면 스크롤 초기화
    setTimeout(() => {
      if (endOfMessagesRef.current) {
        endOfMessagesRef.current.scrollIntoView({ behavior: 'auto' });
      }
    }, 100);
  }, [chatId, initialMessages]);

  // 채팅방 입장 시 최신 메시지 로드 기능 추가
  useEffect(() => {
    // 메시지가 없을 때만 API에서 메시지 로드
    const shouldLoadMessages = initialMessages.length === 0 && messages.length === 0;
    
    if (chatId && shouldLoadMessages && !loading) {
      const loadLatestMessages = async () => {
        try {
          // 채팅방 데이터 로드 (최신 메시지 포함)
          console.log(`Loading messages for chat room ID: ${chatId}`);
          const roomData = await chatService.getChatRoomById(chatId);
          
          // 잘못된 채팅방 필터링
          if (!roomData) {
            console.error(`Chat room not found: ${chatId}`);
            setError('Chat room not found');
            return;
          }
          
          if (String(roomData.id) !== String(chatId)) {
            console.error(`Chat ID mismatch: requested=${chatId}, received=${roomData.id}`);
            setError('Loaded incorrect chat room');
            return;
          }
          
          if (roomData.messages && roomData.messages.length > 0) {
            console.log(`Loaded ${roomData.messages.length} messages from API for room ID ${chatId}`);
            
            // 이전 메시지 지우고 새로 로드된 메시지로 설정
            setMessages(roomData.messages);
            
            // 메시지 로드 후 스크롤
            setTimeout(() => {
              if (endOfMessagesRef.current) {
                endOfMessagesRef.current.scrollIntoView({ behavior: 'auto' });
              }
            }, 100);
          } else {
            console.log('No messages found for room');
          }
        } catch (error) {
          console.error('Failed to load messages:', error);
          setError('Failed to load message history');
        }
      };
      
      loadLatestMessages();
    }
  }, [chatId, initialMessages.length, messages.length, loading]);

  // Socket.IO 연결 상태 관리 및 이벤트 리스너 설정
  useEffect(() => {
    if (!username) return;

    let cleanupFn: (() => void) | undefined;
    setLoading(true);

    // Initialize socket
    const initSocket = async () => {
      try {
        console.log('Starting socket initialization...');
        
        // Initialize socket client and wait for it to complete
        const instance = await socketClient.init(username);
        
        console.log('Socket client initialization completed');
        
        // Immediately bind the connect listener to ensure state update
        instance.on('connect', () => {
          console.log('⚡️ Socket connected event received - updating UI state');
          setIsSocketConnected(true);
          setError('');
          
          // Join room and get active users after connection
          const joinResult = instance.joinRoom(chatId);
          console.log('재연결 후 방 참가 요청 결과:', joinResult ? '성공' : '실패');
          instance.getActiveUsers(chatId);
        });
        
        // Check if socket is already connected and update state accordingly
        if (instance.isConnected()) {
          console.log('⚡️ Socket is already connected - setting state immediately');
          setIsSocketConnected(true);
        } else {
          console.log('⚡️ Socket is not yet connected - waiting for connect event');
        }
        
        // Update state with the instance
        setSocketClientInstance(instance);
        
        // ⚡️ 항상 방에 참가 - 연결 성공 여부와 상관없이 시도
        // 소켓이 아직 연결 중이면 소켓 라이브러리 내부에서 큐에 저장됨
        console.log('✅ 소켓 초기화 후 즉시 방 참가 시도:', chatId);
        const joinResult = instance.joinRoom(chatId);
        console.log('방 참가 요청 결과:', joinResult ? '성공' : '실패 (큐에 저장됨)');
        
        instance.getActiveUsers(chatId);
        
        // Set up the event listeners and get the cleanup function
        cleanupFn = setupEventListeners(instance);
        
        // 초기화 완료
        setLoading(false);
      } catch (error) {
        console.error('Error initializing socket:', error);
        setError('Failed to initialize socket connection. Using API fallback mode.');
        setIsSocketConnected(false);
        setLoading(false);
      }
    };

    // Set up all event listeners
    const setupEventListeners = (instance: SocketClient) => {
      // 소켓 연결 상태 업데이트
      const onConnect = () => {
        console.log('✅ Socket.IO connected!');
        setIsSocketConnected(true);
        setError('');
        
        // ⚡️ 연결/재연결 시에도 방에 즉시 다시 참가
        console.log('✅ 연결/재연결 시 방에 참가:', chatId);
        const joinResult = instance.joinRoom(chatId);
        console.log('재연결 후 방 참가 요청 결과:', joinResult ? '성공' : '실패');
        
        instance.getActiveUsers(chatId);
      };
      
      // First remove any existing handlers to prevent duplicates
      instance.off('connect', onConnect);
      // Then add the handler
      instance.on('connect', onConnect);

      // 소켓 연결 해제 처리
      const onDisconnect = () => {
        console.log('Socket.IO disconnected');
        setIsSocketConnected(false);
        
        // 비정상적인 연결 해제인 경우에만 에러 메시지 표시
        setError('서버와의 연결이 끊어졌습니다. 자동으로 재연결을 시도합니다.');
      };
      
      // Remove any existing handlers
      instance.off('disconnect', onDisconnect);
      // Then add the handler
      instance.on('disconnect', onDisconnect);
      
      // Handle new messages received through socket
      const onNewMessage = (data: { roomId: string, message: ChatMessage }) => {
        console.log('🔍 새 메시지 수신:', data);
        
        // 해당 방의 메시지인지 확인 - 문자열 변환하여 비교
        const currentRoomId = String(chatId);
        const receivedRoomId = String(data.roomId);
        
        if (currentRoomId !== receivedRoomId) {
          console.log(`❌ 메시지 무시: 다른 방의 메시지 (${receivedRoomId} != ${currentRoomId})`);
          return;
        }
        
        // 유효성 검사 - 메시지 객체가 없으면 무시
        if (!data.message) {
          console.error('❌ 유효하지 않은 메시지 데이터:', data);
          return;
        }
        
        console.log('✅ 유효한 메시지임, UI에 추가 검토:', data.message);
        
        // sentMessageIds에 있는 메시지 ID인지 확인 (내가 보낸 메시지가 서버에서 다시 오는 경우)
        if (sentMessageIds.includes(data.message.id)) {
          console.log('⚠️ 내가 보낸 메시지가 서버에서 다시 왔습니다. 무시합니다:', data.message.id);
          return;
        }
        
        // 메시지가 현재 사용자의 것이고, 이미 로컬에 표시된 경우 (ID는 다르지만 내용이 같은 경우)
        if (data.message.isUser && data.message.sender === username) {
          // 최근 5초 이내에 보낸 동일한 내용의 메시지가 있는지 확인
          const now = new Date().getTime();
          const existingSimilarMessage = messages.some(msg => 
            msg.sender === data.message.sender && 
            msg.text === data.message.text && 
            msg.isUser === data.message.isUser &&
            now - new Date(msg.timestamp).getTime() < 5000
          );
          
          if (existingSimilarMessage) {
            console.log('⚠️ 이미 표시된 유사한 메시지입니다. 무시합니다:', data.message.text);
            return;
          }
        }
        
        // 이미 UI에 있는 메시지인지 확인 (중복 방지)
        setMessages(prev => {
          // 이미 존재하는 메시지인지 확인 (ID로 비교)
          const isDuplicate = prev.some(msg => msg.id === data.message.id);
          
          // 이미 존재하는 메시지면 무시
          if (isDuplicate) {
            console.log('⚠️ 중복 메시지 무시 (ID 일치):', data.message.id);
            return prev;
          }
          
          // 새 메시지 추가 - 즉시 화면에 표시하기 위해 상태 업데이트
          console.log('🆕 새 메시지 추가:', data.message);
          return [...prev, data.message];
        });
        
        // AI 응답이면 thinking 상태 해제
        if (!data.message.isUser) {
          setIsThinking(false);
        }
        
        // 새 메시지가 오면 자동으로 스크롤
        setTimeout(() => {
          if (endOfMessagesRef.current) {
            endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
        
        // 주기적으로 오래된 sentMessageIds 정리 (30초 이상 지난 ID 제거)
        setSentMessageIds(prev => {
          const thirtySecondsAgo = Date.now() - 30000;
          return prev.filter(id => {
            // ID에서 타임스탬프 추출 (형식: user-1234567890)
            const timestamp = parseInt(id.split('-')[1]);
            return isNaN(timestamp) || timestamp > thirtySecondsAgo;
          });
        });
      };
      
      // Handle thinking state for AI responses
      const onThinking = (data: { sender: string }) => {
        if (data.sender === chatId.toString()) {
          setIsThinking(true);
        }
      };
      
      // Handle active users update
      const onActiveUsers = (data: { roomId: string; users: string[] }) => {
        if (data.roomId === chatId.toString()) {
          setActiveUsers(data.users);
        }
      };
      
      // Handle user joining event
      const onUserJoined = (data: { username: string; usersInRoom: string[]; participants: any }) => {
        setActiveUsers(data.usersInRoom);
        
        // Add system message about user joining
        if (data.username !== username) {
          const joinMessage: ChatMessage = {
            id: `system-join-${Date.now()}`,
            text: `${data.username} has joined the conversation.`,
            sender: 'System',
            isUser: false,
            timestamp: new Date()
          };
          
          setMessages(prev => [...prev, joinMessage]);
        }
        
        // If participants have changed, update them
        if (data.participants) {
          // Update participants if needed
        }
      };
      
      // Handle user leaving event
      const onUserLeft = (data: { username: string; usersInRoom: string[] }) => {
        setActiveUsers(data.usersInRoom);
        
        // Add system message about user leaving
        if (data.username !== username) {
          const leaveMessage: ChatMessage = {
            id: `system-leave-${Date.now()}`,
            text: `${data.username} has left the conversation.`,
            sender: 'System',
            isUser: false,
            timestamp: new Date()
          };
          
          setMessages(prev => [...prev, leaveMessage]);
        }
      };
      
      // Handle socket errors
      const onError = (data: { message: string }) => {
        setError(data.message);
        setTimeout(() => setError(null), 5000); // Clear error after 5 seconds
      };
      
      try {
        // 소켓 이벤트 리스너 설정 - Remove existing handlers first
        instance.off('new-message', onNewMessage);
        instance.off('thinking', onThinking);
        instance.off('active-users', onActiveUsers);
        instance.off('user-joined', onUserJoined);
        instance.off('user-left', onUserLeft);
        instance.off('error', onError);
        
        // Then add new handlers
        instance.on('new-message', onNewMessage);
        instance.on('thinking', onThinking);
        instance.on('active-users', onActiveUsers);
        instance.on('user-joined', onUserJoined);
        instance.on('user-left', onUserLeft);
        instance.on('error', onError);
        
        // 사용자 접속 상태 확인을 위한 타임아웃 설정
        const timeoutId = setTimeout(() => {
          if (!instance.isConnected()) {
            console.warn('Socket connection timeout - falling back to direct API mode');
            setError('Network connection limited. Using API fallback mode.');
            setIsSocketConnected(false);
          }
        }, 5000); // 5초 타임아웃
        
        // Return cleanup function
        return () => {
          clearTimeout(timeoutId);
          // 기존 정리 로직
          instance.off('new-message', onNewMessage);
          instance.off('thinking', onThinking);
          instance.off('active-users', onActiveUsers);
          instance.off('user-joined', onUserJoined);
          instance.off('user-left', onUserLeft);
          instance.off('error', onError);
          instance.off('connect', onConnect);
          instance.off('disconnect', onDisconnect);
          
          // Leave the room when component unmounts
          if (instance.isConnected()) {
            instance.leaveRoom(chatId);
          }
        };
      } catch (error) {
        console.error('Error setting up socket event listeners:', error);
        setError('Failed to set up connection. Using API fallback mode.');
        setIsSocketConnected(false);
        return () => {};
      }
    };

    // Start the initialization process
    initSocket();
    
    // Return a cleanup function for the useEffect
    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
    
  }, [chatId, username]);

  // Handle back button click
  const handleBackButtonClick = () => {
    // Leave the room before navigating away
    if (socketClientInstance?.isConnected()) {
      socketClientInstance.leaveRoom(chatId);
    }
    
    if (onBack) {
      onBack();
    } else {
      router.push('/open-chat');
    }
  };

  // Auto-resize textarea for input
  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  // Auto focus input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      adjustTextareaHeight();
    }
  }, []);

  // Adjust height when message changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const handleSendMessage = async (e: React.FormEvent) => {
    console.log('🔥 handleSendMessage 실행됨, message=', message);
    e.preventDefault();
    if (message.trim() === '' || isSending) return;

    try {
      setIsSending(true);
      setError(null);
      
      // 사용자 메시지 객체 생성
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        text: message,
        sender: username,
        isUser: true,
        timestamp: new Date()
      };
      
      console.log('✅ 디버깅: 현재 socket 연결 상태:', isSocketConnected ? '연결됨' : '연결안됨');
      console.log('✅ 디버깅: socketClientInstance 존재 여부:', !!socketClientInstance);
      console.log('✅ 디버깅: 실제 연결 상태:', socketClientInstance?.isConnected() ? '연결됨' : '연결안됨');
      
      // 메시지 내용 지우기 및 UI 업데이트
      setMessage('');
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
      
      // Try socket path first, but allow API fallback
      let socketSucceeded = false;
      
      if (socketClientInstance && socketClientInstance.isConnected()) {
        console.log('⚡️ 소켓이 연결되어 있어 socket.io로 전송 시도');
        
        // 소켓으로 메시지를 보내기 전에 메시지 ID를 기록하여 중복 표시 방지 
        setSentMessageIds(prev => [...prev, userMessage.id]);
        
        // 메시지 ID가 기록되기 전에 UI에 메시지 추가 (사용자 경험 향상을 위함)
        setMessages(prev => [...prev, userMessage]);
        
        // Try socket emission
        const success = socketClientInstance.sendMessage(chatId, message);
        console.log('⚡️ Socket sendMessage 결과:', success ? '성공' : '실패');
        socketSucceeded = success;
        
        if (success) {
          // Socket succeeded, no need for API fallback
          setIsThinking(true);
          return;
        }
        // If socket failed, continue to API fallback
      }
      
      // Socket failed or not connected, use API fallback
      console.log('⚠️ 소켓 메시지 전송 실패 또는 소켓 미연결 - API로 전송');
      
      // 소켓 실패 시 UI에 메시지 추가 (소켓이 이미 추가했다면 수행되지 않음)
      // 중복 메시지가 있는지 확인
      const messageExists = messages.some(msg => msg.id === userMessage.id);
      if (!messageExists) {
        setMessages(prev => [...prev, userMessage]);
      }
      
      // Show thinking indicator
      setIsThinking(true);

      try {
        console.log('🤖 API 경로로 메시지 처리 시작');
        
        // 1. API 호출로 사용자 메시지 전송 (메시지 저장)
        console.log('📤 API로 사용자 메시지 저장 요청...');
        const userMessageResponse = await chatService.sendMessage(chatId, message, username);
        console.log('✅ 사용자 메시지 저장 성공:', userMessageResponse);
        
        // AI 응답 처리 중 표시
        setIsThinking(true);
        
        // 2. 직접 AI 응답 가져오기
        console.log('📥 chatService.getAIResponse 호출로 AI 응답 요청 중...');
        try {
          // chatService를 사용하여 AI 응답 가져오기
          const aiMessage = await chatService.getAIResponse(chatId);
          console.log('🤖 AI 응답 받음 (API):', aiMessage);
          
          // 유효성 검사
          if (!aiMessage || !aiMessage.text || !aiMessage.sender) {
            console.error('❌ 유효하지 않은 AI 응답:', aiMessage);
            throw new Error('Invalid AI response format');
          }
          
          // 메시지 목록에 AI 응답 추가
          setMessages(prev => [...prev, aiMessage]);
          setIsThinking(false);
        } catch (aiError) {
          console.error('❌ AI 응답 가져오기 실패:', aiError);
          
          // 직접 API 호출로 대체
          console.log('⚠️ 직접 API 호출로 대체 시도...');
          
          const aiResponseRaw = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-llm-provider': localStorage.getItem('llmProvider') || 'openai',
              'x-llm-model': localStorage.getItem('openaiModel') || 'gpt-4o'
            },
            body: JSON.stringify({
              messages: [...processedMessages, userMessage],
              roomId: chatId,
              topic: chatTitle,
              context: '',
              participants: participants
            }),
          });
          
          if (!aiResponseRaw.ok) {
            console.error(`❌ API 오류 응답: ${aiResponseRaw.status}`);
            throw new Error(`API 응답 오류: ${aiResponseRaw.status}`);
          }
          
          const aiMessage = await aiResponseRaw.json();
          console.log('🤖 직접 API에서 AI 응답 받음:', aiMessage);
          
          // 유효성 검사
          if (!aiMessage || !aiMessage.text || !aiMessage.sender) {
            console.error('❌ 유효하지 않은 AI 응답:', aiMessage);
            throw new Error('Invalid AI response format');
          }
          
          // 메시지 목록에 AI 응답 추가
          setMessages(prev => [...prev, {
            ...aiMessage,
            // ID가 없으면 생성
            id: aiMessage.id || `api-${Date.now()}`,
            // 타임스탬프가 없거나 문자열이면 변환
            timestamp: aiMessage.timestamp ? 
              (typeof aiMessage.timestamp === 'string' ? new Date(aiMessage.timestamp) : aiMessage.timestamp) 
              : new Date()
          }]);
          setIsThinking(false);
        }
      } catch (error) {
        console.error('🔥 API 호출 오류:', error);
        
        // API 호출 실패 시 수정된 폴백 로직
        try {
          console.log('⚠️ API 호출 실패 - 대체 응답 생성 시도');
          
          // 철학자 선택 (채팅방 참여자 중 하나)
          const philosopher = participants.npcs[0] || "Socrates";
          
          // 간단한 응답 생성 (대화 지속을 위한 최소한의 응답)
          const fallbackResponse = {
            id: `fallback-${Date.now()}`,
            text: `I'm considering your message about "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}". Let me think about this for a moment as we continue our dialogue.`,
            sender: philosopher,
            isUser: false,
            timestamp: new Date()
          };
          
          console.log('⚠️ 대체 응답 생성됨:', fallbackResponse);
          
          // AI 응답으로 추가
          setMessages(prev => [...prev, fallbackResponse]);
          
          // 저장 시도
          try {
            await chatService.sendMessage(chatId, fallbackResponse.text, fallbackResponse.sender);
            console.log('✅ 대체 응답 저장 성공');
          } catch (saveError) {
            console.error('❌ 대체 응답 저장 실패:', saveError);
          }
        } catch (fallbackError) {
          console.error('❌ 대체 응답 생성 실패:', fallbackError);
          
          // 최후의 폴백 - 시스템 메시지
          const errorMessage = {
            id: `error-${Date.now()}`,
            text: "I've received your message and will respond shortly. Please allow me a moment to gather my thoughts.",
            sender: participants.npcs[0] || "System",
            isUser: false,
            timestamp: new Date()
          };
          
          setMessages(prev => [...prev, errorMessage]);
        } finally {
          setIsThinking(false);
        }
      }
    } catch (error) {
      console.error('Error in chat:', error);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle key press in textarea (Enter to send, Shift+Enter for new line)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    console.log('🎮 Key pressed:', e.key, 'shiftKey:', e.shiftKey);
    if (e.key === 'Enter' && !e.shiftKey) {
      console.log('🎮 Enter pressed without shift - submitting message');
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Format time as HH:MM AM/PM - NaN 오류 해결
  const formatTime = (date: Date) => {
    try {
      // 날짜 객체 확인 및 변환
      const validDate = date instanceof Date ? date : new Date(date);
      if (isNaN(validDate.getTime())) {
        return ""; // 유효하지 않은 날짜면 빈 문자열 반환
      }
      
      return validDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (error) {
      console.error("Time formatting error:", error);
      return ""; // 오류 발생 시 빈 문자열 반환
    }
  };

  // Check if date has changed between messages to display date separator
  const shouldShowDate = (currentMsg: ChatMessage, index: number, msgList: ChatMessage[]) => {
    if (index === 0) return true;
    
    const prevDate = new Date(msgList[index - 1].timestamp).toDateString();
    const currDate = new Date(currentMsg.timestamp).toDateString();
    
    return prevDate !== currDate;
  };

  // Toggle user list
  const toggleUserList = () => {
    setShowUserList(!showUserList);
  };

  // 소켓 연결 다시 시도
  const handleReconnect = async () => {
    try {
      // 소켓 다시 초기화 - use init method instead of constructor
      console.log('🔄 수동 재연결 시도...');
      const instance = await socketClient.init(username);
      setSocketClientInstance(instance);
      
      // 재연결 후 즉시 방에 참가 시도
      console.log('🔄 재연결 후 방 참가 시도:', chatId);
      if (instance) {
        const joinResult = instance.joinRoom(chatId);
        console.log('수동 재연결 후 방 참가 결과:', joinResult ? '성공' : '실패');
        instance.getActiveUsers(chatId);
      }
      
      setError(null);  // 성공하면 에러 메시지 제거
    } catch (error) {
      console.error('재연결 실패:', error);
      setError('Reconnection failed. Please try again.');
    }
  };

  // Add a test function
  const testSendDirectMessage = () => {
    if (!socketClientInstance) {
      console.error('No socket client instance available');
      return;
    }
    
    console.log('🧪 Testing direct message sending');
    
    // Create a test message
    const testMsg = {
      id: `test-${Date.now()}`,
      text: `Test message at ${new Date().toLocaleTimeString()}`,
      sender: username,
      isUser: true,
      timestamp: new Date()
    };
    
    // Access the socket directly for debugging
    const socketObj = (socketClientInstance as any).socket;
    
    if (!socketObj) {
      console.error('No socket object available');
      return;
    }
    
    // Try to emit directly
    try {
      console.log('🧪 Emitting test message directly');
      socketObj.emit('send-message', {
        roomId: chatId,
        message: testMsg
      });
      console.log('🧪 Test message emitted');
      
      // Update UI immediately
      setMessages(prev => [...prev, testMsg]);
    } catch (err) {
      console.error('🧪 Error sending test message:', err);
    }
  };

  // Add an additional test function with an extremely simple message
  const testBasicMessage = () => {
    if (!socketClientInstance) {
      console.error('No socket client instance available');
      return;
    }
    
    console.log('🔎 Testing basic message with simplified object');
    
    // Access the socket directly for debugging
    const socketObj = (socketClientInstance as any).socket;
    
    if (!socketObj) {
      console.error('No socket object available');
      return;
    }
    
    // Try to emit a very simplified message object - absolute minimum
    try {
      const basicMsg = {
        text: "Basic test message",
        sender: username,
        isUser: true,
        id: "test-" + Date.now(),
        timestamp: new Date()
      };
      
      console.log('🔎 Emitting basic message:', basicMsg);
      socketObj.emit('send-message', {
        roomId: String(chatId),
        message: basicMsg
      });
      console.log('🔎 Basic message emit complete');
      
      // Update UI
      setMessages(prev => [...prev, basicMsg]);
    } catch (err) {
      console.error('🔎 Error sending basic message:', err);
    }
  };

  // Add a dedicated socket connection debugging function
  const debugSocketConnection = () => {
    console.log('🔍 Socket Connection Debug:');
    console.log('UI isSocketConnected state:', isSocketConnected);
    
    if (!socketClientInstance) {
      console.log('❌ No socketClientInstance available');
      return;
    }
    
    console.log('✅ Socket client exists');
    console.log('Socket connected (client):', socketClientInstance.isConnected());
    
    try {
      // Access the raw socket object for debugging
      const rawSocket = (socketClientInstance as any).socket;
      
      if (!rawSocket) {
        console.log('❌ No raw socket available in instance');
        return;
      }
      
      console.log('Socket details:', {
        id: rawSocket.id,
        connected: rawSocket.connected,
        disconnected: rawSocket.disconnected,
        nsp: rawSocket.nsp,
        auth: rawSocket.auth
      });
      
      // Check socket's internal state
      if (rawSocket.io) {
        console.log('Transport:', rawSocket.io.engine?.transport?.name);
        console.log('Reconnection attempts:', rawSocket.io.reconnectionAttempts());
        console.log('Reconnection delay:', rawSocket.io.reconnectionDelay());
      }
      
      // List active event listeners
      console.log('Event listeners:', rawSocket._events ? Object.keys(rawSocket._events) : 'Not available');
      
      // Alert summary for quick visual feedback
      alert(`Socket Debug:
ID: ${rawSocket.id || 'none'}
Connected: ${rawSocket.connected ? 'Yes' : 'No'}
Transport: ${rawSocket.io?.engine?.transport?.name || 'none'}
Namespace: ${rawSocket.nsp || '/'}
`);
    } catch (err) {
      console.error('Error accessing socket details:', err);
    }
  };

  // Add a test function for direct API call
  const testDirectAPICall = async () => {
    try {
      console.log('🧪 Testing direct API call');
      setIsThinking(true);
      
      // Create a simple test message
      const testMsg: ChatMessage = {
        id: `test-${Date.now()}`,
        text: `Test question at ${new Date().toLocaleTimeString()}`,
        sender: username,
        isUser: true,
        timestamp: new Date()
      };
      
      // Add to UI immediately
      setMessages(prev => [...prev, testMsg]);
      
      // Call API directly
      console.log('🧪 Calling chat API directly...');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-llm-provider': 'openai',
          'x-llm-model': 'gpt-4o'
        },
        body: JSON.stringify({
          messages: [...processedMessages, testMsg],
          roomId: chatId,
          topic: chatTitle,
          context: '',
          participants: participants
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      // Process response
      const aiResponse = await response.json();
      console.log('🧪 Direct API response:', aiResponse);
      
      // Add to UI
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('🧪 Direct API test error:', error);
      alert('API test failed: ' + error);
    } finally {
      setIsThinking(false);
    }
  };

  // Add a function to send message directly via API
  const sendDirectAPIMessage = async () => {
    if (message.trim() === '' || isSending) return;
    
    try {
      setIsSending(true);
      console.log('🚀 직접 API로 메시지 전송 시도:', message);
      
      // Create user message
      const userMessage: ChatMessage = {
        id: `api-user-${Date.now()}`,
        text: message,
        sender: username,
        isUser: true,
        timestamp: new Date()
      };
      
      // Add to UI
      setMessages(prev => [...prev, userMessage]);
      setMessage('');
      setIsThinking(true);
      
      // Call API directly
      console.log('📤 API 직접 호출 중...');
      const aiResponseRaw = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-llm-provider': 'openai',
          'x-llm-model': 'gpt-4o'
        },
        body: JSON.stringify({
          messages: [...processedMessages, userMessage],
          roomId: chatId,
          topic: chatTitle,
          context: '',
          participants: participants
        }),
      });
      
      if (!aiResponseRaw.ok) {
        throw new Error(`API error: ${aiResponseRaw.status}`);
      }
      
      // Process response
      const aiMessage = await aiResponseRaw.json();
      console.log('📥 API 응답 수신:', aiMessage);
      
      // Add to UI with proper formatting
      setMessages(prev => [...prev, {
        ...aiMessage,
        id: aiMessage.id || `api-${Date.now()}`,
        timestamp: aiMessage.timestamp ? 
          (typeof aiMessage.timestamp === 'string' ? new Date(aiMessage.timestamp) : aiMessage.timestamp) 
          : new Date()
      }]);
    } catch (error) {
      console.error('❌ 직접 API 호출 오류:', error);
      setError('API call failed: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsThinking(false);
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col w-full h-full overflow-hidden">
      {/* Chat header */}
      <div className="bg-white border-b border-gray-200 p-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center">
          <button 
            onClick={handleBackButtonClick}
            className="mr-3 hover:bg-gray-100 p-2 rounded-full transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-700" />
          </button>
          <div>
            <h2 className="font-semibold text-gray-900">{chatTitle}</h2>
            <p className="text-xs text-gray-500">
              with {participants.npcs.join(', ')}
            </p>
          </div>
        </div>
        
        {/* Connection status indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <div className={`w-2.5 h-2.5 rounded-full mr-2 ${isSocketConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div className="text-xs text-gray-500">
              {isSocketConnected ? 'Connected' : 'Offline'}
            </div>
            
            {!isSocketConnected && (
              <button 
                onClick={handleReconnect}
                className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                Reconnect
              </button>
            )}
            
            {isSocketConnected && (
              <button 
                onClick={() => {
                  console.log('Testing socket connection');
                  socketClientInstance?.ping();
                }}
                className="ml-2 text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
              >
                Test Socket
              </button>
            )}
            
            {isSocketConnected && (
              <button 
                onClick={testSendDirectMessage}
                className="ml-2 text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
              >
                Test Message
              </button>
            )}
            
            {isSocketConnected && (
              <button 
                onClick={testBasicMessage}
                className="ml-2 text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                Basic Message
              </button>
            )}
            
            <button 
              onClick={debugSocketConnection}
              className="ml-2 text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
            >
              Debug Socket
            </button>
            
            <button 
              onClick={testDirectAPICall}
              className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              Test API
            </button>
          </div>
          
          <button 
            onClick={toggleUserList}
            className="flex items-center text-xs px-2 py-1 ml-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            <span>{activeUsers.length} Online</span>
          </button>
          
          {/* Active users dropdown */}
          {showUserList && (
            <div className="absolute right-4 top-14 bg-white border border-gray-200 rounded-md shadow-lg p-3 z-10 w-64">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">Active Users ({activeUsers.length})</h3>
                <button 
                  onClick={toggleUserList} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  &times;
                </button>
              </div>
              <ul className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                {activeUsers.map((user, index) => (
                  <li key={`user-${index}`} className="py-2 flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm">
                      {user === username ? (
                        <span className="font-medium">{user} <span className="text-xs text-gray-500">(You)</span></span>
                      ) : (
                        user
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      
      {/* Error message display */}
      {error && (
        <div className="bg-red-50 text-red-700 p-2 text-sm text-center">
          {error}
          {!isSocketConnected && (
            <button 
              onClick={handleReconnect}
              className="ml-2 underline"
            >
              Try again
            </button>
          )}
        </div>
      )}
      
      {/* Loading indicator */}
      {loading ? (
        <div className="flex-grow flex items-center justify-center bg-gray-50">
          <div className="animate-pulse text-center">
            <div className="h-10 w-10 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-600">Loading messages...</p>
          </div>
        </div>
      ) : (
        /* Messages container */
        <div 
          ref={messagesContainerRef}
          className="flex-grow overflow-y-auto p-4 bg-gray-50 overflow-x-hidden"
          style={{ 
            overflowY: 'auto', 
            WebkitOverflowScrolling: 'touch', 
            maxWidth: '100%',
            width: '100%',
            padding: '1rem 0.5rem'
          }}
        >
          <div className="max-w-2xl mx-auto space-y-2 pb-4 px-4">
            {/* System welcome message */}
            {processedMessages.length > 0 && processedMessages[0].sender === 'System' && (
              <div className="flex justify-center mb-4">
                <div className="bg-gray-100 text-gray-600 rounded-lg px-4 py-2 text-xs max-w-[90%] text-center shadow-sm border border-gray-200">
                  {processedMessages[0].text}
                </div>
              </div>
            )}
            
            {/* User and NPC messages, skip the first message if it's a system message */}
            {processedMessages
              .filter((msg, index) => !(index === 0 && msg.sender === 'System'))
              .map((msg, index, filteredList) => (
                <React.Fragment key={`${msg.id}-${index}`}>
                  {/* Date separator */}
                  {shouldShowDate(msg, index, filteredList) && (
                    <div className="flex justify-center my-3">
                      <div className="bg-gray-200 rounded-full px-3 py-1 text-xs text-gray-600 shadow-sm">
                        {new Date(msg.timestamp).toLocaleDateString('en-US', { 
                          weekday: 'short',
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Message bubble */}
                  <div className={`flex ${
                    // 현재 사용자(나)의 메시지만 오른쪽에 표시
                    msg.isUser && msg.sender === username ? 'justify-end' : 'justify-start'
                  } mb-3`}>
                    <div className="flex flex-col" style={{ maxWidth: '70%', width: 'auto' }}>
                      {/* Sender name - 메시지를 보낸 사람의 이름 표시 (내 메시지 제외) */}
                      {(msg.sender !== username || !msg.isUser) && 
                        (index === 0 || filteredList[index-1].sender !== msg.sender) && (
                        <span className="text-xs font-medium text-gray-600 ml-2 mb-1">
                          {msg.isUser ? msg.sender : msg.sender}
                        </span>
                      )}
                      
                      {/* 간소화된 말풍선 UI - CSS 클래스 사용 */}
                      <div className={`chat-message-bubble ${
                        msg.isUser 
                          ? (msg.sender === username 
                              ? 'chat-message-bubble-mine' // 내 메시지: 회색
                              : 'chat-message-bubble-other-user')  // 다른 사용자: 파란색
                          : 'chat-message-bubble-npc' // NPC: 초록색
                      }`}>
                        {/* Message text */}
                        <div>
                          <p className="break-words whitespace-pre-wrap overflow-hidden text-wrap">
                            {(() => {
                              // JSON 형식인지 확인하고 파싱
                              try {
                                if (msg.text.trim().startsWith('{') && msg.text.trim().endsWith('}')) {
                                  const parsed = JSON.parse(msg.text);
                                  return parsed.text || msg.text;
                                }
                                return msg.text;
                              } catch (e) {
                                return msg.text;
                              }
                            })()}
                          </p>
                          
                          {/* Time stamp - 조건부 렌더링으로 유효하지 않은 timestamp 처리 */}
                          {msg.timestamp && !isNaN(new Date(msg.timestamp).getTime()) && (
                            <p className="chat-message-time">
                              {formatTime(msg.timestamp)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            
            {/* Thinking indicator */}
            {isThinking && (
              <div className="flex justify-start mb-3">
                <div className="flex flex-col max-w-[85%]">
                  <span className="text-xs font-medium text-gray-600 ml-2 mb-1">
                    {participants.npcs[0]}
                  </span>
                  <div className="chat-message-bubble chat-message-bubble-npc">
                    {/* Thinking dots */}
                    <div className="flex space-x-2 py-1">
                      <div className="bg-white rounded-full w-2.5 h-2.5 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="bg-white rounded-full w-2.5 h-2.5 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="bg-white rounded-full w-2.5 h-2.5 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={endOfMessagesRef} className="h-3" />
          </div>
        </div>
      )}
      
      {/* Message input */}
      <div className="bg-white border-t border-gray-200 p-3 pb-6 w-full">
        <form 
          onSubmit={(e) => { 
            console.log('📝 Form submit event triggered');
            e.preventDefault(); // Ensure we prevent the default form submission 
            handleSendMessage(e); 
          }} 
          className="max-w-2xl mx-auto px-3"
        >
          <div className="chat-input-container">
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message (Press Enter to send)"
              className="chat-textarea"
              disabled={isThinking || isSending}
              rows={1}
            />
            <button 
              type="submit" 
              className={`chat-send-button ${
                message.trim() === '' || isThinking || isSending 
                  ? 'opacity-50' 
                  : ''
              }`}
              disabled={message.trim() === '' || isThinking || isSending}
              onClick={(e) => {
                console.log('🚀 Send button clicked');
                // Don't call handleSendMessage here - the form's onSubmit will handle it
              }}
            >
              {isSending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <PaperAirplaneIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </form>
        
        {/* Direct API button - when socket is giving trouble */}
        <div className="max-w-2xl mx-auto mt-2 flex justify-center">
          <button
            onClick={sendDirectAPIMessage}
            disabled={message.trim() === '' || isThinking || isSending}
            className={`px-3 py-1 text-xs bg-blue-600 text-white rounded-full shadow-sm hover:bg-blue-700 transition-colors ${
              message.trim() === '' || isThinking || isSending 
                ? 'opacity-50 cursor-not-allowed' 
                : ''
            }`}
          >
            Send via API directly
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatUI; 