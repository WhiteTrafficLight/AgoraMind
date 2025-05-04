'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/navigation';
import chatService, { ChatMessage as ChatMessageBase } from '@/lib/ai/chatService';
import socketClient, { SocketClient } from '@/lib/socket/socketClient';

// Extend the ChatMessage interface to include additional NPC information
interface ChatMessage extends ChatMessageBase {
  isNew?: boolean;
  senderName?: string;
  senderType?: string;
  portrait_url?: string;
  npc_id?: string;
}

// Typing animation component
// This is a test comment to verify editing works
const TypingAnimation = ({ text }: { text: string }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(currentIndex + 1);
      }, 40); // Slower typing speed (was 20)
      
      return () => clearTimeout(timer);
    }
  }, [currentIndex, text]);
  
  useEffect(() => {
    // Reset when text changes
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);
  
  return <>{displayedText}</>;
};

// NPC 상세 정보 인터페이스 추가
interface NpcDetail {
  id: string;
  name: string;
  description?: string;
  portrait_url?: string;
  is_custom: boolean;
}

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
  
  // NPC 상세 정보를 저장할 state 추가
  const [npcDetails, setNpcDetails] = useState<Record<string, NpcDetail>>({});
  
  const [autoDialogueMode, setAutoDialogueMode] = useState(false);
  const [isAutoDialogueRunning, setIsAutoDialogueRunning] = useState(false);
  
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Prompt for username if not already set
  useEffect(() => {
    if (!username) {
      // Get username from session storage first (for persistence between refreshes)
      const storedUsername = sessionStorage.getItem('chat_username');
      
      if (storedUsername) {
        setUsername(storedUsername);
      } else {
        // Fetch current user from API or use a default
        fetch('/api/user/current')
          .then(res => res.json())
          .then(data => {
            if (data && data.username) {
              // Use API user if available
              setUsername(data.username);
              sessionStorage.setItem('chat_username', data.username);
            } else {
              // Fallback - generate only if we absolutely need to
              const randomUsername = `User_${Math.floor(Math.random() * 10000)}`;
              setUsername(randomUsername);
              sessionStorage.setItem('chat_username', randomUsername);
            }
          })
          .catch(err => {
            // Fallback on error
            console.error('Error fetching user:', err);
            const randomUsername = `User_${Math.floor(Math.random() * 10000)}`;
            setUsername(randomUsername);
            sessionStorage.setItem('chat_username', randomUsername);
          });
      }
    }
  }, []);
  
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
      // Mark existing messages as not new to avoid animation
      const existingMessages = initialMessages.map(msg => ({
        ...msg,
        isNew: false // Existing messages are not new
      }));
      setMessages([...existingMessages]);
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
    
    if (chatId && shouldLoadMessages && !loading && username) {
      loadLatestMessages();
    }
  }, [chatId, initialMessages.length, messages.length, loading, username]);

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
      const onNewMessage = async (data: { roomId: string, message: ChatMessage }) => {
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
        console.log('📋 메시지 세부 정보:');
        console.log(`- ID: ${data.message.id}`);
        console.log(`- Sender: ${data.message.sender}`);
        console.log(`- SenderName: ${data.message.senderName}`);
        console.log(`- SenderType: ${data.message.senderType}`);
        console.log(`- NPC ID: ${data.message.npc_id}`);
        console.log(`- Portrait URL: ${data.message.portrait_url}`);
        console.log(`- 텍스트 미리보기: ${data.message.text.substring(0, 100)}...`);
        
        // sentMessageIds에 있는 메시지 ID인지 확인 (내가 보낸 메시지가 서버에서 다시 오는 경우)
        if (sentMessageIds.includes(data.message.id)) {
          console.log('⚠️ 내가 보낸 메시지가 서버에서 다시 왔습니다. 무시합니다:', data.message.id);
          return;
        }
        
        // 메시지가 현재 사용자의 것이고, 이미 로컬에 표시된 경우 (ID는 다르지만 내용이 같은 경우)
        // Get stored username for consistency
        const storedUsername = sessionStorage.getItem('chat_username') || username;
        if (data.message.isUser && (data.message.sender === username || data.message.sender === storedUsername)) {
          // 최근 5초 이내에 보낸 동일한 내용의 메시지가 있는지 확인
          const now = new Date().getTime();
          const existingSimilarMessage = messages.some(msg => 
            (msg.sender === username || msg.sender === storedUsername) && 
            msg.text === data.message.text && 
            msg.isUser === data.message.isUser &&
            now - new Date(msg.timestamp).getTime() < 5000
          );
          
          if (existingSimilarMessage) {
            console.log('⚠️ 이미 표시된 유사한 메시지입니다. 무시합니다:', data.message.text);
            return;
          }
        }
        
        // NPC 메시지인 경우, 해당 NPC의 정보를 먼저 로드
        if (!data.message.isUser) {
          const npcId = data.message.npc_id || data.message.sender;
          
          try {
            // NPC 정보가 캐시에 없는 경우에만 로드
            if (npcId && !npcDetails[npcId]) {
              console.log(`🔍 새 메시지에 대한 NPC 정보 로드 중: ${npcId}`);
              const npcInfo = await fetchNpcDetails(npcId);
              setNpcDetails(prev => ({
                ...prev,
                [npcId]: npcInfo
              }));
              
              // NPC 정보를 메시지에 직접 추가
              data.message.senderName = npcInfo.name;
              if (!data.message.portrait_url) {
                data.message.portrait_url = npcInfo.portrait_url;
              }
              
              console.log(`✅ NPC 정보 로드 완료: ${npcId} → ${npcInfo.name}`);
            } else if (npcId && npcDetails[npcId]) {
              // 이미 캐시된 정보가 있으면 메시지에 직접 추가
              data.message.senderName = npcDetails[npcId].name;
              if (!data.message.portrait_url) {
                data.message.portrait_url = npcDetails[npcId].portrait_url;
              }
              console.log(`✅ 캐시된 NPC 정보 사용: ${npcId} → ${npcDetails[npcId].name}`);
            }
          } catch (e) {
            console.error(`❌ NPC 정보 로드 실패: ${npcId}`, e);
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
          // Mark the message as new for animation
          const isCurrentUserMessage = data.message.isUser && 
            (data.message.sender === username || data.message.sender === storedUsername);
            
          // 자동 대화 메시지인지 확인 (message.id가 auto-로 시작하는지)
          const isAutoMessage = data.message.id.startsWith('auto-');
          console.log('자동 대화 메시지 여부:', isAutoMessage);
          
          const newMessage = {
            ...data.message,
            isNew: true,
            // Ensure user message alignment is correct - check against stored username too
            sender: isCurrentUserMessage ? username : data.message.sender
          };
          
          console.log('📝 최종 메시지 객체:', newMessage);
          console.log(`- 최종 SenderName: ${newMessage.senderName}`);
          console.log(`- 최종 Portrait URL: ${newMessage.portrait_url}`);
          
          return [...prev, newMessage];
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

  // 메시지 전송 함수 수정
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
        timestamp: new Date(),
        isNew: true // Mark new message
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
        
        // 수정된 API 호출: 이제 전체 대화 기록 대신 현재 메시지와 방 ID만 전송
        console.log('📤 새로운 방식으로 API 요청 전송 중...');
        const apiResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-llm-provider': localStorage.getItem('llmProvider') || 'openai',
            'x-llm-model': localStorage.getItem('openaiModel') || 'gpt-4o'
          },
          body: JSON.stringify({
            room_id: chatId,
            user_message: message,
            npcs: participants.npcs,
            llm_provider: localStorage.getItem('llmProvider') || 'openai',
            llm_model: localStorage.getItem('openaiModel') || 'gpt-4o'
          }),
        });
        
        if (!apiResponse.ok) {
          console.error(`❌ API 오류 응답: ${apiResponse.status}`);
          throw new Error(`API 응답 오류: ${apiResponse.status}`);
        }
        
        const aiMessage = await apiResponse.json();
        console.log('🤖 API에서 AI 응답 받음:', aiMessage);
        
        // 유효성 검사
        if (!aiMessage || !aiMessage.response || !aiMessage.philosopher) {
          console.error('❌ 유효하지 않은 AI 응답:', aiMessage);
          throw new Error('Invalid AI response format');
        }
        
        // AI 응답 메시지 생성
        const aiResponseMessage: ChatMessage = {
          id: `api-${Date.now()}`,
          text: aiMessage.response,
          sender: aiMessage.philosopher,
          isUser: false,
          timestamp: new Date(),
          isNew: true
        };
        
        // 메시지 목록에 AI 응답 추가
        setMessages(prev => [...prev, aiResponseMessage]);
        setIsThinking(false);
        
      } catch (error) {
        console.error('🔥 API 호출 오류:', error);
        
        // API 호출 실패 시 폴백 로직
        // ... existing error handling code ...
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

  // Toggle automatic dialogue mode
  const toggleAutoDialogueMode = () => {
    console.log('🤖 자동 대화 토글 함수 호출됨');
    
    if (isAutoDialogueRunning) {
      stopAutoDialogue();
    } else {
      startAutoDialogue();
    }
  };

  // Start automatic dialogue
  const startAutoDialogue = async () => {
    try {
      console.log('🚀 자동 대화 시작 함수 호출됨');
      
      // Remove setLoading(true) to prevent triggering message reload
      // setLoading(true);
      
      // Python API 서버에 직접 요청
      const response = await fetch('http://localhost:8000/api/auto-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          room_id: chatId.toString(),
          npcs: participants.npcs,
          topic: chatTitle,
          delay_range: [15, 30] // 15-30초 간격으로 메시지 생성
        })
      });
      
      const data = await response.json();
      console.log('Python API 응답:', data);
      
      if (response.ok) {
        console.log('✅ 자동 대화 시작 성공');
        // UI 상태 업데이트
        setIsAutoDialogueRunning(true);
        setAutoDialogueMode(true);
      } else {
        console.error('❌ 자동 대화 시작 실패:', data);
        setError(`자동 대화 시작 실패: ${data.message || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('❌ 자동 대화 시작 중 오류 발생:', error);
      setError(`자동 대화 시작 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // setLoading(false); // Remove this to prevent message reloading
    }
  };

  // Stop automatic dialogue
  const stopAutoDialogue = async () => {
    try {
      console.log('🛑 자동 대화 중지 함수 호출됨');
      
      // Remove setLoading(true) to prevent triggering message reload
      // setLoading(true);
      
      // Python API 서버에 직접 요청 - 쿼리 파라미터로 room_id 전달
      const requestUrl = `http://localhost:8000/api/auto-conversation?room_id=${chatId.toString()}`;
      console.log('요청 URL:', requestUrl);
      
      const response = await fetch(requestUrl, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      console.log('Python API 응답:', data);
      
      if (response.ok) {
        console.log('✅ 자동 대화 중지 성공');
        // UI 상태 업데이트
        setIsAutoDialogueRunning(false);
        setAutoDialogueMode(false);
      } else {
        console.error('❌ 자동 대화 중지 실패:', data);
        setError(`자동 대화 중지 실패: ${data.message || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('❌ 자동 대화 중지 중 오류 발생:', error);
      setError(`자동 대화 중지 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // setLoading(false); // Remove this to prevent message reloading
    }
  };

  // 메시지 렌더링 디버깅을 위한 useEffect
  useEffect(() => {
    // 새 메시지가 있을 때마다 실행
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      console.log(`🔍 메시지 렌더링 디버깅 - 마지막 메시지 ID: ${lastMessage.id}`);
      console.log(`- isUser: ${lastMessage.isUser}`);
      console.log(`- sender: ${lastMessage.sender}`);
      console.log(`- senderName: ${lastMessage.senderName}`);
      console.log(`- senderType: ${lastMessage.senderType}`);
      console.log(`- portrait_url: ${lastMessage.portrait_url}`);
      console.log(`- npc_id: ${lastMessage.npc_id}`);
      console.log(`- 자동생성 메시지 여부: ${lastMessage.id.startsWith('auto-')}`);
    }
  }, [messages]);
  
  // 모든 NPC 디테일 로깅
  useEffect(() => {
    console.log('📝 NPC 디테일 전체:', npcDetails);
  }, [npcDetails]);

  // 채팅방 메시지 로드 함수 개선
  const loadLatestMessages = async () => {
    try {
      console.log('🔄 채팅방 메시지 로드 시작');
      setLoading(true);
      setError(null);
      
      // API에서 최근 메시지 가져오기
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/rooms`;
      console.log(`🔗 메시지 로드 URL: ${apiUrl}?id=${chatId}`);
      
      const response = await fetch(`${apiUrl}?id=${chatId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ 메시지 로드 오류: ${response.status} ${errorText}`);
        setError(`메시지를 불러오는 중 오류가 발생했습니다 (${response.status})`);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      console.log(`✅ 메시지 로드 완료: ${data.messages?.length}개 메시지`);
      
      // 메시지 정렬 (오래된 것부터)
      const sortedMessages = data.messages?.sort((a: ChatMessage, b: ChatMessage) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      }) || [];
      
      // NPC ID를 수집하여 미리 상세 정보 로드
      const npcIds = new Set<string>();
      sortedMessages.forEach((msg: ChatMessage) => {
        if (!msg.isUser && msg.sender) {
          npcIds.add(msg.npc_id || msg.sender);
        }
      });
      
      console.log(`🔍 메시지에서 발견된 NPC ID: ${Array.from(npcIds).join(', ')}`);
      
      // NPC 상세 정보 미리 로드 (병렬로 실행)
      const loadNpcDetailsPromises = Array.from(npcIds).map(async (npcId) => {
        try {
          const details = await fetchNpcDetails(npcId);
          console.log(`✅ NPC 정보 미리 로드됨: ${npcId} → ${details.name}`);
          return { id: npcId, details };
        } catch (e) {
          console.error(`❌ NPC 정보 로드 실패: ${npcId}`, e);
          return { id: npcId, details: null };
        }
      });
      
      const loadedNpcDetails = await Promise.all(loadNpcDetailsPromises);
      
      // NPC 정보를 상태에 업데이트
      const newNpcDetails = { ...npcDetails };
      loadedNpcDetails.forEach(item => {
        if (item.details) {
          newNpcDetails[item.id] = item.details;
        }
      });
      
      // 메시지에 NPC 이름과 프로필 URL 직접 추가 (렌더링을 위해)
      const enhancedMessages = sortedMessages.map((msg: ChatMessage) => {
        if (!msg.isUser && (msg.npc_id || msg.sender)) {
          const npcId = msg.npc_id || msg.sender;
          const npcDetail = newNpcDetails[npcId];
          
          if (npcDetail) {
            return {
              ...msg,
              senderName: npcDetail.name || msg.senderName,
              portrait_url: msg.portrait_url || npcDetail.portrait_url
            };
          }
        }
        return msg;
      });
      
      console.log('🔄 강화된 메시지 설정 중...');
      setMessages(enhancedMessages);
      setNpcDetails(newNpcDetails);
      setIsLoaded(true);
      
      // 스크롤을 마지막 메시지로 이동
      setTimeout(() => {
        if (endOfMessagesRef.current) {
          endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (error) {
      console.error('❌ 메시지 로드 중 예외 발생:', error);
      setError('메시지를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // fetchNpcDetails 함수 추가 - NPC 정보를 가져오는 유틸리티 함수
  const fetchNpcDetails = async (npcId: string): Promise<NpcDetail> => {
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/npc/get?id=${npcId}`;
    console.log(`🔍 NPC 정보 조회 중: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`NPC 정보 조회 실패: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  };

  // NPC 정보 변경 시 메시지 업데이트를 위한 useEffect 추가
  useEffect(() => {
    if (isLoaded && messages.length > 0) {
      console.log('🔄 NPC 정보 변경으로 메시지 업데이트');
      
      // 메시지에 최신 NPC 정보 반영
      setMessages(prev => prev.map(msg => {
        if (!msg.isUser && (msg.npc_id || msg.sender)) {
          const npcId = msg.npc_id || msg.sender;
          const npcDetail = npcDetails[npcId];
          
          if (npcDetail) {
            return {
              ...msg,
              senderName: npcDetail.name || msg.senderName,
              portrait_url: msg.portrait_url || npcDetail.portrait_url
            };
          }
        }
        return msg;
      }));
    }
  }, [npcDetails, isLoaded]);

  // 메시지 스타일 모든 메시지에 NPC 이름 표시를 위한 코드
  const getMessageStyle = (msg: ChatMessage) => {
    // 현재 사용자의 메시지인지 확인
    const isCurrentUserMessage = msg.isUser && 
      (msg.sender === username || msg.sender === sessionStorage.getItem('chat_username'));
    
    let style = "chat-message-bubble ";
    
    // 메시지 발신자에 따라 스타일 적용
    if (isCurrentUserMessage) {
      style += "chat-message-bubble-mine";
    } else if (msg.isUser) {
      style += "chat-message-bubble-other-user";
    } else {
      style += "chat-message-bubble-npc";
    }
    
    return style;
  };

  // 메시지 발신자 이름 표시 함수 개선
  const getMessageSenderName = (msg: ChatMessage) => {
    // 사용자 메시지인 경우
    if (msg.isUser) {
      return msg.sender === username || msg.sender === sessionStorage.getItem('chat_username') 
        ? 'You' 
        : msg.sender;
    }
    
    // NPC 메시지인 경우 - senderName이 있으면 사용, 없으면 getNpcDisplayName 활용
    const npcId = msg.npc_id || msg.sender;
    return msg.senderName || getNpcDisplayName(npcId);
  };

  // NPC 상세 정보를 로드하는 함수 추가
  const loadNpcDetails = async () => {
    try {
      // 참여 중인 NPC들의 정보를 가져옴
      const details: Record<string, NpcDetail> = {};
      
      for (const npcId of participants.npcs) {
        try {
          const response = await fetch(`/api/npc/get?id=${encodeURIComponent(npcId)}`);
          if (response.ok) {
            const npcDetail = await response.json();
            details[npcId] = npcDetail;
            console.log(`✅ Loaded NPC details for ${npcId}:`, npcDetail.name);
          } else {
            console.error(`❌ Failed to load NPC details for ${npcId}`);
          }
        } catch (error) {
          console.error(`❌ Error loading NPC details for ${npcId}:`, error);
        }
      }
      
      setNpcDetails(details);
    } catch (error) {
      console.error('❌ Error loading NPC details:', error);
    }
  };

  // 컴포넌트 마운트 시 NPC 상세 정보 로드
  useEffect(() => {
    loadNpcDetails();
  }, [participants.npcs]);

  // 기본 아바타 URL 생성 함수 추가
  const getDefaultAvatar = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128&font-size=0.5`;
  };

  // NPC 실제 이름 가져오기 함수 수정
  const getNpcDisplayName = (npcId: string) => {
    console.log(`📝 getNpcDisplayName 호출: ${npcId}`);
    
    // 메시지에 senderName이 직접 포함된 경우 (자동 대화 메시지)
    if (typeof npcId === 'object' && (npcId as any).senderName) {
      console.log(`🔍 object에서 senderName 사용: ${(npcId as any).senderName}`);
      return (npcId as any).senderName;
    }
    
    // 상세 정보에서 실제 이름 찾기
    if (npcDetails[npcId]) {
      console.log(`🔍 npcDetails에서 이름 찾음: ${npcDetails[npcId].name}`);
      return npcDetails[npcId].name;
    }
    // 없으면 ID 그대로 반환
    console.log(`🔍 이름 정보 없음, ID 반환: ${npcId}`);
    return npcId;
  };

  // NPC 프로필 이미지 URL 가져오기 함수 수정
  const getNpcProfileImage = (npcId: string) => {
    console.log(`📝 getNpcProfileImage 호출: ${npcId}`);
    
    // 메시지에 portrait_url이 직접 포함된 경우 (자동 대화 메시지)
    if (typeof npcId === 'object' && (npcId as any).portrait_url) {
      console.log(`🔍 object에서 portrait_url 사용: ${(npcId as any).portrait_url}`);
      return (npcId as any).portrait_url;
    }
    
    // 상세 정보에서 프로필 이미지 URL 찾기
    if (npcDetails[npcId] && npcDetails[npcId].portrait_url) {
      console.log(`🔍 npcDetails에서 프로필 이미지 찾음: ${npcDetails[npcId].portrait_url}`);
      return npcDetails[npcId].portrait_url;
    }
    // 없으면 기본 아바타 생성
    const displayName = getNpcDisplayName(npcId);
    console.log(`🔍 프로필 이미지 없음, 기본 아바타 사용: ${displayName}`);
    return getDefaultAvatar(displayName);
  };

  // Add CSS for chat bubbles - ensure consistent rounded corners
  useEffect(() => {
    // Add styles for chat bubbles
    const style = document.createElement('style');
    style.textContent = `
      .chat-message-bubble {
        padding: 12px 16px;
        border-radius: 14px;
        position: relative;
        max-width: 100%;
        word-wrap: break-word;
        margin-bottom: 4px;
      }
      
      .chat-message-bubble-mine {
        background-color: #e2e8f0;
        color: #1e293b;
        border-radius: 14px;
      }
      
      .chat-message-bubble-other-user {
        background-color: #3b82f6;
        color: white;
        border-radius: 14px;
      }
      
      .chat-message-bubble-npc {
        background-color: #10b981;
        color: white;
        border-radius: 14px;
      }
      
      .chat-message-time {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.7);
        margin-top: 4px;
        text-align: right;
      }
      
      .chat-message-bubble-mine .chat-message-time {
        color: rgba(0, 0, 0, 0.5);
      }
    `;
    document.head.appendChild(style);
    
    // Cleanup when component unmounts
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-white flex flex-col w-full h-full overflow-hidden">
      {/* Chat header */}
      <div className="bg-white border-b border-gray-200 p-3 flex flex-col items-center relative">
        {/* Back button - using same styling approach as Create Chat modal X button */}
        <button 
          onClick={handleBackButtonClick}
          style={{ 
            position: 'absolute', 
            left: '16px', 
            top: '16px', 
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: '18px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: '#f3f4f6'
          }}
          className="text-gray-500 hover:text-gray-800 flex items-center justify-center"
        >
          <ArrowLeftIcon className="h-4 w-4 text-gray-700" />
        </button>

        {/* Centered chat title and participants */}
        <div className="text-center mx-auto">
          <h2 className="font-semibold text-gray-900">{chatTitle}</h2>
          <p className="text-xs text-gray-500 mt-1">
            with {participants.npcs.map(npcId => getNpcDisplayName(npcId)).join(', ')}
          </p>
        </div>
        
        {/* 오른쪽 영역에 자동 대화 버튼 및 연결 상태 표시 */}
        <div 
          style={{ 
            position: 'absolute', 
            right: '16px', 
            top: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {/* 자동 대화 버튼 */}
          <button
            onClick={toggleAutoDialogueMode}
            className={`px-3 py-1 text-xs ${
              isAutoDialogueRunning
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-green-600 hover:bg-green-700'
            } text-white rounded-full shadow-sm transition-colors`}
          >
            {isAutoDialogueRunning ? 'Stop Auto' : 'Start Auto'}
          </button>
          
          {/* 연결 상태 표시 (점만) */}
          <div className={`w-2.5 h-2.5 rounded-full ${isSocketConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          
          {!isSocketConnected && (
            <button 
              onClick={handleReconnect}
              className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              Reconnect
            </button>
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
            padding: '1rem 0 1rem 0',  // 좌측 패딩 0, 우측도 0으로 설정
            paddingRight: '16px'  // 우측에만 별도로 16px 패딩 추가
          }}
        >
          <div className="max-w-2xl mx-auto space-y-2 pb-4 px-3">  
            {/* User and NPC messages */}
            {processedMessages
              .filter((msg) => msg.sender !== 'System') // Filter out system messages entirely
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
                    // 현재 사용자(나)의 메시지만 오른쪽에 표시 - check against stored username too
                    (msg.isUser && (msg.sender === username || msg.sender === sessionStorage.getItem('chat_username'))) 
                      ? 'justify-end' 
                      : 'justify-start'
                  } mb-3`}>
                    {/* 프로필 아바타 - 내 메시지가 아닐 때만 표시 */}
                    {((!msg.isUser || (msg.sender !== username && msg.sender !== sessionStorage.getItem('chat_username')))) && (
                      <div className="flex-shrink-0 mr-2">
                        <div className="w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] overflow-hidden rounded-full">
                          {/* 디버깅 로그는 JSX에서 제거하고 useEffect에서 처리함 */}
                          <img 
                            src={msg.isUser 
                                ? getDefaultAvatar(msg.sender) 
                                : (msg.portrait_url || getNpcProfileImage(msg.npc_id || msg.sender))
                            } 
                            alt={msg.sender}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = getDefaultAvatar(msg.sender);
                            }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="flex flex-col" style={{ maxWidth: '70%', width: 'auto' }}>
                      {/* Sender name - 메시지를 보낸 사람의 이름 표시 (내 메시지 제외) */}
                      {((msg.sender !== username && msg.sender !== sessionStorage.getItem('chat_username')) || !msg.isUser) && 
                        (index === 0 || filteredList[index-1].sender !== msg.sender) && (
                        <span className="text-xs font-medium text-gray-600 ml-2 mb-1">
                          {msg.isUser 
                            ? msg.sender 
                            : (msg.senderName || getNpcDisplayName(msg.npc_id || msg.sender))
                          }
                        </span>
                      )}
                      
                      {/* 간소화된 말풍선 UI - CSS 클래스 사용 */}
                      <div className={`${getMessageStyle(msg)}`}>
                        {/* Message text - with typing animation for NEW NPC messages only */}
                        <div>
                          <p className="break-words whitespace-pre-wrap overflow-hidden text-wrap">
                            {(() => {
                              // Parse JSON if needed
                              let text = msg.text;
                              try {
                                if (msg.text.trim().startsWith('{') && msg.text.trim().endsWith('}')) {
                                  const parsed = JSON.parse(msg.text);
                                  text = parsed.text || msg.text;
                                }
                              } catch (e) {
                                // Keep original text
                              }
                              
                              // Use typing animation ONLY for NEW NPC messages, regular text for all others
                              return msg.isUser || !msg.isNew ? 
                                text : 
                                <TypingAnimation text={text} />
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
            
            <div ref={endOfMessagesRef} className="h-3" />
          </div>
        </div>
      )}
      
      {/* Message input */}
      <div className="bg-white border-t border-gray-200 p-3 w-full" style={{ paddingBottom: '16px' }}>  
        <form 
          onSubmit={(e) => { 
            console.log('📝 Form submit event triggered');
            e.preventDefault(); // Ensure we prevent the default form submission 
            handleSendMessage(e); 
          }} 
          style={{
            maxWidth: '95%',
            margin: '0 auto',
            padding: '0 8px'
          }}
        >
          <div 
            style={{
              position: 'relative',
              width: '95%', 
              backgroundColor: '#f8f8f8',
              borderRadius: '24px',
              padding: '8px 16px',
              marginTop: '8px',
              display: 'flex',
              alignItems: 'flex-end',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
              zIndex: 10
            }}
          >
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message (Press Enter to send)"
              style={{
                flexGrow: 1,
                minHeight: '36px',
                maxHeight: '120px',
                background: 'transparent',
                border: 'none',
                resize: 'none',
                padding: '8px 0',
                outline: 'none',
                fontSize: '14px',
                lineHeight: 1.5
              }}
              disabled={isThinking || isSending}
              rows={1}
            />
            <button 
              type="submit" 
              style={{
                flexShrink: 0,
                backgroundColor: message.trim() === '' || isThinking || isSending ? '#e0e0e0' : '#0084ff',
                color: message.trim() === '' || isThinking || isSending ? '#a0a0a0' : 'white',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '8px',
                transition: 'all 0.2s',
                border: 'none',
                cursor: message.trim() === '' || isThinking || isSending ? 'not-allowed' : 'pointer',
                opacity: message.trim() === '' || isThinking || isSending ? 0.5 : 1
              }}
              disabled={message.trim() === '' || isThinking || isSending}
              onClick={(e) => {
                console.log('🚀 Send button clicked');
                // Don't call handleSendMessage here - the form's onSubmit will handle it
              }}
            >
              {isSending ? (
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
              ) : (
                <PaperAirplaneIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatUI; 