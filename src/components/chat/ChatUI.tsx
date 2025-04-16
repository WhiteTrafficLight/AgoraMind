'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/navigation';
import chatService, { ChatMessage } from '@/lib/ai/chatService';
import socketClient from '@/lib/socket/socketClient';

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
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Process and deduplicate messages
  const processedMessages = messages.filter((msg, index, self) => 
    // Keep the message if it's the first occurrence of its ID
    index === self.findIndex(m => m.id === msg.id)
  );

  // Setup socket connection and event listeners
  useEffect(() => {
    // Initialize socket connection
    socketClient.init('User' + Math.floor(Math.random() * 1000)); // Generate a random username for now
    
    // Connect to socket and join room
    const onConnect = () => {
      console.log('Socket connected');
      setIsSocketConnected(true);
      socketClient.joinRoom(chatId);
    };
    
    // Handle new messages received through socket
    const onNewMessage = (message: ChatMessage) => {
      setMessages(prev => {
        // Check if message already exists
        if (prev.some(msg => msg.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      
      // If it's an AI response, stop the thinking animation
      if (!message.isUser) {
        setIsThinking(false);
      }
    };
    
    // Handle thinking state for AI responses
    const onThinking = (data: { sender: string }) => {
      if (data.sender === chatId.toString()) {
        setIsThinking(true);
      }
    };
    
    // Handle user joining event
    const onUserJoined = (data: { username: string; usersInRoom: string[]; participants: any }) => {
      setActiveUsers(data.usersInRoom);
      // If participants have changed, update them
      if (data.participants) {
        // Update participants if needed
      }
    };
    
    // Handle user leaving event
    const onUserLeft = (data: { username: string; usersInRoom: string[] }) => {
      setActiveUsers(data.usersInRoom);
    };
    
    // Handle socket errors
    const onError = (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(null), 5000); // Clear error after 5 seconds
    };
    
    // Handle socket disconnection
    const onDisconnect = () => {
      setIsSocketConnected(false);
      setError('Connection lost. Trying to reconnect...');
    };
    
    // Set up event listeners
    socketClient.on('connect', onConnect);
    socketClient.on('new-message', onNewMessage);
    socketClient.on('thinking', onThinking);
    socketClient.on('user-joined', onUserJoined);
    socketClient.on('user-left', onUserLeft);
    socketClient.on('error', onError);
    socketClient.on('disconnect', onDisconnect);
    
    // Clean up event listeners
    return () => {
      socketClient.off('connect', onConnect);
      socketClient.off('new-message', onNewMessage);
      socketClient.off('thinking', onThinking);
      socketClient.off('user-joined', onUserJoined);
      socketClient.off('user-left', onUserLeft);
      socketClient.off('error', onError);
      socketClient.off('disconnect', onDisconnect);
      
      // Leave the room when component unmounts
      if (socketClient.isConnected()) {
        socketClient.leaveRoom(chatId);
      }
    };
  }, [chatId]);

  // Handle back button click
  const handleBackButtonClick = () => {
    // Leave the room before navigating away
    if (socketClient.isConnected()) {
      socketClient.leaveRoom(chatId);
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
    e.preventDefault();
    if (message.trim() === '' || isSending) return;

    try {
      setIsSending(true);
      setError(null);
      
      if (isSocketConnected) {
        // Use socket.io to send message
        const success = socketClient.sendMessage(chatId, message);
        if (!success) {
          throw new Error('Failed to send message via socket');
        }
        
        // Clear message input (actual message will be added through socket event)
        setMessage('');
        
        // Reset textarea height
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
        }
      } else {
        // Fallback to direct API call if socket is not connected
        const userMessage = await chatService.sendMessage(chatId, message);
        setMessages(prev => [...prev, userMessage]);
        setMessage('');
        
        // Reset textarea height
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
        }
        
        // Show thinking indicator
        setIsThinking(true);

        // Get AI response
        const aiMessage = await chatService.getAIResponse(chatId);
        setMessages(prev => [...prev, aiMessage]);
        setIsThinking(false);
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
    if (e.key === 'Enter' && !e.shiftKey) {
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
        <div className="flex items-center">
          <div className={`w-2.5 h-2.5 rounded-full mr-2 ${isSocketConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-xs text-gray-500">{activeUsers.length} online</span>
        </div>
      </div>
      
      {/* Messages container */}
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
                <div className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'} mb-3`}>
                  <div className="flex flex-col" style={{ maxWidth: '70%', width: 'auto' }}>
                    {/* Sender name - only show for NPCs and only once per consecutive messages */}
                    {!msg.isUser && (index === 0 || filteredList[index-1].sender !== msg.sender) && (
                      <span className="text-xs font-medium text-gray-600 ml-2 mb-1">
                        {msg.sender}
                      </span>
                    )}
                    
                    <div className={`relative px-4 py-3 rounded-2xl ${
                      msg.isUser 
                        ? 'bg-gray-300 text-black rounded-br-none' 
                        : 'bg-blue-500 text-white rounded-bl-none'
                    } shadow-sm`} style={{ width: 'fit-content', maxWidth: '100%' }}>
                      {/* Triangle for bubble effect */}
                      <div className={`absolute bottom-0 w-4 h-4 ${
                        msg.isUser 
                          ? 'right-0 translate-x-1/3 bg-gray-300' 
                          : 'left-0 -translate-x-1/3 bg-blue-500'
                      } transform rotate-45`}></div>
                      
                      {/* Message text */}
                      <div className="relative z-10">
                        <p className="text-sm mb-1 break-words whitespace-pre-wrap overflow-hidden text-wrap">
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
                          <p className={`text-[10px] ${msg.isUser ? 'text-gray-600' : 'text-gray-200'} text-right mt-1`}>
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
                <div className="relative px-4 py-3 rounded-2xl bg-blue-500 text-white rounded-bl-none shadow-sm">
                  {/* Triangle for bubble effect */}
                  <div className="absolute bottom-0 left-0 -translate-x-1/3 w-4 h-4 bg-blue-500 transform rotate-45"></div>
                  
                  {/* Thinking dots */}
                  <div className="relative z-10 flex space-x-2 py-1">
                    <div className="bg-white rounded-full w-2.5 h-2.5 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="bg-white rounded-full w-2.5 h-2.5 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="bg-white rounded-full w-2.5 h-2.5 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {error && (
            <div className="flex justify-center my-2">
              <p className="text-sm text-red-500 bg-red-50 py-2 px-3 rounded-lg inline-block shadow-sm">
                {error}
              </p>
            </div>
          )}
          
          <div ref={endOfMessagesRef} className="h-3" />
        </div>
      </div>
      
      {/* Message input */}
      <div className="bg-white border-t border-gray-200 p-3 pb-6 w-full">
        <form onSubmit={handleSendMessage} className="max-w-2xl mx-auto px-3">
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
            >
              {isSending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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