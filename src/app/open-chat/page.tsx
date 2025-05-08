'use client';

/**
 * UI Improvements:
 * 1. Changed the participants indicator to show a user icon with the count in a button with gray background and black border
 * 2. Limited the width of the search bar to prevent overflow using max-w-2xl class
 * 3. Replaced the text "Refresh" button with an icon-only button using ArrowPathIcon
 */

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserIcon, PlusIcon, XMarkIcon, InformationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import chatService, { ChatRoom, ChatRoomCreationParams } from '@/lib/ai/chatService';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';

// Declare global window properties for TypeScript
declare global {
  interface Window {
    _debug?: {
      getSocket: () => Socket | null;
      socketConnected: boolean;
      getActiveChats: () => ChatRoom[];
      reloadRooms: () => Promise<void>;
      roomsCount: number;
      forceReconnect: () => void;
    };
    _socketDebug?: {
      socketId?: string;
      connected?: boolean;
      url?: string;
      error?: string;
      disconnectReason?: string;
    };
  }
}

// Philosopher 타입 정의 추가
interface Philosopher {
  id: string;
  name: string;
  period?: string; 
  nationality?: string;
  description?: string;
  key_concepts?: string[];
  portrait_url?: string;
}

export default function OpenChatPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showParticipants, setShowParticipants] = useState<number | null>(null);
  const [showCreateChatModal, setShowCreateChatModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChats, setActiveChats] = useState<ChatRoom[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'recent' | 'popular'>('all');
  const [chatToJoin, setChatToJoin] = useState<ChatRoom | null>(null);
  
  // Create chat form state
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newChatContext, setNewChatContext] = useState('');
  const [contextUrl, setContextUrl] = useState('');
  const [contextFile, setContextFile] = useState<File | null>(null);
  const [contextFileContent, setContextFileContent] = useState('');
  const [activeContextTab, setActiveContextTab] = useState<'text' | 'url' | 'file'>('text');
  const [maxParticipants, setMaxParticipants] = useState(5);
  const [selectedNPCs, setSelectedNPCs] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  
  // 철학자 정보 관련 state 추가
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [customNpcs, setCustomNpcs] = useState<Philosopher[]>([]);
  const [selectedPhilosopherDetails, setSelectedPhilosopherDetails] = useState<Philosopher | null>(null);
  const [showPhilosopherDetails, setShowPhilosopherDetails] = useState(false);
  
  // 찬반토론을 위한 NPC 입장 저장
  const [npcPositions, setNpcPositions] = useState<Record<string, 'pro' | 'con'>>({});
  
  const [dialogueType, setDialogueType] = useState<string>('free');
  
  // 채팅룸 목록 로드 함수
  const loadChatRooms = async () => {
    try {
      setIsLoading(true);
      const rooms = await chatService.getChatRooms();
      
      // 중복 ID 처리 (동일한 ID가 있는 경우 최신 버전 유지)
      const uniqueRooms: { [key: string]: ChatRoom } = {};
      rooms.forEach(room => {
        uniqueRooms[String(room.id)] = room;
      });
      
      // 고유한 채팅방 배열로 변환
      setActiveChats(Object.values(uniqueRooms));
    } catch (error) {
      console.error('Failed to load chat rooms:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 소켓 초기화 함수
  const initializeSocket = async () => {
    try {
      // 1. 서버 소켓 핸들러 초기화
      console.log('Initializing Socket.IO server...');
      const res = await fetch('/api/socket');
      if (!res.ok) {
        throw new Error(`Failed to initialize socket server: ${res.status}`);
      }
      console.log('✅ Socket server initialized');
      
      // 2. Socket.IO 클라이언트 연결 설정 (아직 연결은 하지 않음)
      socketRef.current = io('/', {
        path: '/api/socket/io',
        autoConnect: false, // 수동으로 연결할 것임
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      
      // 3. 이벤트 리스너 먼저 등록 (중요: 연결 전에 리스너 등록)
      const socket = socketRef.current;
      
      // 연결 상태 이벤트
      socket.on('connect', () => {
        console.log('✅ Socket.IO connected!');
        setSocketConnected(true);
      });
      
      socket.on('disconnect', () => {
        console.log('Socket.IO disconnected');
        setSocketConnected(false);
      });
      
      socket.on('connect_error', (err) => {
        console.error('Socket.IO connection error:', err);
        setSocketConnected(false);
      });
      
      // room-created 이벤트 리스너
      socket.on('room-created', (newRoom: ChatRoom) => {
        console.log('🔔 New chat room created:', newRoom.title);
        
        // 새 방을 활성 채팅룸 목록에 추가 (중복 방지)
        setActiveChats(prev => {
          // 이미 같은 ID의 방이 있는지 확인
          const exists = prev.some(room => String(room.id) === String(newRoom.id));
          if (exists) {
            console.log('Room already exists in state, not adding duplicate');
            // ID가 같은 방이 있으면 해당 방만 업데이트
            return prev.map(room => 
              String(room.id) === String(newRoom.id) ? newRoom : room
            );
          }
          
          console.log('Adding new room to state:', newRoom.title);
          // 새 방을 목록 맨 위에 추가
          return [newRoom, ...prev];
        });
      });
      
      // 4. 이제 리스너 등록 완료 후 연결 시작
      socket.connect();
      console.log('Socket connect() called');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize socket:', error);
      return false;
    }
  };
  
  // 컴포넌트 마운트 시 소켓 초기화 및 채팅룸 로드
  useEffect(() => {
    // 초기화 순서 보장: 소켓 먼저 초기화 후 데이터 로드
    const init = async () => {
      // 1. 소켓 초기화
      await initializeSocket();
      
      // 2. 채팅룸 데이터 로드
      await loadChatRooms();

      // 3. 디버깅용: 전역 창에 소켓 참조 노출
      if (typeof window !== 'undefined') {
        console.log('🔄 소켓 디버깅 변수 설정');
        // @ts-ignore
        window._debug = {
          getSocket: () => socketRef.current,
          socketConnected,
          getActiveChats: () => activeChats,
          reloadRooms: loadChatRooms,
          roomsCount: activeChats.length,
          // 새 디버깅 함수 추가
          forceReconnect: () => {
            if (socketRef.current) {
              console.log("수동으로 소켓 재연결 시도");
              socketRef.current.disconnect();
              setTimeout(() => {
                socketRef.current?.connect();
              }, 500);
            } else {
              console.log("소켓 참조가 없습니다. 초기화 부터 다시 시도합니다.");
              initializeSocket();
            }
          }
        };
        console.log('🔍 디버깅: window._debug로 소켓 상태를 확인할 수 있습니다');
        console.log('🔍 사용 예: window._debug.socketConnected');
        console.log('🔍 채팅룸 새로고침: window._debug.reloadRooms()');
        console.log('🔍 소켓 재연결: window._debug.forceReconnect()');
        
        // 소켓 디버깅 정보도 함께 체크
        // @ts-ignore
        if (window._socketDebug) {
          console.log('Socket.IO 디버깅 정보:', window._socketDebug);
          // 소켓 연결 상태 동기화
          // @ts-ignore
          if (window._socketDebug.connected !== undefined) {
            setSocketConnected(window._socketDebug.connected);
          }
        }
      }
    };
    
    init();
    
    // 컴포넌트 언마운트 시 소켓 연결 해제
    return () => {
      if (socketRef.current) {
        console.log('Disconnecting socket');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);
  
  // 소켓 연결 상태가 변경될 때마다 디버깅 변수 업데이트
  useEffect(() => {
    if (typeof window !== 'undefined' && window._debug) {
      // @ts-ignore
      window._debug.socketConnected = socketConnected;
    }
    
    // 소켓이 연결되면 채팅룸 목록을 새로고침 (최초 1회만)
    if (socketConnected && !isLoading && activeChats.length === 0) {
      console.log('🔄 소켓 연결됨 - 최초 채팅룸 목록 로드');
      loadChatRooms();
    }
  }, [socketConnected, isLoading, activeChats.length]);
  
  // 소켓 디버그 정보가 변경될 때 소켓 연결 상태 업데이트 (주기 10초로 증가)
  useEffect(() => {
    const checkSocketDebug = () => {
      // @ts-ignore
      if (typeof window !== 'undefined' && window._socketDebug) {
        // @ts-ignore
        const connected = window._socketDebug.connected;
        if (connected !== undefined && connected !== socketConnected) {
          console.log('소켓 디버그 정보에서 연결 상태 업데이트:', connected);
          setSocketConnected(connected);
        }
      }
    };
    
    // 주기적으로 소켓 디버그 정보 확인 (10초마다)
    const intervalId = setInterval(checkSocketDebug, 10000);
    
    // 초기 체크
    checkSocketDebug();
    
    return () => clearInterval(intervalId);
  }, [socketConnected]);
  
  // 채팅룸 목록 업데이트를 위한 폴링 설정 (1분마다)
  useEffect(() => {
    // 1분마다 채팅룸 목록 갱신
    const intervalId = setInterval(() => {
      if (socketConnected && !isLoading && !showCreateChatModal) {
        // 콘솔 로그 제거
        loadChatRooms();
      }
    }, 60000); // 1분마다
    
    return () => clearInterval(intervalId);
  }, [socketConnected, isLoading, showCreateChatModal]);
  
  // 채팅룸 목록이 변경될 때마다 디버깅 변수 업데이트
  useEffect(() => {
    if (typeof window !== 'undefined' && window._debug) {
      // @ts-ignore
      window._debug.roomsCount = activeChats.length;
    }
  }, [activeChats]);
  
  // 모달 상태에 따라 body 클래스를 관리하는 useEffect 추가
  useEffect(() => {
    if (showCreateChatModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showCreateChatModal]);
  
  // Sample available NPCs
  const availableNPCs = [
    'Socrates', 'Plato', 'Aristotle', 'Kant', 'Nietzsche', 
    'Sartre', 'Camus', 'Simone de Beauvoir', 'Marx', 'Rousseau',
    'Heidegger', 'Wittgenstein', 'Confucius', 'Lao Tzu', 'Buddha'
  ];
  
  // Filter chats based on search query and active tab
  const filteredChats = activeChats
    .filter(chat => {
      // First apply search query filter
      const matchesSearch = 
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        [...chat.participants.users, ...chat.participants.npcs].some(
          p => p.toLowerCase().includes(searchQuery.toLowerCase())
        );
      
      if (!matchesSearch) return false;
      
      // Then apply tab filter
      switch (activeTab) {
        case 'all':
          return true;
        case 'active':
          // Assuming we have active participants or recent activity
          const oneDayAgo = new Date();
          oneDayAgo.setDate(oneDayAgo.getDate() - 1);
          return new Date(chat.lastActivity) > oneDayAgo;
        case 'recent':
          // Sort by creation date or last activity
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          return new Date(chat.lastActivity) > oneWeekAgo;
        case 'popular':
          // Sort by number of participants
          return chat.totalParticipants >= 3;
        default:
          return true;
      }
    });

  // Toggle NPC selection
  const toggleNPC = (npc: string) => {
    if (selectedNPCs.includes(npc)) {
      setSelectedNPCs(selectedNPCs.filter(n => n !== npc));
      
      // 찬반토론 모드에서는 입장 정보도 제거
      if (dialogueType === 'debate') {
        const updatedPositions = { ...npcPositions };
        delete updatedPositions[npc];
        setNpcPositions(updatedPositions);
      }
    } else {
      setSelectedNPCs([...selectedNPCs, npc]);
      
      // 찬반토론 모드에서는 기본 입장 설정 (기본: 균형 맞추기)
      if (dialogueType === 'debate') {
        const proCount = Object.values(npcPositions).filter(p => p === 'pro').length;
        const conCount = Object.values(npcPositions).filter(p => p === 'con').length;
        
        // 더 적은 쪽에 할당
        const defaultPosition = proCount <= conCount ? 'pro' : 'con';
        setNpcPositions({
          ...npcPositions,
          [npc]: defaultPosition
        });
      }
    }
  };

  // 철학자의 찬성/반대 입장 설정
  const setNpcPosition = (npcId: string, position: 'pro' | 'con') => {
    if (selectedNPCs.includes(npcId)) {
      setNpcPositions({
        ...npcPositions,
        [npcId]: position
      });
    }
  };

  // 채팅방 생성 핸들러 개선
  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isCreating) return;
    setIsCreating(true);
    
    try {
      // Generate initial message if no context is provided
      const shouldGenerateInitialMessage = 
        (activeContextTab === 'text' && !newChatContext.trim()) ||
        (activeContextTab === 'url' && !contextUrl.trim()) ||
        (activeContextTab === 'file' && !contextFileContent);
      
      let contextToUse = '';
      
      if (activeContextTab === 'text') {
        contextToUse = newChatContext.trim();
      } else if (activeContextTab === 'url') {
        // URL 컨텍스트의 경우 URL 자체를 사용 (URL 내용 추출은 서버에서 처리)
        contextToUse = contextUrl.trim();
      } else if (activeContextTab === 'file') {
        contextToUse = contextFileContent.trim();
      }
      
      // Need at least one NPC selected
      if (selectedNPCs.length === 0) {
        toast.error('Please select at least one philosopher');
        setIsCreating(false);
        return;
      }
      
      // 찬반토론 모드일 때는 최소 양쪽에 한 명 이상 필요
      if (dialogueType === 'debate') {
        const hasProNpc = selectedNPCs.some(npc => npcPositions[npc] === 'pro');
        const hasConNpc = selectedNPCs.some(npc => npcPositions[npc] === 'con');
        
        if (!hasProNpc || !hasConNpc) {
          toast.error('Pro-Con debate requires at least one philosopher on each side');
          setIsCreating(false);
          return;
        }
      }
      
      // Chat parameters
      const chatParams: ChatRoomCreationParams = {
        title: newChatTitle,
        maxParticipants: 10,
        npcs: selectedNPCs,
        isPublic: true,
        generateInitialMessage: shouldGenerateInitialMessage,
        dialogueType
      };
      
      // 찬반토론 모드일 때 npcPositions 정보 추가
      if (dialogueType === 'debate') {
        chatParams.npcPositions = npcPositions;
      }
      
      // 컨텍스트 관련 파라미터 추가
      if (contextToUse) {
        chatParams.context = contextToUse;
      }
      
      if (activeContextTab === 'url' && contextUrl) {
        chatParams.contextUrl = contextUrl;
      }
      
      if (activeContextTab === 'file' && contextFileContent) {
        chatParams.contextFileContent = contextFileContent;
      }
      
      // Create chat room
      let newChat: ChatRoom;
      try {
          newChat = await chatService.createChatRoom(chatParams);
        console.log('채팅방 생성 성공:', newChat);
        
        // Redirect to the new chat
        router.push(`/chat/${newChat.id}`);
        
        // Reset form and close modal
      resetForm();
      setShowCreateChatModal(false);
    } catch (error) {
        console.error('채팅방 생성 실패:', error);
        toast.error('Failed to create chat room. Please try again.');
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      toast.error('An error occurred while creating the chat room');
    } finally {
      setIsCreating(false);
    }
  };

  // 폼 리셋 함수 추가
  const resetForm = () => {
    setNewChatTitle('');
    setNewChatContext('');
    setSelectedNPCs([]);
    setContextUrl('');
    setContextFile(null);
    setContextFileContent('');
    setActiveContextTab('text');
    setDialogueType('free');
    setNpcPositions({});
  };

  // Handle joining a chat
  const handleJoinChat = (chatId: string | number) => {
    console.log('Joining chat with ID:', chatId, typeof chatId);
    // Navigate to the chat page
    router.push(`/chat?id=${chatId}`);
  };

  // Create New Chat 모달 닫기 핸들러에 철학자 정보 모달 닫기도 추가
  const handleCloseCreateChatModal = () => {
    setShowCreateChatModal(false);
    setShowPhilosopherDetails(false);
  };

  // 소켓 연결 상태 표시기를 렌더링
  const renderSocketStatus = () => {
    if (!socketConnected) {
      return (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-1 text-center text-sm z-50">
          Socket disconnected. Real-time updates may not work.
          <button 
            onClick={() => initializeSocket()} 
            className="ml-2 px-2 py-0.5 bg-white text-red-500 rounded text-xs font-bold"
          >
            Reconnect
          </button>
        </div>
      );
    }
    return null;
  };

  // URL에서 컨텍스트 가져오기
  const fetchContextFromUrl = async () => {
    if (!contextUrl.trim()) return;
    
    try {
      setIsLoadingContext(true);
      
      // API 엔드포인트를 통해 URL 내용 가져오기
      const response = await fetch('/api/context/fetch-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: contextUrl })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch context: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 가져온 컨텍스트를 텍스트 영역에 설정
      if (data.content) {
        setNewChatContext(data.content);
        setActiveContextTab('text'); // 텍스트 탭으로 전환
      }
    } catch (error) {
      console.error('Error fetching context from URL:', error);
      alert('Failed to load context from the URL. Please check the URL or try a different source.');
    } finally {
      setIsLoadingContext(false);
    }
  };
  
  // 파일 업로드 처리
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 지원되는 파일 형식 확인 (txt, pdf, docx 등)
    const supportedTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    if (!supportedTypes.includes(file.type)) {
      alert('Only txt, pdf, and docx files are supported.');
      return;
    }
    
    setContextFile(file);
    
    // 파일 내용 읽기
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const content = event.target?.result;
      
      if (typeof content === 'string') {
        // 텍스트 파일인 경우 직접 설정
        setContextFileContent(content);
      } else if (file.type === 'application/pdf' || file.type.includes('docx')) {
        // PDF나 DOCX는 서버 측 처리 필요
        try {
          setIsLoadingContext(true);
          
          // FormData 생성
          const formData = new FormData();
          formData.append('file', file);
          
          // 파일 내용 추출 API 호출
          const response = await fetch('/api/context/extract-file', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            throw new Error(`Failed to extract file content: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.content) {
            setContextFileContent(data.content);
          }
        } catch (error) {
          console.error('Error extracting file content:', error);
          alert('Failed to extract content from the file. Please try a different file.');
        } finally {
          setIsLoadingContext(false);
        }
      }
    };
    
    reader.onerror = () => {
      console.error('Error reading file');
      alert('Error reading file. Please try again or use a different file.');
    };
    
    if (file.type === 'text/plain') {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  // 기본 철학자 목록 로드 함수 추가
  const fetchPhilosophers = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/philosophers');
      if (response.ok) {
        const data = await response.json();
        setPhilosophers(data.philosophers || []);
      } else {
        console.error('Failed to fetch philosophers');
      }
    } catch (error) {
      console.error('Error fetching philosophers:', error);
      // 기본 철학자 목록으로 대체
      setPhilosophers(availableNPCs.map(name => ({ id: name.toLowerCase(), name })));
    }
  };

  // 사용자 커스텀 NPC 목록 로드 함수 추가
  const fetchCustomNpcs = async () => {
    try {
      const response = await fetch('/api/npc/list');
      if (response.ok) {
        const data = await response.json();
        setCustomNpcs(data.npcs || []);
      } else {
        console.error('Failed to fetch custom NPCs');
      }
    } catch (error) {
      console.error('Error fetching custom NPCs:', error);
      setCustomNpcs([]);
    }
  };

  // 컴포넌트 마운트 시 철학자 목록과 커스텀 NPC 목록 로드
  useEffect(() => {
    fetchPhilosophers();
    fetchCustomNpcs();
  }, []);

  // 철학자 정보 로드 함수 (기본 철학자와 커스텀 NPC 모두 처리)
  const loadPhilosopherDetails = async (philosopherId: string) => {
    try {
      // 먼저 커스텀 NPC에서 찾기
      const customNpc = customNpcs.find(p => p.id.toLowerCase() === philosopherId.toLowerCase());
      if (customNpc) {
        setSelectedPhilosopherDetails(customNpc);
        setShowPhilosopherDetails(true);
        return;
      }
      
      // 이미 로드한 기본 철학자 정보가 있다면 재활용
      const existingPhil = philosophers.find(p => p.id.toLowerCase() === philosopherId.toLowerCase());
      if (existingPhil && existingPhil.description) {
        setSelectedPhilosopherDetails(existingPhil);
        setShowPhilosopherDetails(true);
        return;
      }
      
      // API 호출로 상세정보 가져오기
      const response = await fetch(`http://localhost:8000/api/philosophers/${philosopherId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedPhilosopherDetails(data);
        setShowPhilosopherDetails(true);
      } else {
        console.error(`Failed to fetch details for philosopher: ${philosopherId}`);
      }
    } catch (error) {
      console.error('Error fetching philosopher details:', error);
    }
  };

  // 철학자 세부 정보 모달 컴포넌트
  const PhilosopherDetailsModal = () => {
    if (!selectedPhilosopherDetails) return null;
    
    // 기본 아바타 생성 함수
    const getDefaultAvatar = () => {
      const name = selectedPhilosopherDetails.name || 'Philosopher';
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128&font-size=0.5`;
    };

    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-30 z-[9999] transition-opacity opacity-100 pointer-events-auto flex items-center justify-center"
        onClick={() => setShowPhilosopherDetails(false)}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
      >
        <div 
          className="fixed bg-white rounded-2xl w-full max-h-[80vh] overflow-y-auto z-[10000]"
          onClick={e => e.stopPropagation()}
          style={{ 
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white', 
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '-10px 0 20px -5px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.2)',
            width: '90%',
            maxWidth: '500px'
          }}
        >
          <div className="flex justify-end">
            <button 
              className="text-gray-500 hover:text-gray-800 absolute top-3 right-3 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200" 
              onClick={() => setShowPhilosopherDetails(false)}
              style={{ 
                fontSize: '16px', 
                fontWeight: 'bold',
                border: 'none', 
                transition: 'all 0.2s',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                position: 'absolute',
                right: '12px',
                left: 'auto'
              }}
            >
              ✕
            </button>
          </div>
          
          <div className="flex items-center mb-4 mt-2">
            <div className="mr-10 flex-shrink-0">
              <img
                src={selectedPhilosopherDetails.portrait_url ?? getDefaultAvatar()}
                alt={selectedPhilosopherDetails.name || 'Philosopher'}
                width={144}
                height={144}
                style={{ objectFit: 'cover', objectPosition: 'top center', borderRadius: '50%' }}
                onError={(e) => {
                  // 이미지 로드 실패 시 기본 아바타로 대체
                  (e.target as HTMLImageElement).src = getDefaultAvatar();
                }}
              />
            </div>
            <div>
              <h3 className="text-4xl font-bold" style={{ color: 'black' }}>{selectedPhilosopherDetails.name}</h3>
              <div className="text-sm text-gray-500">
                {selectedPhilosopherDetails.period && <div>{selectedPhilosopherDetails.nationality} • {selectedPhilosopherDetails.period}</div>}
              </div>
            </div>
          </div>
          
          {selectedPhilosopherDetails.description && (
            <div 
              className="mt-3 text-gray-700 text-sm"
              style={{ color: '#374151', lineHeight: '1.5' }}
            >
              {selectedPhilosopherDetails.description}
            </div>
          )}
          
          {selectedPhilosopherDetails.key_concepts && selectedPhilosopherDetails.key_concepts.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2 text-sm" style={{ color: '#111827' }}>Key Concepts</h4>
              <div className="flex flex-wrap gap-1">
                {selectedPhilosopherDetails.key_concepts.map((concept, index) => (
                  <span 
                    key={index} 
                    className="bg-gray-100 px-2 py-1 rounded-full text-xs"
                    style={{ backgroundColor: '#f3f4f6', borderRadius: '9999px', padding: '4px 8px' }}
                  >
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-5 flex justify-end">
            <button 
              className="px-3 py-1.5 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition text-sm"
              style={{ 
                backgroundColor: '#1f2937', 
                color: 'white', 
                borderRadius: '9999px', 
                padding: '6px 12px',
                transition: 'all 0.2s'
              }}
              onClick={() => {
                toggleNPC(selectedPhilosopherDetails.id);
                setShowPhilosopherDetails(false);
              }}
            >
              {selectedNPCs.includes(selectedPhilosopherDetails.id) 
                ? 'Remove from Chat' 
                : 'Add to Chat'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Create New Chat 버튼 클릭 핸들러
  const handleCreateChatClick = () => {
    setShowCreateChatModal(true);
  };

  return (
    <>
      {renderSocketStatus()}
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Open Philosophical Dialogues</h1>
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${socketConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div style={{ position: 'relative' }}>
              <button 
                onClick={handleCreateChatClick}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'black',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  transition: 'transform 0.2s ease, background-color 0.2s ease'
                }}
                onMouseOver={(e) => {
                  document.getElementById('create-chat-tooltip')?.classList.remove('hidden');
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.backgroundColor = '#333';
                }}
                onMouseOut={(e) => {
                  document.getElementById('create-chat-tooltip')?.classList.add('hidden');
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.backgroundColor = 'black';
                }}
                aria-label="Create New Chat"
              >
                <PlusIcon style={{ width: '24px', height: '24px', color: 'white' }} />
              </button>
              <div 
                id="create-chat-tooltip"
                className="hidden"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  zIndex: 50,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                  animation: 'tooltipFade 0.2s ease'
                }}
              >
                Create New Chat
                <div
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '18px',
                    width: '0',
                    height: '0',
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderBottom: '6px solid rgba(0, 0, 0, 0.8)'
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-md mb-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or participant..."
              style={{
                width: '100%',
                maxWidth: '600px',
                padding: '8px',
                border: '1px solid #e5e7eb',
                borderRadius: '0.375rem'
              }}
            />
          </div>
          
          <div className="flex mb-4 border-b">
            <button 
              onClick={() => setActiveTab('all')}
              className={`py-2 px-4 relative ${
                activeTab === 'all' ? 'text-black font-medium' : 'text-gray-500'
              }`}
              style={{
                borderBottom: activeTab === 'all' ? '2px solid black' : 'none',
                backgroundColor: activeTab === 'all' ? 'white' : 'transparent',
                borderLeft: '1px solid #e5e7eb',
                borderTop: '1px solid #e5e7eb',
                borderRight: '1px solid #e5e7eb',
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px',
                marginBottom: '-1px',
                transition: 'all 0.2s ease'
              }}
            >
              All
            </button>
            <button 
              onClick={() => setActiveTab('active')}
              className={`py-2 px-4 relative ${
                activeTab === 'active' ? 'text-black font-medium' : 'text-gray-500'
              }`}
              style={{
                borderBottom: activeTab === 'active' ? '2px solid black' : 'none',
                backgroundColor: activeTab === 'active' ? 'white' : 'transparent',
                borderLeft: activeTab === 'active' ? '1px solid #e5e7eb' : 'none',
                borderTop: activeTab === 'active' ? '1px solid #e5e7eb' : 'none',
                borderRight: activeTab === 'active' ? '1px solid #e5e7eb' : 'none',
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px',
                marginBottom: '-1px',
                transition: 'all 0.2s ease'
              }}
            >
              Active
            </button>
            <button 
              onClick={() => setActiveTab('recent')}
              className={`py-2 px-4 relative ${
                activeTab === 'recent' ? 'text-black font-medium' : 'text-gray-500'
              }`}
              style={{
                borderBottom: activeTab === 'recent' ? '2px solid black' : 'none',
                backgroundColor: activeTab === 'recent' ? 'white' : 'transparent',
                borderLeft: activeTab === 'recent' ? '1px solid #e5e7eb' : 'none',
                borderTop: activeTab === 'recent' ? '1px solid #e5e7eb' : 'none',
                borderRight: activeTab === 'recent' ? '1px solid #e5e7eb' : 'none',
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px',
                marginBottom: '-1px',
                transition: 'all 0.2s ease'
              }}
            >
              Recent
            </button>
            <button 
              onClick={() => setActiveTab('popular')}
              className={`py-2 px-4 relative ${
                activeTab === 'popular' ? 'text-black font-medium' : 'text-gray-500'
              }`}
              style={{
                borderBottom: activeTab === 'popular' ? '2px solid black' : 'none',
                backgroundColor: activeTab === 'popular' ? 'white' : 'transparent',
                borderLeft: activeTab === 'popular' ? '1px solid #e5e7eb' : 'none',
                borderTop: activeTab === 'popular' ? '1px solid #e5e7eb' : 'none',
                borderRight: activeTab === 'popular' ? '1px solid #e5e7eb' : 'none',
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px',
                marginBottom: '-1px',
                transition: 'all 0.2s ease'
              }}
            >
              Popular
            </button>
            <button 
              onClick={loadChatRooms} 
              style={{
                marginLeft: 'auto',
                marginRight: '12px',
                background: 'transparent',
                border: 'none',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              aria-label="Refresh chat list"
            >
              {isLoading ? (
                <div style={{
                  animation: 'spin 1s linear infinite',
                  height: '24px',
                  width: '24px',
                  border: '3px solid black',
                  borderTopColor: 'transparent',
                  borderRadius: '50%'
                }}></div>
              ) : (
                <ArrowPathIcon style={{ height: '24px', width: '24px', color: 'black', fontWeight: 'bold' }} />
              )}
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          {isLoading && activeChats.length === 0 ? (
            <div className="py-20">
              <div className="flex justify-center">
                <div className="animate-spin h-10 w-10 border-4 border-black border-t-transparent rounded-full"></div>
              </div>
              <p className="text-center mt-4 text-gray-500">Loading chats...</p>
            </div>
          ) : filteredChats.length > 0 ? (
            filteredChats.map((chat, index) => (
              <div key={`chat-${chat.id}-${index}`} className="bg-white border border-black rounded-md hover:shadow-md transition-shadow" style={{ padding: '20px' }}>
                <div className="flex justify-between items-center">
                  <div 
                    className="block flex-grow cursor-pointer"
                    onClick={() => setChatToJoin(chat)}
                    style={{ paddingLeft: '16px' }}
                  >
                    <h3 style={{ 
                      fontSize: '1.4rem', 
                      fontWeight: '600',
                      marginBottom: '8px'
                    }}>{chat.title}</h3>
                    <div style={{ 
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      marginTop: '8px'
                    }}>Last activity: {chat.lastActivity}</div>
                  </div>
                  <div className="flex items-center" style={{ marginRight: '12px' }}>
                    <button 
                      onClick={() => setShowParticipants(showParticipants === (typeof chat.id === 'string' ? parseInt(chat.id) : chat.id) ? null : (typeof chat.id === 'string' ? parseInt(chat.id) : chat.id))}
                      style={{
                        display: 'flex',
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '4px 0',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <UserIcon style={{ height: '24px', width: '24px', color: 'black' }} />
                      <span style={{ fontWeight: 'bold', fontSize: '18px', color: 'black' }}>{chat.totalParticipants}</span>
                    </button>
                  </div>
                </div>
                
                {/* Participants dropdown */}
                {showParticipants === (typeof chat.id === 'string' ? parseInt(chat.id) : chat.id) && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">Participants</h4>
                      <button onClick={() => setShowParticipants(null)}>
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <h5 className="text-xs font-medium mb-1">Users</h5>
                        <ul className="text-sm">
                          {chat.participants.users.map(user => (
                            <li key={user}>{user}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium mb-1">NPCs</h5>
                        <ul className="text-sm">
                          {chat.participants.npcs.map(npc => (
                            <li key={npc}>{npc}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 bg-white border border-black p-4 rounded-md">
              <p>No chats found matching your search.</p>
            </div>
          )}
        </div>
        
        {/* Join Chat Modal */}
        {chatToJoin && (
          <>
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-md z-[9000]"
              onClick={() => setChatToJoin(null)}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
            ></div>
            
            {/* Modal container */}
            <div 
              className="fixed bg-white rounded-2xl w-full max-h-[90vh] overflow-y-auto z-[9001]"
              style={{ 
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '-10px 0 20px -5px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.2)',
                width: '90%',
                maxWidth: '500px',
                animation: 'modalAppear 0.3s ease'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Join Chat</h2>
                <button 
                  onClick={() => setChatToJoin(null)}
                  className="text-gray-500 hover:text-gray-800 absolute top-3 right-3 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
                  style={{ 
                    fontSize: '16px', 
                    fontWeight: 'bold',
                    border: 'none', 
                    transition: 'all 0.2s',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    position: 'absolute',
                    right: '0',
                    left: 'auto'
                  }}
                >
                  ✕
                </button>
              </div>
              
              <div className="text-center p-4">
                <h3 className="text-xl font-medium mb-4">{chatToJoin.title}</h3>
                <p className="text-md text-gray-600 mb-6">
                  Would you like to join this philosophical discussion with{' '}
                  {chatToJoin.participants.npcs.map((npc, i) => {
                    // Try to find the full name instead of just the ID
                    const npcName = 
                      philosophers.find(p => p.id.toLowerCase() === npc.toLowerCase())?.name || 
                      customNpcs.find(p => p.id.toLowerCase() === npc.toLowerCase())?.name || 
                      npc;
                    
                    return (
                      <span key={npc}>
                        {i > 0 && i === chatToJoin.participants.npcs.length - 1 ? ' and ' : i > 0 ? ', ' : ''}
                        <strong>{npcName}</strong>
                      </span>
                    );
                  })} 
                  {chatToJoin.participants.users.length > 0 && (
                    <>
                      {' and '}
                      <strong>{chatToJoin.participants.users.length}</strong>
                      {' other '}
                      {chatToJoin.participants.users.length === 1 ? 'user' : 'users'}
                    </>
                  )}?
                </p>
                
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => setChatToJoin(null)}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '9999px',
                      border: '1px solid #e5e7eb',
                      backgroundColor: 'white',
                      color: 'black',
                      fontSize: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'white' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handleJoinChat(typeof chatToJoin.id === 'string' ? parseInt(chatToJoin.id) : chatToJoin.id);
                      setChatToJoin(null);
                    }}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '9999px',
                      border: 'none',
                      backgroundColor: 'black',
                      color: 'white',
                      fontSize: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#333' }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'black' }}
                  >
                    Yes, Join Chat
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Create Chat Modal */}
        {showCreateChatModal && (
          <>
            {/* 배경 오버레이 */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-md z-[9000]"
              onClick={handleCloseCreateChatModal}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
            ></div>
            
            {/* 모달 컨테이너 */}
            <div 
              className="fixed bg-white rounded-2xl w-full max-h-[90vh] overflow-y-auto z-[9001]"
              style={{ 
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '-10px 0 20px -5px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.2)',
                width: '90%',
                maxWidth: '900px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 철학자 정보 모달 - 상위 모달 내부에 배치 */}
              {showPhilosopherDetails && <PhilosopherDetailsModal />}
              
              {/* 모달 헤더 */}
              <div className="relative flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Create New Chat</h2>
                <button 
                  onClick={handleCloseCreateChatModal}
                  className="text-gray-500 hover:text-gray-800 absolute top-3 right-3 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
                  style={{ 
                    fontSize: '16px', 
                    fontWeight: 'bold',
                    border: 'none', 
                    transition: 'all 0.2s',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    position: 'absolute',
                    right: '12px',
                    left: 'auto'
                  }}
                >
                  ✕
                </button>
              </div>
              
              {/* 모달 내용 */}
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
                <form onSubmit={handleCreateChat}>
                  {/* 대화 패턴 선택 섹션 */}
                  <div className="mb-6">
                    <label className="block mb-3 font-medium text-lg">Dialogue Pattern</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div 
                        className={`p-4 border rounded-xl cursor-pointer flex items-center ${
                          dialogueType === 'free' ? 'border-2 border-black bg-gray-50' : 'border-gray-300'
                        }`}
                        onClick={() => {
                          if (dialogueType !== 'free') {
                            setSelectedNPCs([]); // 새 대화패턴 선택시 철학자 초기화
                            setNpcPositions({});
                            setDialogueType('free');
                          }
                        }}
                      >
                        <div className="flex-1">
                          <div className="font-medium">Free Discussion</div>
                          <div className="text-sm text-gray-500">Open-format dialogue with no specific structure</div>
                        </div>
                        {dialogueType === 'free' && (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      
                      <div 
                        className={`p-4 border rounded-xl cursor-pointer flex items-center ${
                          dialogueType === 'debate' ? 'border-2 border-black bg-gray-50' : 'border-gray-300'
                        }`}
                        onClick={() => {
                          if (dialogueType !== 'debate') {
                            setSelectedNPCs([]); // 새 대화패턴 선택시 철학자 초기화
                            setNpcPositions({});
                            setDialogueType('debate');
                          }
                        }}
                      >
                        <div className="flex-1">
                          <div className="font-medium">Pro-Con Debate</div>
                          <div className="text-sm text-gray-500">Structured debate with opposing positions</div>
                        </div>
                        {dialogueType === 'debate' && (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      
                      <div 
                        className={`p-4 border rounded-xl cursor-pointer flex items-center ${
                          dialogueType === 'socratic' ? 'border-2 border-black bg-gray-50' : 'border-gray-300'
                        }`}
                        onClick={() => {
                          if (dialogueType !== 'socratic') {
                            setSelectedNPCs([]); // 새 대화패턴 선택시 철학자 초기화
                            setNpcPositions({});
                            setDialogueType('socratic');
                          }
                        }}
                      >
                        <div className="flex-1">
                          <div className="font-medium">Socratic Dialogue</div>
                          <div className="text-sm text-gray-500">Question-based approach to explore a topic</div>
                        </div>
                        {dialogueType === 'socratic' && (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      
                      <div 
                        className={`p-4 border rounded-xl cursor-pointer flex items-center ${
                          dialogueType === 'dialectical' ? 'border-2 border-black bg-gray-50' : 'border-gray-300'
                        }`}
                        onClick={() => {
                          if (dialogueType !== 'dialectical') {
                            setSelectedNPCs([]); // 새 대화패턴 선택시 철학자 초기화
                            setNpcPositions({});
                            setDialogueType('dialectical');
                          }
                        }}
                      >
                        <div className="flex-1">
                          <div className="font-medium">Dialectical Discussion</div>
                          <div className="text-sm text-gray-500">Thesis-Antithesis-Synthesis format</div>
                        </div>
                        {dialogueType === 'dialectical' && (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <label className="block mb-3 font-medium text-lg">Chat Title</label>
                    <input
                      type="text"
                      value={newChatTitle}
                      onChange={(e) => setNewChatTitle(e.target.value)}
                      placeholder="Enter a philosophical topic..."
                      className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div className="mb-6">
                    <label className="block mb-3 font-medium text-lg">Context</label>
                    
                    {/* 컨텍스트 입력 타입 선택 탭 */}
                    <div className="flex border-b border-gray-200 mb-4">
                      <button
                        type="button"
                        onClick={() => setActiveContextTab('text')}
                        className={`px-4 py-2 font-medium ${
                          activeContextTab === 'text'
                            ? 'border-b-2 border-black text-black'
                            : 'text-gray-500 hover:text-black'
                        }`}
                      >
                        Text
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveContextTab('url')}
                        className={`px-4 py-2 font-medium ${
                          activeContextTab === 'url'
                            ? 'border-b-2 border-black text-black'
                            : 'text-gray-500 hover:text-black'
                        }`}
                      >
                        URL
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveContextTab('file')}
                        className={`px-4 py-2 font-medium ${
                          activeContextTab === 'file'
                            ? 'border-b-2 border-black text-black'
                            : 'text-gray-500 hover:text-black'
                        }`}
                      >
                        File
                      </button>
                    </div>
                    
                    {/* 텍스트 입력 */}
                    {activeContextTab === 'text' && (
                      <textarea
                        value={newChatContext}
                        onChange={(e) => setNewChatContext(e.target.value)}
                        placeholder="Provide some context for the discussion..."
                        className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent h-36"
                      />
                    )}
                    
                    {/* URL 입력 */}
                    {activeContextTab === 'url' && (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={contextUrl}
                            onChange={(e) => setContextUrl(e.target.value)}
                            placeholder="Enter a URL to extract context from..."
                            className="flex-1 p-4 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={fetchContextFromUrl}
                            disabled={isLoadingContext || !contextUrl.trim()}
                            className="px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 disabled:bg-gray-400"
                          >
                            {isLoadingContext ? (
                              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                              'Load'
                            )}
                          </button>
                        </div>
                        <p className="text-sm text-gray-500">
                          Enter a URL to extract content from a webpage. Supported formats: web pages, articles, blogs.
                        </p>
                      </div>
                    )}
                    
                    {/* 파일 업로드 */}
                    {activeContextTab === 'file' && (
                      <div className="space-y-4">
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                          <input
                            type="file"
                            id="context-file"
                            accept=".txt,.pdf,.docx"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          {contextFile ? (
                            <div className="space-y-2">
                              <p className="text-lg">File selected: <span className="font-medium">{contextFile.name}</span></p>
                              <p className="text-sm text-gray-500">
                                {isLoadingContext ? 'Extracting content...' : 'File content extracted'}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setContextFile(null);
                                  setContextFileContent('');
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                              >
                                Remove File
                              </button>
                            </div>
                          ) : (
                            <>
                              <label
                                htmlFor="context-file"
                                className="block cursor-pointer space-y-2"
                              >
                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H2m15-8a4 4 0 11-8 0 4 4 0 018 0zm16 0a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span className="text-lg font-medium">Click to upload a file</span>
                                <span className="text-sm text-gray-500">or drag and drop</span>
                              </label>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          Upload a file to extract context. Supported formats: .txt, .pdf, .docx
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-6">
                    <label className="block mb-3 font-medium text-lg">Maximum Participants</label>
                    <input
                      type="number"
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                      min="2"
                      max="10"
                      className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>
                  
                  <div className="mb-6">
                    <label className="block mb-3 font-medium text-lg">Chat Visibility</label>
                    <div className="flex gap-6">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="visibility"
                          checked={isPublic}
                          onChange={() => setIsPublic(true)}
                          className="mr-2 h-5 w-5"
                        />
                        <span className="text-lg">Public (anyone can join)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="visibility"
                          checked={!isPublic}
                          onChange={() => setIsPublic(false)}
                          className="mr-2 h-5 w-5"
                        />
                        <span className="text-lg">Private (invite only)</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="mb-8">
                    <label className="block mb-3 font-medium text-lg">Select Participants</label>
                    
                    {/* Custom NPCs 섹션 */}
                    {customNpcs.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-md font-medium mb-3 text-gray-700">Custom Philosophers</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                          {customNpcs.map(npc => (
                            <div 
                              key={npc.id}
                              className="relative group"
                            >
                              <div className="flex items-center">
                                <div 
                                  onClick={() => toggleNPC(npc.id)}
                                  className={`p-2 text-sm rounded cursor-pointer text-center transition flex-grow 
                                  ${selectedNPCs.includes(npc.id) 
                                    ? 'bg-black text-white border-black font-medium' 
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'}`}
                                >
                                  {npc.name}
                                </div>
                                <button
                                  type="button"
                                  className="ml-1 text-gray-400 hover:text-gray-600 p-1"
                                  onClick={() => loadPhilosopherDetails(npc.id)}
                                >
                                  ⓘ
                                </button>
                              </div>
                              {/* 찬반토론 모드에서 선택된 철학자의 경우 찬성/반대 버튼 표시 */}
                              {dialogueType === 'debate' && selectedNPCs.includes(npc.id) && (
                                <div className="flex mt-1 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setNpcPosition(npc.id, 'pro')}
                                    className={`text-xs rounded py-1 flex-1 transition-colors ${
                                      npcPositions[npc.id] === 'pro' 
                                        ? 'bg-green-600 text-white' 
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                    }`}
                                  >
                                    Pro
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setNpcPosition(npc.id, 'con')}
                                    className={`text-xs rounded py-1 flex-1 transition-colors ${
                                      npcPositions[npc.id] === 'con' 
                                        ? 'bg-red-600 text-white' 
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                    }`}
                                  >
                                    Con
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Default Philosophers 섹션 */}
                    <div>
                      <h3 className="text-md font-medium mb-3 text-gray-700">Default Philosophers</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                        {philosophers.map(philosopher => (
                          <div 
                            key={philosopher.id}
                            className="relative group"
                          >
                            <div className="flex items-center">
                              <div 
                                onClick={() => toggleNPC(philosopher.id)}
                                className={`p-2 text-sm rounded cursor-pointer text-center transition flex-grow 
                                ${selectedNPCs.includes(philosopher.id) 
                                  ? 'bg-black text-white border-black font-medium' 
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'}`}
                              >
                                {philosopher.name}
                              </div>
                              <button
                                type="button"
                                className="ml-1 text-gray-400 hover:text-gray-600 p-1"
                                onClick={() => loadPhilosopherDetails(philosopher.id)}
                              >
                                ⓘ
                              </button>
                            </div>
                            {/* 찬반토론 모드에서 선택된 철학자의 경우 찬성/반대 버튼 표시 */}
                            {dialogueType === 'debate' && selectedNPCs.includes(philosopher.id) && (
                              <div className="flex mt-1 gap-1">
                                <button
                                  type="button"
                                  onClick={() => setNpcPosition(philosopher.id, 'pro')}
                                  className={`text-xs rounded py-1 flex-1 transition-colors ${
                                    npcPositions[philosopher.id] === 'pro' 
                                      ? 'bg-green-600 text-white' 
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                  }`}
                                >
                                  Pro
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNpcPosition(philosopher.id, 'con')}
                                  className={`text-xs rounded py-1 flex-1 transition-colors ${
                                    npcPositions[philosopher.id] === 'con' 
                                      ? 'bg-red-600 text-white' 
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                  }`}
                                >
                                  Con
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Selected NPCs display - 선택된 철학자 표시 섹션 */}
                    {selectedNPCs.length > 0 && (
                      <div className="mt-6">
                        {dialogueType === 'debate' ? (
                          <div>
                            <h3 className="text-md font-medium mb-4 text-gray-700">Selected Philosophers</h3>
                            <div className="flex justify-between gap-4">
                              {/* 찬성 측 철학자들 */}
                              <div className="flex-1 border-r border-gray-300 pr-4">
                                <h4 className="text-sm font-semibold text-green-700 mb-3">Pro Side</h4>
                                <div className="flex flex-wrap gap-4">
                                  {selectedNPCs
                                    .filter(npcId => npcPositions[npcId] === 'pro')
                                    .map(npcId => {
                                      // 커스텀 NPC 또는 기본 철학자에서 찾기
                                      const npc = customNpcs.find(p => p.id === npcId) || philosophers.find(p => p.id === npcId);
                                      if (!npc) return null;
                                      const avatarUrl = npc.portrait_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(npc.name)}&background=random&size=128&font-size=0.5`;
                                      return (
                                        <div key={npcId} className="relative flex flex-col items-center" style={{ width: '120px' }}>
                                          <img
                                            src={avatarUrl}
                                            alt={npc.name}
                                            width={120}
                                            height={120}
                                            style={{
                                              objectFit: 'cover',
                                              objectPosition: 'top center',
                                              borderRadius: '50%',
                                              border: '3px solid #22c55e', // green-500
                                              boxShadow: '-10px 0 20px -5px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.2)'
                                            }}
                                            onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(npc.name)}&background=random&size=128&font-size=0.5`; }}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => toggleNPC(npcId)}
                                            aria-label="Remove influence"
                                            style={{
                                              position: 'absolute',
                                              top: '4px',
                                              right: '4px',
                                              width: '24px',
                                              height: '24px',
                                              backgroundColor: 'white',
                                              borderRadius: '50%',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontSize: '14px',
                                              color: '#4B5563',
                                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                              border: 'none',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            &times;
                                          </button>
                                          <span style={{ marginTop: '4px', fontSize: '12px', textAlign: 'center', color: '#374151', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                            {npc.name}
                                          </span>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                              {/* 반대 측 철학자들 */}
                              <div className="flex-1 pl-4">
                                <h4 className="text-sm font-semibold text-red-700 mb-3">Con Side</h4>
                                <div className="flex flex-wrap gap-4">
                                  {selectedNPCs
                                    .filter(npcId => npcPositions[npcId] === 'con')
                                    .map(npcId => {
                                      // 커스텀 NPC 또는 기본 철학자에서 찾기
                                      const npc = customNpcs.find(p => p.id === npcId) || philosophers.find(p => p.id === npcId);
                                      if (!npc) return null;
                                      const avatarUrl = npc.portrait_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(npc.name)}&background=random&size=128&font-size=0.5`;
                                      return (
                                        <div key={npcId} className="relative flex flex-col items-center" style={{ width: '120px' }}>
                                          <img
                                            src={avatarUrl}
                                            alt={npc.name}
                                            width={120}
                                            height={120}
                                            style={{
                                              objectFit: 'cover',
                                              objectPosition: 'top center',
                                              borderRadius: '50%',
                                              border: '3px solid #ef4444', // red-500
                                              boxShadow: '-10px 0 20px -5px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.2)'
                                            }}
                                            onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(npc.name)}&background=random&size=128&font-size=0.5`; }}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => toggleNPC(npcId)}
                                            aria-label="Remove influence"
                                            style={{
                                              position: 'absolute',
                                              top: '4px',
                                              right: '4px',
                                              width: '24px',
                                              height: '24px',
                                              backgroundColor: 'white',
                                              borderRadius: '50%',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontSize: '14px',
                                              color: '#4B5563',
                                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                              border: 'none',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            &times;
                                          </button>
                                          <span style={{ marginTop: '4px', fontSize: '12px', textAlign: 'center', color: '#374151', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                            {npc.name}
                                          </span>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-6">
                            <h3 className="text-md font-medium mb-3 text-gray-700">Selected Philosophers</h3>
                            <div className="flex flex-wrap gap-4">
                        {selectedNPCs.map(npcId => {
                          // 커스텀 NPC 또는 기본 철학자에서 찾기
                          const npc = customNpcs.find(p => p.id === npcId) || philosophers.find(p => p.id === npcId);
                          if (!npc) return null;
                          const avatarUrl = npc.portrait_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(npc.name)}&background=random&size=128&font-size=0.5`;
                          return (
                            <div key={npcId} className="relative flex flex-col items-center" style={{ width: '144px' }}>
                              <img
                                src={avatarUrl}
                                alt={npc.name}
                                width={144}
                                height={144}
                                style={{
                                  objectFit: 'cover',
                                  objectPosition: 'top center',
                                  borderRadius: '50%',
                                  boxShadow: '-10px 0 20px -5px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.2)'
                                }}
                                onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(npc.name)}&background=random&size=128&font-size=0.5`; }}
                              />
                              <button
                                type="button"
                                onClick={() => toggleNPC(npcId)}
                                aria-label="Remove influence"
                                style={{
                                  position: 'absolute',
                                  top: '4px',
                                  right: '4px',
                                  width: '28px',
                                  height: '28px',
                                  backgroundColor: 'white',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '16px',
                                  color: '#4B5563',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                  border: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                &times;
                              </button>
                              <span style={{ marginTop: '4px', fontSize: '12px', textAlign: 'center', color: '#374151', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                {npc.name}
                              </span>
                            </div>
                          );
                        })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* 모달 푸터 */}
                  <div className="mt-8 flex justify-end gap-4">
                    <button
                      type="button"
                      onClick={handleCloseCreateChatModal}
                      className="px-6 py-4 text-lg border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-8 py-4 text-lg bg-black text-white rounded-xl hover:bg-gray-800 transition-colors flex items-center"
                      disabled={!newChatTitle.trim() || selectedNPCs.length === 0 || isCreating}
                    >
                      {isCreating ? (
                        <>
                          <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></span>
                          Creating...
                        </>
                      ) : (
                        'Create Chat'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* 애니메이션을 위한 스타일 추가 */}
      <style jsx global>{`
        @keyframes modalAppear {
          from {
            opacity: 0;
            transform: translate(-50%, -48%) scale(0.92);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        
        @keyframes tooltipFade {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        /* 모달이 열렸을 때 본문 스크롤 방지 */
        body.modal-open {
          overflow: hidden;
          position: fixed;
          width: 100%;
          height: 100%;
        }
        
        /* 모달 스타일 보조 */
        .fixed {
          position: fixed !important;
        }
        
        .rounded-3xl {
          border-radius: 1.5rem !important;
        }
        
        .z-9000 {
          z-index: 9000 !important;
        }
        
        .z-9001 {
          z-index: 9001 !important;
        }
        
        /* 모달 백드롭과 컨테이너의 위치와 차례 - Make sure the modal is completely above everything */
        [class*="fixed"] {
          isolation: isolate;
        }
        
        /* Ensure stacking context is properly handled */
        body.modal-open::after {
          content: '';
          position: fixed;
          inset: 0;
          z-index: 8999;
        }
      `}</style>
    </>
  );
}


