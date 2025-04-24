'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserIcon, PlusIcon, XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import chatService, { ChatRoom, ChatRoomCreationParams } from '@/lib/ai/chatService';
import { io, Socket } from 'socket.io-client';

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
  const [showJoinConfirmation, setShowJoinConfirmation] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChats, setActiveChats] = useState<ChatRoom[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  
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
  const [selectedPhilosopherDetails, setSelectedPhilosopherDetails] = useState<Philosopher | null>(null);
  const [showPhilosopherDetails, setShowPhilosopherDetails] = useState(false);
  
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
  
  // Filter chats based on search query
  const filteredChats = activeChats
    .filter(chat =>
      chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      [...chat.participants.users, ...chat.participants.npcs].some(
        p => p.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );

  // Toggle NPC selection
  const toggleNPC = (npc: string) => {
    if (selectedNPCs.includes(npc)) {
      setSelectedNPCs(selectedNPCs.filter(n => n !== npc));
    } else {
      setSelectedNPCs([...selectedNPCs, npc]);
    }
  };

  // Handle chat creation
  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newChatTitle.trim() || selectedNPCs.length === 0) return;
    
    try {
      setIsCreating(true);
      
      // 컨텍스트 데이터 선택
      let finalContext = '';
      let contextUrl = '';
      let contextFileContent = '';
      
      // 활성 탭에 따라 컨텍스트 설정
      if (activeContextTab === 'text') {
        finalContext = newChatContext;
      } else if (activeContextTab === 'url') {
        finalContext = newChatContext;
      } else if (activeContextTab === 'file') {
        finalContext = newChatContext;
      }
      
      const chatParams: ChatRoomCreationParams = {
        title: newChatTitle,
        context: finalContext,
        contextUrl: contextUrl || undefined,
        contextFileContent: contextFileContent || undefined,
        maxParticipants,
        npcs: selectedNPCs,
        isPublic: isPublic,
        currentUser: `User_${Math.floor(Math.random() * 10000)}` // 랜덤 사용자 이름 생성
      };
      
      // 서버 API를 통해 채팅룸 생성
      console.log('Creating new chat room:', chatParams.title);
      const newChat = await chatService.createChatRoom(chatParams);
      console.log('Chat room created successfully:', newChat.id);
      
      // 방금 생성한 채팅방 ID 확인
      const newChatId = newChat.id;
      if (!newChatId) {
        console.error('Error: New chat has no ID');
        alert('Failed to create chat room - no ID returned.');
        setIsCreating(false);
        return;
      }
      
      // 명확한 ID 로깅
      console.log(`✅ 새로 생성된 채팅방 ID: ${newChatId} (${typeof newChatId})`);
      
      // 폼 초기화 및 모달 닫기
      setNewChatTitle('');
      setNewChatContext('');
      setContextUrl('');
      setContextFile(null);
      setContextFileContent('');
      setActiveContextTab('text');
      setMaxParticipants(5);
      setSelectedNPCs([]);
      setIsPublic(true);
      setShowCreateChatModal(false);
      
      // 방금 생성한 채팅방으로 이동 - ID를 문자열로 확실하게 변환
      const chatIdStr = String(newChatId);
      console.log(`✅ 이동할 채팅방 URL: /chat?id=${chatIdStr}`);
      
      // 약간의 지연 후 이동 (상태가 모두 초기화될 시간을 주기 위해)
      setTimeout(() => {
        router.push(`/chat?id=${chatIdStr}`);
      }, 100);
    } catch (error) {
      console.error('Failed to create chat room:', error);
      alert('Failed to create chat room. Please try again.');
    } finally {
      setIsCreating(false);
    }
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

  // 철학자 목록 로드 함수 추가
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

  // 컴포넌트 마운트 시 철학자 목록 로드
  useEffect(() => {
    fetchPhilosophers();
  }, []);

  // 철학자 정보 로드 함수
  const loadPhilosopherDetails = async (philosopherId: string) => {
    try {
      // 이미 로드한 정보가 있다면 재활용
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
            <button 
              onClick={handleCreateChatClick}
              className="flex items-center gap-2 bg-black bg-opacity-85 text-white px-4 py-2 rounded-full hover:bg-gray-800 hover:bg-opacity-95 transition-colors backdrop-filter backdrop-blur-sm"
            >
              <PlusIcon className="h-5 w-5" />
              Create New Chat
            </button>
          </div>
        </div>
        
        <div className="bg-white border border-black p-4 rounded-md mb-6">
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or participant..."
              className="w-full p-2 border border-black rounded-md"
            />
          </div>
          
          <div className="flex gap-2 mb-4 flex-wrap">
            <button className="bg-black bg-opacity-85 text-white px-3 py-1 rounded-full">All</button>
            <button className="border border-black border-opacity-80 bg-white bg-opacity-85 px-3 py-1 rounded-full hover:bg-gray-100 hover:bg-opacity-90 transition-colors">Active</button>
            <button className="border border-black border-opacity-80 bg-white bg-opacity-85 px-3 py-1 rounded-full hover:bg-gray-100 hover:bg-opacity-90 transition-colors">Recent</button>
            <button className="border border-black border-opacity-80 bg-white bg-opacity-85 px-3 py-1 rounded-full hover:bg-gray-100 hover:bg-opacity-90 transition-colors">Popular</button>
            <button 
              onClick={loadChatRooms} 
              className="ml-auto border border-black border-opacity-80 bg-white bg-opacity-85 px-3 py-1 rounded-full hover:bg-gray-100 hover:bg-opacity-90 transition-colors flex items-center gap-1"
            >
              <span>Refresh</span>
              {isLoading && <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full"></div>}
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
              <div key={`chat-${chat.id}-${index}`} className="bg-white border border-black p-4 rounded-md hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center">
                  <div 
                    className="block flex-grow cursor-pointer"
                    onClick={() => setShowJoinConfirmation(typeof chat.id === 'string' ? parseInt(chat.id) : chat.id)}
                  >
                    <h3 className="text-xl font-semibold mb-2">{chat.title}</h3>
                  </div>
                  <div className="flex items-center ml-4">
                    <button 
                      onClick={() => setShowParticipants(showParticipants === (typeof chat.id === 'string' ? parseInt(chat.id) : chat.id) ? null : (typeof chat.id === 'string' ? parseInt(chat.id) : chat.id))}
                      className="flex items-center gap-1 text-gray-600 hover:text-black"
                    >
                      <UserIcon className="h-5 w-5" />
                      <span>{chat.totalParticipants}</span>
                    </button>
                  </div>
                </div>
                
                <div className="text-sm text-gray-500 mt-2">Last activity: {chat.lastActivity}</div>
                
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
                
                {/* Join Chat Confirmation */}
                {showJoinConfirmation === (typeof chat.id === 'string' ? parseInt(chat.id) : chat.id) && (
                  <div className="mt-3 p-4 bg-gray-50 rounded-md border border-gray-200">
                    <div className="text-center">
                      <h4 className="font-medium mb-2">Would you like to join this chat?</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        You will join the philosophical discussion on "{chat.title}" with {chat.participants.npcs.join(', ')} and {chat.participants.users.length} other user(s).
                      </p>
                      <div className="flex justify-center gap-3">
                        <button 
                          onClick={() => setShowJoinConfirmation(null)}
                          className="px-4 py-2 border border-black border-opacity-80 bg-white bg-opacity-85 rounded-full hover:bg-gray-100 hover:bg-opacity-90 transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleJoinChat(typeof chat.id === 'string' ? parseInt(chat.id) : chat.id)}
                          className="px-4 py-2 bg-black bg-opacity-85 text-white rounded-full hover:bg-gray-800 hover:bg-opacity-95 transition-colors"
                        >
                          Yes, Join Chat
                        </button>
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
                    <label className="block mb-3 font-medium text-lg">Select NPCs</label>
                    
                    {/* NPC selection grid */}
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
                        </div>
                      ))}
                    </div>
                    
                    {/* Selected NPCs display - moved below the grid */}
                    {selectedNPCs.length > 0 && (
                      <div className="mt-6 flex flex-wrap gap-4">
                        {selectedNPCs.map(npcId => {
                          const phil = philosophers.find(p => p.id === npcId);
                          if (!phil) return null;
                          const avatarUrl = phil.portrait_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(phil.name)}&background=random&size=128&font-size=0.5`;
                          return (
                            <div key={npcId} className="relative flex flex-col items-center" style={{ width: '144px' }}>
                              <img
                                src={avatarUrl}
                                alt={phil.name}
                                width={144}
                                height={144}
                                style={{
                                  objectFit: 'cover',
                                  objectPosition: 'top center',
                                  borderRadius: '50%',
                                  boxShadow: '-10px 0 20px -5px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.2)'
                                }}
                                onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(phil.name)}&background=random&size=128&font-size=0.5`; }}
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
                                {phil.name}
                              </span>
                            </div>
                          );
                        })}
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


