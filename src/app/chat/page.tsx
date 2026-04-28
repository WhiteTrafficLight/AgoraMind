'use client';
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DebateChatContainer from '@/components/debate/DebateChatContainer';
import CircularChatUI from '@/components/chat/CircularChatUI';
import EnhancedCircularChatUI from '@/components/chat/EnhancedCircularChatUI';
import { chatService, ChatRoom, ChatMessage } from '@/lib/ai/chatService';
import { useSocket } from '@/hooks/useSocket';
import { loggers } from '@/utils/logger';
import { API_BASE_URL } from '@/lib/api/baseUrl';

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
      loggers.socket.info('V2 socket connected to backend');
    },
    onDisconnect: () => {
      loggers.socket.info('V2 socket disconnected from backend');
    },
    onMessage: async (data: { roomId: string, message: ChatMessage }) => {
      loggers.chat.debug('Socket event received: new-message');
      loggers.chat.debug('Received data', { 
        roomId: data.roomId, 
        messagePreview: JSON.stringify(data).substring(0, 300) 
      });
      loggers.chat.debug('Room ID comparison', { 
        currentRoomId: String(chatData?.id), 
        receivedRoomId: String(data.roomId) 
      });
      
      const currentRoomId = String(chatData?.id);
      const receivedRoomId = String(data.roomId);
      
      if (currentRoomId === receivedRoomId && data.message) {
        loggers.chat.info('Room IDs match — saving message to DB then updating UI');
        loggers.chat.debug('Message content', { 
          preview: data.message.text?.substring(0, 100),
          eventType: data.message.metadata?.event_type 
        });
        
        const isCompleteMessage = data.message.metadata?.event_type === 'debate_message_complete';
        const isUserMessage = data.message.isUser === true;
        
        try {
          // 1. DB ( AI )
          if (isCompleteMessage || isUserMessage) {
            loggers.db.info('Starting message DB save', { 
              messageType: isUserMessage ? 'User message' : 'AI message' 
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
              loggers.db.info('DB save successful');
            } else {
              const errorData = await saveResponse.json();
              loggers.db.error('DB save failed', errorData);
            }
          }
          
          setChatData(prev => {
            if (!prev) return prev;
            
            if (isCompleteMessage) {
              loggers.chat.debug('Replacing temporary message with completed message');
              
              const messagesCopy = [...(prev.messages || [])];
              const tempMessageIndex = messagesCopy.findIndex(msg => 
                msg.isGenerating && msg.sender === data.message.sender
              );
              
              const enrichFromMetadata = (msg: ChatMessage): ChatMessage => {
                const meta = (msg.metadata ?? {}) as {
                  rag_used?: boolean;
                  rag_source_count?: number;
                  rag_sources?: ChatMessage['rag_sources'];
                  citations?: ChatMessage['citations'];
                };
                return {
                  ...msg,
                  skipAnimation: false,
                  rag_used: meta.rag_used || false,
                  rag_source_count: meta.rag_source_count || 0,
                  rag_sources: meta.rag_sources || [],
                  citations: meta.citations || [],
                };
              };
              if (tempMessageIndex >= 0) {
                const completeMessage = enrichFromMetadata(data.message);
                messagesCopy[tempMessageIndex] = completeMessage;
                loggers.chat.info('Temporary message replaced');
                loggers.rag.debug('RAG info', {
                  rag_used: completeMessage.rag_used,
                  rag_source_count: completeMessage.rag_source_count,
                  rag_sources_length: completeMessage.rag_sources?.length || 0
                });
                
                // typingMessageIds
                setTimeout(() => {
                  setTypingMessageIds(prev => new Set([...prev, completeMessage.id]));
                }, 100);
              } else {
                loggers.chat.warn('Temporary message not found; adding new');
                const newMessage = enrichFromMetadata(data.message);
                
                loggers.rag.debug('RAG info  regular message', {
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
              loggers.chat.debug('Adding regular message');
              const enrichFromMetadataOuter = (msg: ChatMessage): ChatMessage => {
                const meta = (msg.metadata ?? {}) as {
                  rag_used?: boolean;
                  rag_source_count?: number;
                  rag_sources?: ChatMessage['rag_sources'];
                  citations?: ChatMessage['citations'];
                };
                return {
                  ...msg,
                  skipAnimation: false,
                  rag_used: meta.rag_used || false,
                  rag_source_count: meta.rag_source_count || 0,
                  rag_sources: meta.rag_sources || [],
                  citations: meta.citations || [],
                };
              };
              const newMessage = enrichFromMetadataOuter(data.message);
              
              loggers.rag.debug('RAG info  regular message', {
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
          loggers.chat.error('Error processing message', error);
        }
        
      } else {
        loggers.chat.warn('Room ID mismatch or no message', {
          currentRoom: currentRoomId,
          receivedRoom: receivedRoomId,
          hasMessage: !!data.message
        });
      }
    }
  });

  const handleTypingComplete = (messageId: string) => {
    setTypingMessageIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      return newSet;
    });
  };

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
          const userData = await response.json();
          const userDisplayName = userData.username || userData.name || `User_${Math.floor(Math.random() * 10000)}`;
          setUsername(userDisplayName);
          sessionStorage.setItem('chat_username', userDisplayName);
          loggers.auth.info('V2 user info loaded', { username: userDisplayName });
        } else {
          const storedUsername = sessionStorage.getItem('chat_username') || `User_${Math.floor(Math.random() * 10000)}`;
          setUsername(storedUsername);
          sessionStorage.setItem('chat_username', storedUsername);
        }
      } catch (error) {
        loggers.auth.error('Failed to load V2 user info', error);
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
          loggers.chat.error('Room not found  ID:', chatId);
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

  useEffect(() => {
    if (isConnected && chatData?.id && username && joinRoom) {
      const roomId = String(chatData.id);
      loggers.chat.info(`V2 room ${roomId}joined, user: ${username}`);
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
      
      const result = await chatService.sendMessage(chatData.id, message, {
        id: `user-${Date.now()}`,
        text: message.trim(),
        sender: username || 'User',
        isUser: true,
        timestamp: new Date(),
        role: 'user'
      });
      
      loggers.chat.info('Message sent successfully:', result);
      
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
    
    loggers.chat.debug('handleRefreshChat called');
    loggers.chat.debug('Message count before refresh:', chatData.messages?.length || 0);
    
    setLoading(true);
    try {
      const refreshedRoom = await chatService.getChatRoomById(chatData.id);
      if (refreshedRoom) {
        loggers.chat.debug('Messages fetched from server:', refreshedRoom.messages?.length || 0);
        setChatData(JSON.parse(JSON.stringify(refreshedRoom)));
        loggers.chat.info('Refresh complete - data replaced');
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
      loggers.chat.info('Requesting next debate message  room:', chatData.id);

      const roomId = String(chatData.id);

      const response = await fetch(`${API_BASE_URL}/api/chat/debate/${roomId}/next-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Next message request failed');
      }
      
      const data = await response.json();
      loggers.chat.info('Next speaker info received:', data);
      
      if (data.status === 'success') {
        // next_speaker
        if (data.next_speaker) {
          const { speaker_id, role, is_user } = data.next_speaker;
          
          loggers.chat.info('Next speaker details:', { speaker_id, role, is_user });
          loggers.chat.info('Current username:', username);
          
          if (is_user === true) {
            loggers.chat.info('USER TURN CONFIRMED - activating input');
            loggers.chat.info('Speaker ID:', speaker_id, 'Role:', role);
            
            setCurrentUserTurn({ speaker_id, role });
            setWaitingForUserInput(true);
            setIsGeneratingResponse(false);
            
            const roleText = role === 'pro' ? 'Pro' : role === 'con' ? 'Con' : role;
            const message = `It's your turn to speak as the ${roleText} side. Please enter your opinion.`;
            
            loggers.chat.info('Showing user turn alert:', message);
            alert(message);
            
            setTimeout(() => {
              loggers.chat.info('Attempting to focus input');
              if (document.querySelector('.debate-input-field')) {
                (document.querySelector('.debate-input-field') as HTMLTextAreaElement)?.focus();
              }
            }, 500);
            
            return;
          } else {
            loggers.chat.info('Not user turn - is_user is false');
          }
        } else {
          loggers.chat.warn('No next_speaker data in success response');
        }
        
        // AI ( generating )
        loggers.chat.info('Success response but not user turn - treating as AI turn');
        setIsGeneratingResponse(false);
      } else if (data.status === 'generating') {
        // "generating"
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
        
        loggers.chat.info('Temporary message added, waiting  AI response via Socket.IO');
        
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

  const handleProcessUserMessage = async (message: string) => {
    if (!currentUserTurn || !chatData) {
      loggers.chat.error('Cannot process user message - missing currentUserTurn or chatData');
      return;
    }
    
    try {
      loggers.chat.info('Processing user message:', message);
      loggers.chat.info('Current user turn:', currentUserTurn);
      loggers.chat.info('Username:', username);

      const roomId = String(chatData.id);

      const requestBody = {
        message: message,
        user_id: currentUserTurn.speaker_id  // speaker_id
      };

      loggers.chat.info('Sending user message request:', requestBody);

      const response = await fetch(`${API_BASE_URL}/api/chat/debate/${roomId}/process-user-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to process user message');
      }
      
      const result = await response.json();
      loggers.chat.info('User message processed:', result);
      
      if (result.status === 'success') {
        loggers.chat.info('User message successfully processed - clearing user turn state');
        
        setWaitingForUserInput(false);
        setCurrentUserTurn(null);
        
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

  // window
  useEffect(() => {
    (window as unknown as { debugChat: typeof debugHelpers }).debugChat = debugHelpers;
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

  // V2 debate free
  if (chatData.dialogueType !== 'debate' && chatData.dialogueType !== 'free') {
    return (
      <div className="fixed inset-0 z-50 w-screen h-screen bg-white flex justify-center items-center flex-col">
        <p className="text-xl text-gray-500 mb-4">
          V2 structure currently supports only debate and free chat types.
        </p>
        <div className="text-sm text-blue-600 mb-4">
          Current chat type: {chatData.dialogueType}
        </div>
        <button 
          onClick={() => router.push(`/chat?id=${chatData.id}`)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md mr-2"
        >
          View in legacy mode
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
      {/* Main chat container — loads different UI based on dialogueType */}
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
      
      {/* Global styles */}
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