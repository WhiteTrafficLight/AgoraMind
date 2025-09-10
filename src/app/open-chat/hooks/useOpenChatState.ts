import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { loggers } from '@/utils/logger';
import chatService, { ChatRoom as ServiceChatRoom } from '@/lib/ai/chatService';
import { useCreateChat } from './useCreateChat';
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
  const { createChat, isCreating: isCreatingHook, error: createError } = useCreateChat();
  
  // Core state - completely removed socketConnected since we don't need Socket.IO
  const [state, setState] = useState<OpenChatState>({
    activeChats: [],
    isLoading: true,
    searchQuery: '',
    activeTab: 'all',
    showParticipants: null,
    showCreateChatModal: false,
    chatToJoin: null,
    socketConnected: false, // Keep for compatibility with types but won't be used
    username: '',
    philosophers: [],
    customNpcs: []
  });
  
  const [isCreating, setIsCreating] = useState(false);

  // Refs for avoiding stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  // Update state helper
  const updateState = (updates: Partial<OpenChatState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

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
      loggers.ui.error('Failed to load chat rooms', { error });
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
          loggers.ui.info('Retrieved username from database', { username: profileData.username });
        } else {
          const storedUsername = sessionStorage.getItem('chat_username');
          const username = storedUsername || `User_${Math.floor(Math.random() * 10000)}`;
          updateState({ username });
          sessionStorage.setItem('chat_username', username);
        }
      }
    } catch (error) {
      loggers.ui.error('Error fetching user profile', { error });
      const storedUsername = sessionStorage.getItem('chat_username');
      const username = storedUsername || `User_${Math.floor(Math.random() * 10000)}`;
      updateState({ username });
      sessionStorage.setItem('chat_username', username);
    }
  };

  // Fetch philosophers
  const fetchPhilosophers = async () => {
    try {
      // Load from static JSON file instead of backend API
      const response = await fetch('/data/philosophers.json');
      if (response.ok) {
        const data = await response.json();
        updateState({ philosophers: data.philosophers || [] });
      } else {
        loggers.ui.warn('Failed to fetch philosophers from static file');
        // Fallback to basic list
        const basicPhilosophers = [
          'Socrates', 'Plato', 'Aristotle', 'Kant', 'Nietzsche', 
          'Sartre', 'Camus', 'Simone de Beauvoir', 'Marx', 'Rousseau'
        ].map(name => ({ id: name.toLowerCase(), name }));
        updateState({ philosophers: basicPhilosophers });
      }
    } catch (error) {
      loggers.ui.error('Error fetching philosophers', { error });
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
      // Disabled custom NPCs backend API - using empty array for now
      loggers.ui.info('Custom NPCs backend API disabled - using static philosopher data only');
      updateState({ customNpcs: [] });
    } catch (error) {
      loggers.ui.error('Error fetching custom NPCs', { error });
      updateState({ customNpcs: [] });
    }
  };

  // Create chat room
  const handleCreateChat = async (params: ChatRoomCreationParams) => {
    if (isCreating || isCreatingHook) return;
    
    try {
      // Add current username to params
      const paramsWithUser = {
        ...params,
        username: state.username || sessionStorage.getItem('chat_username') || 'Anonymous'
      };
      
      loggers.ui.info('Creating chat with params', { paramsWithUser });
      loggers.ui.debug('Username passed to chat creation', { username: paramsWithUser.username });
      
      // Use the new createChat hook that handles both Free Discussion and regular chats
      const newChat = await createChat(paramsWithUser);
      loggers.ui.info('Chat creation response received', { chatId: newChat?.id, freeSession: (newChat as any)?.freeDiscussionSessionId });

      // Free discussion: avoid intermediate ROOM_* redirect; navigate directly to session id if available.
      if (paramsWithUser.dialogueType === 'free') {
        updateState({ showCreateChatModal: false });
        toast.success('Chat room created successfully!');
        const freeSessionId = (newChat as any)?.freeDiscussionSessionId;
        if (freeSessionId) {
          router.push(`/chat?id=${freeSessionId}`);
        }
        return;
      }

      // Regular chats: navigate using room id
      router.push(`/chat?id=${newChat.id}`);
      updateState({ showCreateChatModal: false });
      toast.success('Chat room created successfully!');
    } catch (error) {
      loggers.ui.error('Failed to create chat', { error });
      toast.error(createError || 'Failed to create chat room. Please try again.');
    }
  };

  // Join chat
  const handleJoinChat = (chatId: string) => {
    loggers.ui.info('Joining chat', { chatId });
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

  // Periodic refresh - removed socket dependency
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!state.isLoading && !state.showCreateChatModal) {
        loadChatRooms();
      }
    }, 60000); // 1분마다
    
    return () => clearInterval(intervalId);
  }, [state.isLoading, state.showCreateChatModal]);

  return {
    // State - removed socketConnected from return
    activeChats: state.activeChats,
    isLoading: state.isLoading,
    searchQuery: state.searchQuery,
    activeTab: state.activeTab,
    showParticipants: state.showParticipants,
    showCreateChatModal: state.showCreateChatModal,
    chatToJoin: state.chatToJoin,
    username: state.username,
    philosophers: state.philosophers,
    customNpcs: state.customNpcs,
    isCreating: isCreating || isCreatingHook,
    
    // Actions
    updateState,
    loadChatRooms,
    handleCreateChat,
    handleJoinChat,
    
    // Socket removed - no longer needed for open-chat page
  };
} 