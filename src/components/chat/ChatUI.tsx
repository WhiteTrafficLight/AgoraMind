'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PaperAirplaneIcon, ArrowLeftIcon, UsersIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import chatService, { ChatMessage as ChatMessageBase } from '@/lib/ai/chatService';
import socketClient from '@/lib/socket/socketClient';
import Image from 'next/image';
import { API_BASE_URL } from '@/lib/api/baseUrl';
import { DEFAULT_LLM_MODEL } from '@/lib/ai/llmDefaults';
import { loggers } from '@/utils/logger';
import CitationModal from './CitationModal';

// socketClient.init() declares its return type as the underlying Socket,
// but the codebase treats it as a duck-typed bag with optional helper
// methods (joinRoom/leaveRoom/getActiveUsers/isConnected/socket/...).
// We model that explicitly here rather than `as any` casts everywhere.
/* eslint-disable @typescript-eslint/no-explicit-any -- handler payloads vary per event; consumers narrow at use site. */
interface SocketClientLike {
  on: (event: string, handler: (...args: any[]) => void | Promise<void>) => void;
  off: (event: string, handler?: (...args: any[]) => void | Promise<void>) => void;
  emit: (event: string, data?: any) => void;
  joinRoom?: (...args: any[]) => any;
  leaveRoom?: (...args: any[]) => any;
  getActiveUsers?: (...args: any[]) => any;
  isConnected?: () => boolean;
  socket?: any;
  addEventHandler?: (event: string, handler: (...args: any[]) => void) => void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Extend the ChatMessage interface to include additional NPC information.
// rag_used, rag_source_count, rag_sources, citations are already on
// ChatMessageBase and don't need redeclaring here.
interface ChatMessage extends ChatMessageBase {
  isNew?: boolean;
  senderName?: string;
  senderType?: string;
  portrait_url?: string;
  npc_id?: string;
}

// Citation
interface Citation {
  id: string;
  source: string;
  text: string;
  location?: string;
}

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
  onBack?: () => void; // Optional callback  back button click
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
  const [socketClientInstance, setSocketClientInstance] = useState<SocketClientLike | null>(null);
  const [loading, setLoading] = useState(true);
  const [sentMessageIds, setSentMessageIds] = useState<string[]>([]);
  
  // NPC state
  const [npcDetails, setNpcDetails] = useState<Record<string, NpcDetail>>({});
  
  const [autoDialogueMode, setAutoDialogueMode] = useState(false);
  const [isAutoDialogueRunning, setIsAutoDialogueRunning] = useState(false);
  
  // NPC -
  const [thinkingNpcId, setThinkingNpcId] = useState<string | null>(null);
  
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [isCitationModalOpen, setIsCitationModalOpen] = useState(false);
  
  // Auto-dialogue
  
  // NPC -
  const onNpcSelected = useCallback((data: { npc_id: string, npc_name?: string }) => {
    loggers.chat.info('🎯 NPC selected event received:', data);
    
    // NPC ID thinking
    if (data.npc_id) {
      setThinkingNpcId(data.npc_id);
      setIsThinking(true);
      loggers.chat.info(`🎯 NPC ${data.npc_id}${data.npc_name ? ` (${data.npc_name})` : ''} is now thinking...`);
    } else {
      loggers.chat.warn('🎯 Invalid NPC selected event - missing npc_id:', data);
    }
  }, []);
  
