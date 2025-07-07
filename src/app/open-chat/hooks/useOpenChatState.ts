import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import chatService, { ChatRoom as ServiceChatRoom } from '@/lib/ai/chatService';
import { useSocket } from '@/hooks/useSocket';
import { 
  ChatRoom, 
  Philosopher, 
  ChatRoomCreationParams, 
  OpenChatState 
} from '../types/openChat.types';

// Convert service ChatRoom to our ChatRoom type
const convertChatRoom = (room: ServiceChatRoom): ChatRoom => {
  return {
    ...room,
    dialogueType: (room.dialogueType as 'free' | 'debate' | 'socratic' | 'dialectical') || 'free'
  };
};

export function useOpenChatState() {
  const router = useRouter();
  
  // Core state
  const [state, setState] = useState<OpenChatState>({
    activeChats: [],
    isLoading: true,
    searchQuery: '',
    activeTab: 'all',
    showParticipants: null,
    showCreateChatModal: false,
    chatToJoin: null,
    socketConnected: false,
    username: '',
    philosophers: [],
    customNpcs: []
  });
  
  const [isCreating, setIsCreating] = useState(false);

  // Socket.IO client connection
  const { socket, isConnected: socketConnected } = useSocket({
    onConnect: () => {
      console.log('✅ Socket.IO connected in open chat!');
      updateState({ socketConnected: true });
    },
    onDisconnect: () => {
      console.log('🔌 Socket.IO disconnected in open chat');
      updateState({ socketConnected: false });
    }
  });

  // Update individual state properties
  const updateState = (updates: Partial<OpenChatState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Update socket connection state
  useEffect(() => {
    updateState({ socketConnected });
  }, [socketConnected]);

  // Load chat rooms
  const loadChatRooms = async () => {
    try {
      updateState({ isLoading: true });
      const rooms = await chatService.getChatRooms();
      
      // Remove duplicates and convert types
      const uniqueRooms: { [key: string]: ChatRoom } = {};
      rooms.forEach(room => {
        uniqueRooms[String(room.id)] = convertChatRoom(room);
      });
      
      updateState({ 
        activeChats: Object.values(uniqueRooms),
        isLoading: false 
      });
    } catch (error) {
      console.error('Failed to load chat rooms:', error);
      updateState({ isLoading: false });
    }
  };

  // Fetch user profile
  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const profileData = await response.json();
        
        if (profileData.username) {
          updateState({ username: profileData.username });
          sessionStorage.setItem('chat_username', profileData.username);
          console.log(`✅ DB에서 사용자 이름 가져옴: ${profileData.username}`);
        } else {
          const storedUsername = sessionStorage.getItem('chat_username');
          const username = storedUsername || `User_${Math.floor(Math.random() * 10000)}`;
          updateState({ username });
          sessionStorage.setItem('chat_username', username);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      const storedUsername = sessionStorage.getItem('chat_username');
      const username = storedUsername || `User_${Math.floor(Math.random() * 10000)}`;
      updateState({ username });
      sessionStorage.setItem('chat_username', username);
    }
  };

  // Fetch philosophers
  const fetchPhilosophers = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/philosophers`);
      if (response.ok) {
        const data = await response.json();
        updateState({ philosophers: data.philosophers || [] });
      } else {
        console.error('Failed to fetch philosophers');
      }
    } catch (error) {
      console.error('Error fetching philosophers:', error);
      // Fallback to basic list
      const basicPhilosophers = [
        'Socrates', 'Plato', 'Aristotle', 'Kant', 'Nietzsche', 
        'Sartre', 'Camus', 'Simone de Beauvoir', 'Marx', 'Rousseau'
      ].map(name => ({ id: name.toLowerCase(), name }));
      updateState({ philosophers: basicPhilosophers });
    }
  };

  // Fetch custom NPCs
  const fetchCustomNpcs = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/npc/list`);
      if (response.ok) {
        const data = await response.json();
        updateState({ customNpcs: data.npcs || [] });
      } else {
        console.error('Failed to fetch custom NPCs');
      }
    } catch (error) {
      console.error('Error fetching custom NPCs:', error);
      updateState({ customNpcs: [] });
    }
  };

  // Create chat room
  const handleCreateChat = async (params: ChatRoomCreationParams) => {
    if (isCreating) return;
    setIsCreating(true);
    
    try {
      // 현재 사용자 이름을 params에 추가
      const paramsWithUser = {
        ...params,
        username: state.username || sessionStorage.getItem('chat_username') || 'Anonymous'
      };
      
      console.log('Creating chat with params:', paramsWithUser);
      console.log('📢 사용자명 전달:', paramsWithUser.username);
      
      const newChat = await chatService.createChatRoom(paramsWithUser);
      console.log('Chat creation response:', newChat);
      
      // Redirect to main chat page (v2 content is now main)
      router.push(`/chat?id=${newChat.id}`);
      
      updateState({ showCreateChatModal: false });
    } catch (error) {
      console.error('Failed to create chat:', error);
      toast.error('Failed to create chat room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Join chat
  const handleJoinChat = (chatId: string) => {
    console.log('Joining chat with ID:', chatId);
    router.push(`/chat?id=${chatId}`);
  };

  // Initialize everything
  useEffect(() => {
    const init = async () => {
      await fetchUserProfile();
      await loadChatRooms();
      await Promise.all([
        fetchPhilosophers(),
        fetchCustomNpcs()
      ]);
    };
    
    init();
  }, []);

  // Periodic refresh
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (state.socketConnected && !state.isLoading && !state.showCreateChatModal) {
        loadChatRooms();
      }
    }, 60000); // 1분마다
    
    return () => clearInterval(intervalId);
  }, [state.socketConnected, state.isLoading, state.showCreateChatModal]);

  return {
    // State
    ...state,
    isCreating,
    
    // Actions
    updateState,
    loadChatRooms,
    handleCreateChat,
    handleJoinChat,
    
    // Socket
    socket,
  };
} 