  // Prompt  username if not already set
  useEffect(() => {
    if (!username) {
      // Get username from session storage first ( persistence between refreshes)
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
            loggers.chat.error('Error fetching user:', err);
            const randomUsername = `User_${Math.floor(Math.random() * 10000)}`;
            setUsername(randomUsername);
            sessionStorage.setItem('chat_username', randomUsername);
          });
      }
    }
  }, []);
  
  // Process and deduplicate messages
  const processedMessages = messages.filter((msg, index, self) => {
    if (index > 0) {
      const prevMsg = self[index - 1];
      const timeDiff = new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime();
      
      if (
        msg.sender === prevMsg.sender && 
        msg.text === prevMsg.text && 
        msg.isUser === prevMsg.isUser && 
        timeDiff < 5000
      ) {
        return false;
      }
    }
    
    return index === self.findIndex(m => m.id === msg.id);
  });

  useEffect(() => {
    // chatId
    loggers.chat.info(`🔄 Chat room ID changed: ${chatId}`);
    
    setMessages([]);
    setIsThinking(false);
    setIsSending(false);
    setError(null);
    
    if (initialMessages && initialMessages.length > 0) {
      loggers.chat.info(`⚡ Chat room ${chatId} ${initialMessages.length}initial messages set`);
      // Mark existing messages as not new to avoid animation
      const existingMessages = initialMessages.map(msg => ({
        ...msg,
        isNew: false // Existing messages are not new
      }));
      setMessages([...existingMessages]);
    }
    
    setTimeout(() => {
      if (endOfMessagesRef.current) {
        endOfMessagesRef.current.scrollIntoView({ behavior: 'auto' });
      }
    }, 100);
  }, [chatId, initialMessages]);

  useEffect(() => {
    const shouldLoadMessages = initialMessages.length === 0 && messages.length === 0;
    
    if (chatId && shouldLoadMessages && !loading && username) {
      loadLatestMessages();
    }
  }, [chatId, initialMessages.length, messages.length, loading, username]);

  useEffect(() => {
    if (!username) return;

    let cleanupFn: (() => void) | undefined;
    setLoading(true);

    // Initialize socket
    const initSocket = async () => {
      try {
        loggers.chat.info('Starting socket initialization...');
        
        // Initialize socket client and wait  it to complete
        const instance = await socketClient.init(username);
        
        loggers.chat.info('Socket client initialization completed');
        
        // Immediately bind the connect listener to ensure state update
        instance.on('connect', () => {
          loggers.chat.info('⚡️ Socket connected event received - updating UI state');
          setIsSocketConnected(true);
          setError('');
          
          // Join room and get active users after connection
          const joinResult = (instance as unknown as SocketClientLike).joinRoom?.(chatId);
          loggers.chat.info('Room rejoin result after reconnect:', joinResult ? 'success' : 'failed');
          (instance as unknown as SocketClientLike).getActiveUsers?.(chatId);
        });
        
        // Check if socket is already connected and update state accordingly
        if ((instance as unknown as SocketClientLike).isConnected?.()) {
          loggers.chat.info('⚡️ Socket is already connected - setting state immediately');
          setIsSocketConnected(true);
        } else {
          loggers.chat.info('⚡️ Socket is not yet connected - waiting  connect event');
        }
        
        // Update state with the instance
        setSocketClientInstance(instance);
        
        loggers.chat.info('✅ Joining room immediately after socket init:', chatId);
        const joinResult = (instance as unknown as SocketClientLike).joinRoom?.(chatId);
        loggers.chat.info('Room join result:', joinResult ? 'success' : 'failed (queued)');
        
        (instance as unknown as SocketClientLike).getActiveUsers?.(chatId);
        
        // Set up the event listeners and get the cleanup function
        cleanupFn = setupEventListeners(instance);
        
        setLoading(false);
      } catch (error) {
        loggers.chat.error('Error initializing socket:', error);
        setError('Failed to initialize socket connection. Using API fallback mode.');
        setIsSocketConnected(false);
        setLoading(false);
      }
    };

    // Set up all event listeners
    const setupEventListeners = (instance: SocketClientLike) => {
      const onConnect = () => {
        loggers.chat.info('✅ Socket.IO connected!');
        setIsSocketConnected(true);
        setError('');
        
        loggers.chat.info('✅ Joining room on connect/reconnect:', chatId);
        const joinResult = instance.joinRoom?.(chatId);
        loggers.chat.info('Room rejoin result after reconnect:', joinResult ? 'success' : 'failed');

        instance.getActiveUsers?.(chatId);
      };
      
      // First remove any existing handlers to prevent duplicates
      instance.off('connect', onConnect);
      // Then add the handler
      instance.on('connect', onConnect);

      const onDisconnect = () => {
        loggers.chat.info('Socket.IO disconnected');
        setIsSocketConnected(false);
        
        setError('Disconnected from server. Attempting to reconnect.');
      };
      
      // Remove any existing handlers
      instance.off('disconnect', onDisconnect);
      // Then add the handler
      instance.on('disconnect', onDisconnect);
      
      // Handle new messages received through socket
      const onNewMessage = async (data: { roomId: string, message: ChatMessage }) => {
        loggers.chat.info('🔍 New message received:', data);
        
        const currentRoomId = String(chatId);
        const receivedRoomId = String(data.roomId);
        
        if (currentRoomId !== receivedRoomId) {
          loggers.chat.info(`❌ Ignoring message: message from a different room (${receivedRoomId} != ${currentRoomId})`);
          return;
        }
        
        if (!data.message) {
          loggers.chat.error('❌ Invalid message data:', data);
          return;
        }
        
        loggers.chat.info('✅ Valid message; reviewing  UI add:', data.message);
        loggers.chat.info('📋 Message details:');
        loggers.chat.info(`- ID: ${data.message.id}`);
        loggers.chat.info(`- Sender: ${data.message.sender}`);
        loggers.chat.info(`- SenderName: ${data.message.senderName}`);
        loggers.chat.info(`- SenderType: ${data.message.senderType}`);
        loggers.chat.info(`- NPC ID: ${data.message.npc_id}`);
        loggers.chat.info(`- Portrait URL: ${data.message.portrait_url}`);
        loggers.chat.info(`- Text preview: ${data.message.text.substring(0, 100)}...`);
        
        // sentMessageIds ID ( )
        if (sentMessageIds.includes(data.message.id)) {
          loggers.chat.info('Ignoring echo of own message:', data.message.id);
          return;
        }
        
        // Get stored username  consistency
        const storedUsername = sessionStorage.getItem('chat_username') || username;
        if (data.message.isUser && (data.message.sender === username || data.message.sender === storedUsername)) {
          const now = new Date().getTime();
          const existingSimilarMessage = messages.some(msg => 
            (msg.sender === username || msg.sender === storedUsername) && 
            msg.text === data.message.text && 
            msg.isUser === data.message.isUser &&
            now - new Date(msg.timestamp).getTime() < 5000
          );
          
          if (existingSimilarMessage) {
            loggers.chat.info('Similar message already displayed; ignoring:', data.message.text);
            return;
          }
        }
        
        if (!data.message.isUser) {
          const npcId = data.message.npc_id || data.message.sender;
          
          try {
            if (npcId && !npcDetails[npcId]) {
              loggers.chat.info(`🔍 Loading NPC info  new message: ${npcId}`);
              const npcInfo = await fetchNpcDetails(npcId);
              setNpcDetails(prev => ({
                ...prev,
                [npcId]: npcInfo
              }));
              
              data.message.senderName = npcInfo.name;
              if (!data.message.portrait_url) {
                data.message.portrait_url = npcInfo.portrait_url;
              }
              
              loggers.chat.info(`✅ NPC info loaded: ${npcId} → ${npcInfo.name}`);
            } else if (npcId && npcDetails[npcId]) {
              data.message.senderName = npcDetails[npcId].name;
              if (!data.message.portrait_url) {
                data.message.portrait_url = npcDetails[npcId].portrait_url;
              }
              loggers.chat.info(`✅ Using cached NPC info: ${npcId} → ${npcDetails[npcId].name}`);
            }
          } catch (e) {
            loggers.chat.error(`❌ NPC info load failed: ${npcId}`, e);
          }
        }
        
        setMessages(prev => {
          const isDuplicate = prev.some(msg => msg.id === data.message.id);
          
          if (isDuplicate) {
            loggers.chat.info('Ignoring duplicate message (matching ID):', data.message.id);
            return prev;
          }
          
          loggers.chat.info('Adding new message:', data.message);
          // Mark the message as new  animation
          const isCurrentUserMessage = data.message.isUser && 
            (data.message.sender === username || data.message.sender === storedUsername);
            
          // (message.id auto- )
          const isAutoMessage = data.message.id.startsWith('auto-');
          loggers.chat.info('Is auto-conversation message:', isAutoMessage);
          
          const newMessage = {
            ...data.message,
            isNew: true,
            // Ensure user message alignment is correct - check against stored username too
            sender: isCurrentUserMessage ? username : data.message.sender
          };
          
          loggers.chat.info('Final message object:', newMessage);
          loggers.chat.info(`- Final SenderName: ${newMessage.senderName}`);
          loggers.chat.info(`- Final Portrait URL: ${newMessage.portrait_url}`);
          
          return [...prev, newMessage];
        });
        
        // AI thinking
        if (!data.message.isUser) {
          setIsThinking(false);
        }
        
        setTimeout(() => {
          if (endOfMessagesRef.current) {
            endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
        
        // sentMessageIds (30 ID )
        setSentMessageIds(prev => {
          const thirtySecondsAgo = Date.now() - 30000;
          return prev.filter(id => {
            // ID (: user-1234567890)
            const timestamp = parseInt(id.split('-')[1]);
            return isNaN(timestamp) || timestamp > thirtySecondsAgo;
          });
        });
      };
      
      // Handle thinking state  AI responses
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
      const onUserJoined = (data: { username: string; usersInRoom: string[]; participants: { users: string[]; npcs: string[] } }) => {
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
      
      // Add handler  auto-dialogue thinking state
      
      // Add handler  auto-dialogue message sent
      const onAutoMessageSent = () => {
        loggers.chat.info('🤖 Auto-dialogue message sent event received');
        
        // thinking
        setThinkingNpcId(null);
        setIsThinking(false);
        loggers.chat.info('🤖 Cleared thinking state after message sent');
      };
      
      try {
        // - Remove existing handlers first
        instance.off('new-message', onNewMessage);
        instance.off('thinking', onThinking);
        instance.off('active-users', onActiveUsers);
        instance.off('user-joined', onUserJoined);
        instance.off('user-left', onUserLeft);
        instance.off('error', onError);
        instance.off('npc-selected', onNpcSelected);
        instance.off('auto-message-sent', onAutoMessageSent);  // auto-message-sent
        
        // Then add new handlers
        instance.on('new-message', onNewMessage);
        instance.on('thinking', onThinking);
        instance.on('active-users', onActiveUsers);
        instance.on('user-joined', onUserJoined);
        instance.on('user-left', onUserLeft);
        instance.on('error', onError);
        instance.on('npc-selected', onNpcSelected);
        instance.on('auto-message-sent', onAutoMessageSent);  // auto-message-sent
        
        const timeoutId = setTimeout(() => {
          if (!instance.isConnected?.()) {
            loggers.chat.warn('Socket connection timeout - falling back to direct API mode');
            setError('Network connection limited. Using API fallback mode.');
            setIsSocketConnected(false);
          }
        }, 5000);
        
        // Type fix: Define the addEventHandler method on SocketClient
        const handler = (data: { roomId: string | number; message: ChatMessage }) => {
          loggers.chat.info(`🚨 'send-message' event received - room ID: ${data.roomId}, message:`, data.message);
          // Return unmodified data - RAG parameter is no longer needed
          return data;
        };
        
        // Use type casting  missing method (best compromise  fix)
        if ('addEventHandler' in instance) {
          instance.addEventHandler?.('send-message', handler);
        }
        
        // Return cleanup function
        return () => {
          clearTimeout(timeoutId);
          instance.off('new-message', onNewMessage);
          instance.off('thinking', onThinking);
          instance.off('active-users', onActiveUsers);
          instance.off('user-joined', onUserJoined);
          instance.off('user-left', onUserLeft);
          instance.off('error', onError);
          instance.off('connect', onConnect);
          instance.off('disconnect', onDisconnect);
          
          // Leave the room when component unmounts
          if ((instance as unknown as SocketClientLike).isConnected?.()) {
            (instance as unknown as SocketClientLike).leaveRoom?.(chatId);
          }
        };
      } catch (error) {
        loggers.chat.error('Error setting up socket event listeners:', error);
        setError('Failed to set up connection. Using API fallback mode.');
        setIsSocketConnected(false);
        return () => {};
      }
    };

    // Start the initialization process
    initSocket();
    
    // Return a cleanup function  the useEffect
    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
    
  }, [chatId, username]);

  // Handle back button click
  const handleBackButtonClick = () => {
    // Leave the room before navigating away
    if (socketClientInstance && (socketClientInstance as unknown as SocketClientLike).isConnected?.()) {
      (socketClientInstance as unknown as SocketClientLike).leaveRoom?.(chatId);
    }
    
    if (onBack) {
      onBack();
    } else {
      router.push('/open-chat');
    }
  };

  // Auto-resize textarea  input
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

  // Add scrollToBottom helper function
  const scrollToBottom = () => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (message.trim() === '' || isSending) return;

    try {
      loggers.chat.info('📝 sending message:', message);
      setIsSending(true);
      
      const timestamp = new Date(); // Fix: Use Date object instead of string
      const messageObj: ChatMessage = {
        id: `local-${Date.now()}`,
        text: message,
        sender: username || sessionStorage.getItem('chat_username') || 'User',
        isUser: true,
        timestamp
      };
      
      setMessages(prevMessages => [...prevMessages, messageObj]);
      
      setMessage('');
      
      scrollToBottom();
      
      if (!socketClientInstance || !isSocketConnected) {
        loggers.chat.error('No socket connection; cancelling send');
        setError('Disconnected. Please refresh and try again.');
        setIsSending(false);
          return;
      }
      
      // - RAG flag removed
      socketClientInstance.emit('send-message', {
              roomId: chatId,
        message: messageObj
      });
      
      loggers.chat.info(`✅ Message sent through socket:`);
      setIsThinking(true);
      
      } catch (error) {
      loggers.chat.error('❌ message send error:', error);
      setError('An error occurred while sending the message.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle key press in textarea (Enter to send, Shift+Enter  new line)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    loggers.chat.info('🎮 Key pressed:', e.key, 'shiftKey:', e.shiftKey);
    if (e.key === 'Enter' && !e.shiftKey) {
      loggers.chat.info('🎮 Enter pressed without shift - submitting message');
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Format time as HH:MM AM/PM - NaN
  const formatTime = (date: Date) => {
    try {
      const validDate = date instanceof Date ? date : new Date(date);
      if (isNaN(validDate.getTime())) {
        return "";
      }
      
      return validDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (error) {
      loggers.chat.error("Time formatting error:", error);
      return "";
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

  const handleReconnect = async () => {
    try {
      // - use init method instead of constructor
      loggers.chat.info('Attempting manual reconnect...');
      const instance = await socketClient.init(username);
      setSocketClientInstance(instance);
      
      loggers.chat.info('Attempting to rejoin room after reconnect:', chatId);
      if (instance) {
        const joinResult = (instance as unknown as SocketClientLike).joinRoom?.(chatId);
        loggers.chat.info('Manual reconnect rejoin result:', joinResult ? 'success' : 'failed');
        (instance as unknown as SocketClientLike).getActiveUsers?.(chatId);
      }
      
      setError(null);
    } catch (error) {
      loggers.chat.error('Reconnect failed:', error);
      setError('Reconnection failed. Please try again.');
    }
  };

  // Add a test function
  const testSendDirectMessage = () => {
    if (!socketClientInstance) {
      loggers.chat.error('No socket client instance available');
      return;
    }
    
    loggers.chat.info('🧪 Testing direct message sending');
    
    // Create a test message
    const testMsg = {
      id: `test-${Date.now()}`,
      text: `Test message at ${new Date().toLocaleTimeString()}`,
      sender: username,
      isUser: true,
      timestamp: new Date()
    };
    
    // Access the socket directly  debugging
    const socketObj = (socketClientInstance as unknown as SocketClientLike).socket;
    
    if (!socketObj) {
      loggers.chat.error('No socket object available');
      return;
    }
    
    // Try to emit directly
    try {
      loggers.chat.info('🧪 Emitting test message directly');
      socketObj.emit('send-message', {
        roomId: chatId,
        message: testMsg
      });
      loggers.chat.info('🧪 Test message emitted');
      
      // Update UI immediately
      setMessages(prev => [...prev, testMsg]);
    } catch (err) {
      loggers.chat.error('🧪 Error sending test message:', err);
    }
  };

  // Add an additional test function with an extremely simple message
  const testBasicMessage = () => {
    if (!socketClientInstance) {
      loggers.chat.error('No socket client instance available');
      return;
    }
    
    loggers.chat.info('🔎 Testing basic message with simplified object');
    
    // Access the socket directly  debugging
    const socketObj = (socketClientInstance as unknown as SocketClientLike).socket;
    
    if (!socketObj) {
      loggers.chat.error('No socket object available');
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
      
      loggers.chat.info('🔎 Emitting basic message:', basicMsg);
      socketObj.emit('send-message', {
        roomId: String(chatId),
        message: basicMsg
      });
      loggers.chat.info('🔎 Basic message emit complete');
      
      // Update UI
      setMessages(prev => [...prev, basicMsg]);
    } catch (err) {
      loggers.chat.error('🔎 Error sending basic message:', err);
    }
  };

  // Add a dedicated socket connection debugging function
  const debugSocketConnection = () => {
    loggers.chat.info('🔍 Socket Connection Debug:');
    loggers.chat.info('UI isSocketConnected state:', isSocketConnected);
    
    if (!socketClientInstance) {
      loggers.chat.info('❌ No socketClientInstance available');
      return;
    }
    
    loggers.chat.info('✅ Socket client exists');
    loggers.chat.info('Socket connected (client):', socketClientInstance.isConnected?.());
    
    try {
      // Access the raw socket object  debugging
      const rawSocket = (socketClientInstance as unknown as SocketClientLike).socket;
      
      if (!rawSocket) {
        loggers.chat.info('❌ No raw socket available in instance');
        return;
      }
      
      loggers.chat.info('Socket details:', {
        id: rawSocket.id,
        connected: rawSocket.connected,
        disconnected: rawSocket.disconnected,
        nsp: rawSocket.nsp,
        auth: rawSocket.auth
      });
      
      // Check socket's internal state
      if (rawSocket.io) {
        loggers.chat.info('Transport:', rawSocket.io.engine?.transport?.name);
        loggers.chat.info('Reconnection attempts:', rawSocket.io.reconnectionAttempts());
        loggers.chat.info('Reconnection delay:', rawSocket.io.reconnectionDelay());
      }
      
      // List active event listeners
      loggers.chat.info('Event listeners:', rawSocket._events ? Object.keys(rawSocket._events) : 'Not available');
      
      // Alert summary  quick visual feedback
      alert(`Socket Debug:
ID: ${rawSocket.id || 'none'}
Connected: ${rawSocket.connected ? 'Yes' : 'No'}
Transport: ${rawSocket.io?.engine?.transport?.name || 'none'}
Namespace: ${rawSocket.nsp || '/'}
`);
    } catch (err) {
      loggers.chat.error('Error accessing socket details:', err);
    }
  };

  // Add a test function  direct API call
  const testDirectAPICall = async () => {
    try {
      loggers.chat.info('🧪 Testing direct API call');
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
      loggers.chat.info('🧪 Calling chat API directly...');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-llm-provider': 'openai',
          'x-llm-model': DEFAULT_LLM_MODEL
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
      loggers.chat.info('🧪 Direct API response:', aiResponse);
      
      // Add to UI
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      loggers.chat.error('🧪 Direct API test error:', error);
      alert('API test failed: ' + error);
    } finally {
      setIsThinking(false);
    }
  };

  // Toggle automatic dialogue mode
  const toggleAutoDialogueMode = () => {
    loggers.chat.info('Auto-conversation toggle called');
    
    if (isAutoDialogueRunning) {
      stopAutoDialogue();
    } else {
      startAutoDialogue();
    }
  };

  // Start automatic dialogue
  const startAutoDialogue = async () => {
    try {
      loggers.chat.info('🚀 Auto-conversation start called');
      
      // Remove setLoading(true) to prevent triggering message reload
      // setLoading(true);
      
      // Python API
      const response = await fetch(`${API_BASE_URL}/api/auto-conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          room_id: chatId.toString(),
          npcs: participants.npcs,
          topic: chatTitle,
          delay_range: [15, 30]
        })
      });
      
      const data = await response.json();
      loggers.chat.info('Python API response:', data);
      
      if (response.ok) {
        loggers.chat.info('Auto conversation started successfully');
        setIsAutoDialogueRunning(true);
        setAutoDialogueMode(true);
      } else {
        loggers.chat.error('Auto conversation start failed:', data);
        setError(`Auto-conversation start failed: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      loggers.chat.error('Error starting auto conversation:', error);
      setError(`Auto-conversation start failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // setLoading(false); // Remove this to prevent message reloading
    }
  };

  // Stop automatic dialogue
  const stopAutoDialogue = async () => {
    try {
      loggers.chat.info('🛑 Auto-conversation stop called');
      
      // Remove setLoading(true) to prevent triggering message reload
      // setLoading(true);
      
      // Python API - room_id
      const requestUrl = `${API_BASE_URL}/api/auto-conversation?room_id=${chatId.toString()}`;
      loggers.chat.info('Request URL:', requestUrl);
      
      const response = await fetch(requestUrl, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      loggers.chat.info('Python API response:', data);
      
      if (response.ok) {
        loggers.chat.info('✅ Auto-conversation stopped successfully');
        setIsAutoDialogueRunning(false);
        setAutoDialogueMode(false);
      } else {
        loggers.chat.error('❌ Auto-conversation stop failed:', data);
        setError(`Auto-conversation stop failed: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      loggers.chat.error('❌ Error during auto-conversation stop:', error);
      setError(`Auto-conversation stop failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // setLoading(false); // Remove this to prevent message reloading
    }
  };

  // useEffect -
  
  useEffect(() => {
  }, [npcDetails]);

  const loadLatestMessages = async () => {
    try {
      loggers.chat.info('Loading chat room messages');
      setLoading(true);
      setError(null);
      
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/rooms`;
      loggers.chat.info(`🔗 Message load URL: ${apiUrl}?id=${chatId}`);
      
      const response = await fetch(`${apiUrl}?id=${chatId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        loggers.chat.error(`❌ Message load error: ${response.status} ${errorText}`);
        setError(`An error occurred while loading messages (${response.status})`);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      loggers.chat.info(`✅ Message load complete: ${data.messages?.length}items message`);
      
      const sortedMessages = data.messages?.sort((a: ChatMessage, b: ChatMessage) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      }) || [];
      
      const npcIds = new Set<string>();
      sortedMessages.forEach((msg: ChatMessage) => {
        if (!msg.isUser && msg.sender) {
          npcIds.add(msg.npc_id || msg.sender);
        }
      });
      
      loggers.chat.info(`🔍 NPC IDs discovered in messages: ${Array.from(npcIds).join(', ')}`);
      
      // NPC ( )
      const loadNpcDetailsPromises = Array.from(npcIds).map(async (npcId) => {
        try {
          const details = await fetchNpcDetails(npcId);
          loggers.chat.info(`✅ NPC info preloaded: ${npcId} → ${details.name}`);
          return { id: npcId, details };
        } catch (e) {
          loggers.chat.error(`❌ NPC info load failed: ${npcId}`, e);
          return { id: npcId, details: null };
        }
      });
      
      const loadedNpcDetails = await Promise.all(loadNpcDetailsPromises);
      
      const newNpcDetails = { ...npcDetails };
      loadedNpcDetails.forEach(item => {
        if (item.details) {
          newNpcDetails[item.id] = item.details;
        }
      });
      
      // NPC URL ( )
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
      
      loggers.chat.info('Setting enriched message...');
      setMessages(enhancedMessages);
      setNpcDetails(newNpcDetails);
      setIsLoaded(true);
      
      setTimeout(() => {
        if (endOfMessagesRef.current) {
          endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (error) {
      loggers.chat.error('❌ Exception during message load:', error);
      setError('Error loading messages.');
    } finally {
      setLoading(false);
    }
  };

  // fetchNpcDetails -
  const fetchNpcDetails = async (npcId: string): Promise<NpcDetail> => {
    loggers.chat.info(`🔍 Generating NPC info (static): ${npcId}`);
    
    // API -
    return {
      id: npcId,
      name: npcId.charAt(0).toUpperCase() + npcId.slice(1),
      is_custom: false
    };
  };

  // NPC useEffect
  useEffect(() => {
    if (isLoaded && messages.length > 0) {
      loggers.chat.info('Updating message due to NPC info change');
      
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

  const getMessageStyle = (msg: ChatMessage) => {
    const isCurrentUserMessage = msg.isUser && 
      (msg.sender === username || msg.sender === sessionStorage.getItem('chat_username'));
    
    let style = "chat-message-bubble ";
    
    if (isCurrentUserMessage) {
      style += "chat-message-bubble-mine";
    } else if (msg.isUser) {
      style += "chat-message-bubble-other-user";
    } else {
      style += "chat-message-bubble-npc";
    }
    
    return style;
  };

  const getMessageSenderName = (msg: ChatMessage) => {
    if (msg.isUser) {
      return msg.sender === username || msg.sender === sessionStorage.getItem('chat_username') 
        ? 'You' 
        : msg.sender;
    }
    
    // NPC - senderName , getNpcDisplayName
    const npcId = msg.npc_id || msg.sender;
    return msg.senderName || getNpcDisplayName(npcId);
  };

  const loadNpcDetails = async () => {
    try {
      const details: Record<string, NpcDetail> = {};
      
      for (const npcId of participants.npcs) {
        try {
          // API - NPC
          const npcDetail = {
            id: npcId,
            name: npcId.charAt(0).toUpperCase() + npcId.slice(1),
            is_custom: false
          };
          details[npcId] = npcDetail;
          loggers.chat.info(`✅ Loaded NPC details  ${npcId}:`, npcDetail.name);
        } catch (error) {
          loggers.chat.error(`❌ Error loading NPC details  ${npcId}:`, error);
        }
      }
      
      setNpcDetails(details);
    } catch (error) {
      loggers.chat.error('❌ Error loading NPC details:', error);
    }
  };

  useEffect(() => {
    loadNpcDetails();
  }, [participants.npcs]);

  const getDefaultAvatar = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128&font-size=0.5`;
  };

  // NPC - null
  const getNpcDisplayName = (npcId: string | null): string => {
    if (!npcId) {
      return "Unknown AI";
    }
    
    // senderName ( )
    if (typeof npcId === 'object' && (npcId as { senderName?: string }).senderName) {
      return (npcId as { senderName: string }).senderName;
    }
    
    if (npcDetails[npcId]) {
      return npcDetails[npcId].name;
    }
    return npcId;
  };

  // NPC URL - null
  const getNpcProfileImage = (npcId: string | null): string => {
    if (!npcId) {
      return getDefaultAvatar("Unknown AI");
    }
    
    // portrait_url ( )
    if (typeof npcId === 'object' && (npcId as { portrait_url?: string }).portrait_url) {
      return (npcId as { portrait_url: string }).portrait_url;
    }
    
    if (npcDetails[npcId] && npcDetails[npcId].portrait_url) {
      return npcDetails[npcId].portrait_url;
    }
    const displayName = getNpcDisplayName(npcId);
    return getDefaultAvatar(displayName);
  };

  // Add CSS  chat bubbles - ensure consistent rounded corners
  useEffect(() => {
    // Add styles  chat bubbles
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

  const openCitationModal = (citation: Citation) => {
    loggers.chat.info("📚 Open citation modal:", citation);
    setSelectedCitation(citation);
    setIsCitationModalOpen(true);
  };
  
  const closeCitationModal = () => {
    loggers.chat.info("📚 Close citation modal");
    setIsCitationModalOpen(false);
    setTimeout(() => setSelectedCitation(null), 300);
  };
  
  const renderMessageWithCitations = (text: string, citations?: Citation[]) => {
    loggers.chat.info("📚 Starting text render with citations:", citations);
    
    if (!citations || !Array.isArray(citations) || citations.length === 0) {
      loggers.chat.info("⚠️ citation info not found, returning original text:", text.substring(0, 50) + "...");
      return text;
    }
    
    const citationPattern = /\[(\d+)\]/g;
    
    let match;
    const matches: { index: number; citation: string; id: string }[] = [];
    
    while ((match = citationPattern.exec(text)) !== null) {
      const id = match[1];
      loggers.chat.info(`📚 footnote found: [${id}] at index ${match.index}`);
      matches.push({
        index: match.index,
        citation: match[0],
        id: id
      });
    }
    
    if (matches.length === 0) {
      loggers.chat.info("⚠️ footnote pattern not found, returning original text");
      return text;
    }
    
    loggers.chat.info(`📚 Found footnotes ${matches.length}items:`, matches);
    loggers.chat.info(`📚 Available citations ${citations.length}items:`, citations);
    
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    
    matches.forEach((match, i) => {
      if (match.index > lastIndex) {
        result.push(text.substring(lastIndex, match.index));
      }
      
      const citation = citations.find(cit => cit.id === match.id);
      
      if (citation) {
        loggers.chat.info(`📚 footnote ${match.id}citation found:`, citation);
        result.push(
              <button 
            key={`citation-${i}`}
                onClick={() => {
              loggers.chat.info(`📚 footnote ${match.id} clicked`);
              openCitationModal(citation);
            }}
            className="inline bg-transparent border-none p-0 m-0 text-xs font-semibold cursor-pointer"
            style={{ 
              color: 'inherit', 
              verticalAlign: 'super',
              fontSize: '75%',
              lineHeight: 0,
              position: 'relative',
              top: '-1px'
            }}
            title={`Source: ${citation.source}`}
          >
            [{match.id}]
              </button>
        );
      } else {
        loggers.chat.info(`⚠️ footnote ${match.id}citation not found`);
        result.push(match.citation);
      }
      
      lastIndex = match.index + match.citation.length;
    });
    
    if (lastIndex < text.length) {
      result.push(text.substring(lastIndex));
    }
    
    loggers.chat.info("📚 Text rendering complete");
    return result;
  };

  const MessageComponent = ({ message, isNew = false }: { message: ChatMessage, isNew?: boolean }) => {
    const messageRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (isNew && messageRef.current) {
        messageRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, [isNew]);

    // NPC (portrait_url )
    useEffect(() => {
      if (!message.isUser && !message.portrait_url && message.sender) {
        fetchNpcDetails(message.sender).then((npcDetails) => {
          if (npcDetails) {
          }
        });
      }
    }, [message]);

    const processMessageText = (text: string | React.ReactNode) => {
      if (typeof text !== 'string') return text;
      
      // renderMessageWithCitations
      if (message.citations && Array.isArray(message.citations) && message.citations.length > 0) {
        loggers.chat.info("📚 Rendering message with footnotes:", message.citations);
        return renderMessageWithCitations(text, message.citations);
      }
      
      // URL ( )
      const urlPattern = /(https?:\/\/[^\s]+)/g;
      if (!text.match(urlPattern)) {
        return text;
      }
      
      // URL ( )
      const parts = text.split(urlPattern);
      const result: React.ReactNode[] = [];
      
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          result.push(parts[i]);
        } else {
          result.push(
            <a
              key={i}
              href={parts[i]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {parts[i]}
            </a>
          );
        }
      }
      
      return result;
    };

    return (
      <div 
        ref={messageRef}
        className={`flex flex-col ${message.isUser ? 'items-end' : 'items-start'} mb-4 transition-opacity duration-500 
          ${isNew ? 'animate-fadeIn' : 'opacity-100'}`}
      >
        {/* Sender display (user or NPC name) */}
        <div className="flex items-center mb-1">
          {!message.isUser && (
            <div className="w-8 h-8 rounded-full overflow-hidden mr-2 bg-gray-200 dark:bg-gray-700">
              {message.portrait_url ? (
                <Image 
                  src={message.portrait_url} 
                  alt={message.sender} 
                  width={32} 
                  height={32} 
                  className="object-cover npc-profile-img"
                  style={{ maxWidth: '100%', maxHeight: '100%', transition: 'all 0.2s ease-in-out' }}
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-gray-500 dark:text-gray-400">
                  {/* Replace User component with alternative */}
                  <span className="text-xs">AI</span>
                </div>
              )}
            </div>
          )}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {message.isUser ? 'You' : message.senderName || message.sender}
          </div>
        </div>
        
        {/* Message content (speech bubble) */}
        <div 
          className={`max-w-[80%] px-4 py-2 rounded-lg ${
            message.isUser 
              ? 'bg-blue-600 text-white rounded-tr-none dark:bg-blue-800' 
              : 'bg-gray-100 text-gray-900 rounded-tl-none dark:bg-gray-800 dark:text-gray-100'
          }`}
        >
          <div className="whitespace-pre-wrap break-words">
            {processMessageText(message.text)}
          </div>
        </div>
      </div>
    );
  };

  // Auto-dialogue thinking UI
  useEffect(() => {
  }, [isThinking, thinkingNpcId]);

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
          
        {/* Auto-conversation button and connection status on the right */}
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
          {/* RAG toggle button removed */}
          
          {/* Auto-conversation button */}
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
          
          {/* Connection indicator (dot only) */}
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
            padding: '1rem 0 1rem 0',
            paddingRight: '16px'
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
                    // () - check against stored username too
                    (msg.isUser && (msg.sender === username || msg.sender === sessionStorage.getItem('chat_username'))) 
                      ? 'justify-end' 
                      : 'justify-start'
                  } mb-3`}>
                    {/* Profile avatar — shown only when not your own message */}
                    {((!msg.isUser || (msg.sender !== username && msg.sender !== sessionStorage.getItem('chat_username')))) && (
                      <div className="flex-shrink-0 mr-2">
                        <div className="w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] overflow-hidden rounded-full npc-profile-container">
                          {/* Debug logs are removed from JSX and handled in useEffect */}
                          <img 
                            src={msg.isUser 
                                ? getDefaultAvatar(msg.sender) 
                                : (msg.portrait_url || getNpcProfileImage(msg.npc_id || msg.sender))
                            } 
                            alt={msg.sender}
                            className="w-full h-full object-cover npc-profile-img"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = getDefaultAvatar(msg.sender);
                            }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="flex flex-col" style={{ maxWidth: '70%', width: 'auto' }}>
                      {/* Sender name — shown  incoming messages */}
                      {((!msg.isUser || (msg.sender !== username && msg.sender !== sessionStorage.getItem('chat_username')))) && (
                        <span className="text-xs font-medium text-gray-600 ml-2 mb-1">
                          {msg.isUser 
                            ? msg.sender 
                            : (msg.senderName || getNpcDisplayName(msg.npc_id || msg.sender))
                          }
                        </span>
                      )}
                      
                      {/* Simplified speech-bubble UI using CSS classes */}
                      <div className={`${getMessageStyle(msg)}`}>
                        {/* Message text — renders citations as footnotes when present */}
                        <div className="message-text">
                          {msg.citations && Array.isArray(msg.citations) && msg.citations.length > 0 
                            ? renderMessageWithCitations(msg.text, msg.citations)
                            : msg.text 
                          }
                        </div>
                          
                          {/* Time stamp — conditional rendering handles invalid timestamps */}
                          {msg.timestamp && !isNaN(new Date(msg.timestamp).getTime()) && (
                            <p className="chat-message-time">
                              {formatTime(msg.timestamp)}
                            </p>
                          )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            
            {/* Thinking indicator */}
            {isThinking && (
              <>
                {/* Enhanced debug info (dev only) — removed */}
                
              <div className="flex justify-start mb-3">
                  <div className="bg-gray-100 text-gray-600 rounded-lg p-3 shadow-md flex items-center" style={{
                    animation: 'pulse 1.5s infinite ease-in-out',
                    borderLeft: '4px solid #10b981',
                    maxWidth: '85%'
                  }}>
                    {thinkingNpcId ? (
                      <div className="flex items-center">
                        <div className="flex-shrink-0 mr-2" style={{ width: '32px', height: '32px' }}>
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 border border-gray-300 npc-profile-container" style={{ maxWidth: '32px', maxHeight: '32px' }}>
                            <img 
                              src={getNpcProfileImage(thinkingNpcId)} 
                              alt={thinkingNpcId}
                              className="w-full h-full object-cover npc-profile-img"
                              onError={(e) => {
                                // Remove debug log
                                (e.target as HTMLImageElement).src = getDefaultAvatar(thinkingNpcId);
                              }}
                            />
                          </div>
                        </div>
                        <span className="mr-2 font-medium">{getNpcDisplayName(thinkingNpcId)}</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full overflow-hidden mr-2 bg-gray-200 flex items-center justify-center border border-gray-300 flex-shrink-0" style={{ maxWidth: '32px', maxHeight: '32px' }}>
                        <span className="text-xs font-bold text-gray-500">AI</span>
                      </div>
                    )}
                  <div className="typing-animation">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                    <span className="ml-2 font-medium">thinking...</span>
                </div>
              </div>
              </>
            )}
            
            <div ref={endOfMessagesRef}></div>
          </div>
        </div>
      )}
      
      {/* Message input */}
      <div className="bg-white border-t border-gray-200 p-3 w-full" style={{ paddingBottom: '16px' }}>  
        <form 
          onSubmit={(e) => { 
            loggers.chat.info('📝 Form submit event triggered');
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
                loggers.chat.info('🚀 Send button clicked');
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
      
      {/* Citation modal */}
      <CitationModal
        isOpen={isCitationModalOpen}
        onClose={closeCitationModal}
        citation={selectedCitation}
      />
    </div>
  );
};

export default ChatUI; 