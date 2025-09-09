'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, ArrowLeftIcon, StopIcon, HandRaisedIcon } from '@heroicons/react/24/outline';
import { ChatMessage as ChatMessageBase } from '@/lib/ai/chatService';
import { useFreeDiscussion } from '@/hooks/useFreeDiscussion';
import { PlaybackControls } from './PlaybackControls';
import { FreeDiscussionTimeline } from './FreeDiscussionTimeline';
import { freeDiscussionService } from '@/lib/api/freeDiscussionService';
import { PhilosopherTurn, FreeDiscussionMessage } from '@/app/open-chat/types/freeDiscussion.types';
import '@/utils/freeDiscussionDebug';

interface ChatMessage extends ChatMessageBase {
  isNew?: boolean;
  senderName?: string;
  senderType?: string;
  portrait_url?: string;
  npc_id?: string;
}

interface NpcDetail {
  id: string;
  name: string;
  description?: string;
  portrait_url?: string;
  is_custom: boolean;
}

interface EnhancedCircularChatUIProps {
  chatId: string | number;
  chatTitle: string;
  participants: {
    users: string[];
    npcs: string[];
  };
  initialMessages?: ChatMessage[];
  onBack?: () => void;
  dialogueType: 'free' | 'debate' | 'socratic' | 'dialectical';
  context?: string;
  freeDiscussionConfig?: {
    auto_play: boolean;
    playback_speed: number;
    turn_interval: number;
    max_turns: number;
    allow_user_interruption: boolean;
  };
  freeDiscussionSessionId?: string;
}

const EnhancedCircularChatUI: React.FC<EnhancedCircularChatUIProps> = ({
  chatId,
  chatTitle,
  participants,
  initialMessages = [],
  onBack,
  dialogueType,
  context,
  freeDiscussionConfig,
  freeDiscussionSessionId,
}) => {
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [npcDetails, setNpcDetails] = useState<Record<string, NpcDetail>>({});
  const [userProfilePicture, setUserProfilePicture] = useState<string | null>(null);
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768
  });
  const [circleRadius, setCircleRadius] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Use Free Discussion hook for free dialogues
  const freeDiscussion = dialogueType === 'free' ? useFreeDiscussion(String(chatId), username) : null;

  // Determine if we should use Free Discussion features
  const isFreeDiscussion = dialogueType === 'free' && freeDiscussion;
  
  // Convert initial messages to compatible format for Free Discussion
  const convertedMessages = initialMessages.map(msg => ({
    ...msg,
    message_type: msg.isUser ? 'user' : 'philosopher' as 'moderator' | 'philosopher' | 'user' | 'system',
    session_id: String(chatId),
  }));
  
  // Get messages based on dialogue type
  const messages = isFreeDiscussion ? freeDiscussion.messages : convertedMessages;
  type AugmentedMessage = FreeDiscussionMessage & {
    isUser?: boolean;
    senderName?: string;
    senderType?: string;
    npc_id?: string;
    text?: string;
  };
  const augMessages = messages as unknown as AugmentedMessage[];
  const isConnected = isFreeDiscussion ? freeDiscussion.isConnected : true;

  // Load user information
  useEffect(() => {
    const storedUsername = sessionStorage.getItem('chat_username');
    
    if (storedUsername) {
      setUsername(storedUsername);
      fetchUserProfile(storedUsername);
    } else {
      fetch('/api/user/current')
        .then(res => res.json())
        .then(data => {
          if (data && data.username) {
            setUsername(data.username);
            sessionStorage.setItem('chat_username', data.username);
            fetchUserProfile(data.username);
          } else {
            const randomUsername = `User_${Math.floor(Math.random() * 10000)}`;
            setUsername(randomUsername);
            sessionStorage.setItem('chat_username', randomUsername);
          }
        })
        .catch(err => {
          console.error('Error fetching user:', err);
          const randomUsername = `User_${Math.floor(Math.random() * 10000)}`;
          setUsername(randomUsername);
          sessionStorage.setItem('chat_username', randomUsername);
        });
    }
  }, []);

  // Bind existing session without creating a new one
  useEffect(() => {
    if (
      isFreeDiscussion &&
      username &&
      freeDiscussion &&
      !freeDiscussion.state.sessionId &&
      freeDiscussionSessionId
    ) {
      freeDiscussion.updateUIState({ sessionId: freeDiscussionSessionId, sessionStatus: 'active' });
    }
  }, [isFreeDiscussion, username, freeDiscussion?.state.sessionId, freeDiscussionSessionId]);

  // Bind session from URL when chatId is a session id (e.g., free-xxxx)
  useEffect(() => {
    if (
      isFreeDiscussion &&
      freeDiscussion &&
      !freeDiscussion.state.sessionId
    ) {
      const idStr = String(chatId);
      if (idStr.startsWith('free-')) {
        freeDiscussion.updateUIState({ sessionId: idStr, sessionStatus: 'active' });
      }
    }
  }, [isFreeDiscussion, chatId, freeDiscussion?.state.sessionId]);

  const fetchUserProfile = async (username: string) => {
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const profileData = await response.json();
        if (profileData && (profileData.profileImage || profileData.profilePicture)) {
          setUserProfilePicture(profileData.profileImage || profileData.profilePicture);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  // Load NPC details
  useEffect(() => {
    const loadNpcDetails = async () => {
      const details: Record<string, NpcDetail> = {};
      
      for (const npcId of participants.npcs) {
        details[npcId] = {
          id: npcId,
          name: npcId.charAt(0).toUpperCase() + npcId.slice(1),
          is_custom: false
        };
      }
      
      setNpcDetails(details);
    };
    
    loadNpcDetails();
  }, [participants.npcs]);

  // Handle message sending
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (message.trim() === '') return;

    if (isFreeDiscussion) {
      // Use Free Discussion interruption
      await freeDiscussion.controls.onInterrupt(message);
    } else {
      // Handle regular message sending (existing logic)
      console.log('Regular message sending not implemented in this demo');
    }

    setMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Generate philosopher portrait path
  const getPhilosopherPortraitPath = (philosopherName: string): string => {
    const nameMapping: Record<string, string> = {
      'socrates': 'Socrates',
      'plato': 'Plato', 
      'aristotle': 'Aristotle',
      'immanuel kant': 'Kant',
      'kant': 'Kant',
      'friedrich nietzsche': 'Nietzsche',
      'nietzsche': 'Nietzsche',
      'jean-paul sartre': 'Sartre',
      'sartre': 'Sartre',
      'albert camus': 'Camus',
      'camus': 'Camus',
      'simone de beauvoir': 'Beauvoir',
      'beauvoir': 'Beauvoir',
      'karl marx': 'Marx',
      'marx': 'Marx',
      'jean-jacques rousseau': 'Rousseau',
      'rousseau': 'Rousseau',
      'confucius': 'Confucius',
      'laozi': 'Laozi',
      'buddha': 'Buddha',
      'georg wilhelm friedrich hegel': 'Hegel',
      'hegel': 'Hegel',
      'ludwig wittgenstein': 'Wittgenstein',
      'wittgenstein': 'Wittgenstein'
    };
    
    const normalizedName = philosopherName.toLowerCase().trim();
    const fileName = nameMapping[normalizedName];
    
    if (fileName) {
      return `/philosophers_portraits/${fileName}.png`;
    }
    
    const words = philosopherName.split(' ');
    const lastName = words[words.length - 1];
    const capitalizedLastName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
    return `/philosophers_portraits/${capitalizedLastName}.png`;
  };

  const getNpcDisplayName = (npcId: string): string => {
    if (npcDetails[npcId]) {
      return npcDetails[npcId].name;
    }
    return npcId;
  };

  const getNpcProfileImage = (npcId: string): string => {
    if (npcDetails[npcId] && npcDetails[npcId].portrait_url) {
      return npcDetails[npcId].portrait_url;
    }
    return getPhilosopherPortraitPath(npcId);
  };

  const getDefaultAvatar = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128&font-size=0.5`;
  };

  const getUserProfileImage = (): string => {
    if (userProfilePicture && userProfilePicture.length > 0) {
      return userProfilePicture;
    }
    return `/Profile.png`;
  };

  // Calculate positions
  const calculateCirclePosition = (index: number, total: number, radius: number) => {
    const totalParticipants = total + 1;
    const degreesPerParticipant = 360 / totalParticipants;
    let angle = (90 + degreesPerParticipant + (index * degreesPerParticipant)) % 360;
    const angleInRadians = (angle * Math.PI) / 180;
    
    const ellipseXRadius = radius * 2.8;
    const ellipseYRadius = radius * 0.95;
    
    const x = ellipseXRadius * Math.cos(angleInRadians);
    const y = ellipseYRadius * Math.sin(angleInRadians);
    
    return { x, y, angle };
  };

  const getUserPosition = (radius: number) => {
    const angle = 90;
    const angleInRadians = (angle * Math.PI) / 180;
    
    const ellipseXRadius = radius * 2.8;
    const ellipseYRadius = radius * 0.95;
    
    const x = ellipseXRadius * Math.cos(angleInRadians);
    const y = ellipseYRadius * Math.sin(angleInRadians);
    
    return { x, y, angle };
  };

  // Get current message (normalized to augmented shape)
  const currentMessage = augMessages.length > 0 ? augMessages[augMessages.length - 1] : null;
  
  // Get active speaker
  const getActiveSpeakerId = (): string | null => {
    if (!currentMessage) return null;
    return currentMessage.isUser ? currentMessage.sender : (currentMessage.npc_id || currentMessage.sender);
  };

  const activeSpeakerId = getActiveSpeakerId();

  // Prepare turns for timeline
  const philosopherTurns: PhilosopherTurn[] = augMessages
    .filter(msg => msg.message_type === 'philosopher')
    .map((msg, index) => ({
      philosopher: msg.npc_id || msg.sender,
      turnNumber: index + 1,
      timestamp: String(msg.timestamp),
      preview: (msg.text ?? msg.content).substring(0, 100) + '...',
      isUserTurn: msg.isUser,
    }));

  // Philosopher colors
  const philosopherColors = participants.npcs.reduce((acc, npcId, index) => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    acc[npcId] = colors[index % colors.length];
    return acc;
  }, {} as Record<string, string>);

  // Window resize handling
  useEffect(() => {
    const calculateRadius = () => {
      const containerElement = document.getElementById('elliptical-table');
      let containerWidth = 0;
      let containerHeight = 0;
      
      if (containerElement) {
        containerWidth = containerElement.offsetWidth;
        containerHeight = containerElement.offsetHeight;
      } else {
        containerWidth = Math.min(windowDimensions.width * 0.8, 600);
        containerHeight = Math.min(windowDimensions.height * 0.8, 600);
      }
      
      return Math.min(containerWidth, containerHeight) / 2.5;
    };
    
    const newRadius = calculateRadius();
    setCircleRadius(newRadius);
    
    const handleResize = () => {
      const newDimensions = {
        width: window.innerWidth,
        height: window.innerHeight
      };
      setWindowDimensions(newDimensions);
      const newRadius = calculateRadius();
      setCircleRadius(newRadius);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleResize);
      handleResize();
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-white flex flex-col w-full h-full overflow-hidden">
      {/* Chat header */}
      <div className="bg-white border-b border-gray-200 p-3 flex flex-col items-center relative">
        <button 
          onClick={onBack}
          className="absolute left-4 top-4 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200"
        >
          <ArrowLeftIcon className="h-4 w-4 text-gray-700" />
        </button>

        <div className="text-center mx-auto">
          <h2 className="font-semibold text-gray-900">{chatTitle}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {dialogueType === 'free' ? 'Free Discussion' : 'Debate'} with {participants.npcs.map(npcId => getNpcDisplayName(npcId)).join(', ')}
          </p>
        </div>
        
        <div className="absolute right-4 top-4 flex items-center gap-2">
          {/* Context Panel Toggle */}
          {context && (
            <button
              onClick={() => setShowContextPanel(!showContextPanel)}
              className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Context
            </button>
          )}
          
          {/* Stats Panel Toggle */}
          {isFreeDiscussion && (
            <button
              onClick={() => setShowStatsPanel(!showStatsPanel)}
              className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Stats
            </button>
          )}
          
          <button 
            onClick={() => {}}
            className="text-xs px-2 py-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200 shadow-sm flex items-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            <StopIcon className="h-3 w-3 mr-1" />
            End
          </button>
        </div>
      </div>

      {/* Context Panel */}
      {showContextPanel && context && (
        <div className="bg-blue-50 border-b border-blue-200 p-3">
          <h3 className="font-medium text-sm mb-1">Discussion Context</h3>
          <p className="text-sm text-gray-700">{context}</p>
        </div>
      )}

      {/* Stats Panel */}
      {showStatsPanel && isFreeDiscussion && (
        <div className="bg-gray-50 border-b border-gray-200 p-3">
          <h3 className="font-medium text-sm mb-2">Conversation Stats</h3>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-gray-500">Engagement</span>
              <div className="font-medium">{(freeDiscussion.state.engagementScore * 100).toFixed(0)}%</div>
            </div>
            <div>
              <span className="text-gray-500">Turn</span>
              <div className="font-medium">{freeDiscussion.state.currentTurn} / {freeDiscussion.state.maxTurns}</div>
            </div>
            <div>
              <span className="text-gray-500">Mode</span>
              <div className="font-medium capitalize">{freeDiscussion.state.conversationMode.replace('_', ' ')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main circular chat area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            id="elliptical-table"
            className="relative" 
            style={{ 
              width: '80vmin', 
              height: '80vmin',
              maxWidth: '600px',
              maxHeight: '600px'
            }}
          >
            {/* Message display */}
            {currentMessage && (
              <div 
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20"
                style={{ 
                  maxHeight: windowDimensions.width < 768 ? '35%' : '40%',
                  width: windowDimensions.width < 768 ? '85%' : '70%',
                  maxWidth: '500px',
                }}
              >
                <div 
                  className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200"
                >
                  <div className="font-semibold mb-2">
                    {currentMessage.isUser
                      ? 'User'
                      : (currentMessage.senderName || getNpcDisplayName(currentMessage.npc_id || currentMessage.sender))}
                  </div>
                  <div className="text-gray-800">
                    {currentMessage.text ?? currentMessage.content}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 text-right">
                    {new Date(currentMessage.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}
            
            {/* Render NPCs in a circle */}
            {participants.npcs.map((npcId, index) => {
              const position = calculateCirclePosition(index, participants.npcs.length, circleRadius);
              const isActive = npcId === activeSpeakerId;
              
              return (
                <div 
                  key={npcId}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
                    zIndex: isActive ? 20 : 10,
                  }}
                >
                  <div className="flex flex-col items-center">
                    <div className={`rounded-full overflow-hidden border-4 transition-all ${
                      isActive ? 'border-blue-500 scale-110' : 'border-gray-300'
                    }`}
                    style={{
                      width: windowDimensions.width < 768 ? '50px' : '70px',
                      height: windowDimensions.width < 768 ? '50px' : '70px',
                    }}>
                      <img 
                        src={getNpcProfileImage(npcId)}
                        alt={getNpcDisplayName(npcId)}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = getDefaultAvatar(getNpcDisplayName(npcId));
                        }}
                      />
                    </div>
                    <div className={`text-xs mt-2 font-medium ${
                      isActive ? 'text-black' : 'text-gray-600'
                    }`}>
                      {getNpcDisplayName(npcId)}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* User at the bottom */}
            <div 
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${getUserPosition(circleRadius).x}px), calc(-50% + ${getUserPosition(circleRadius).y}px))`,
                zIndex: username === activeSpeakerId ? 20 : 10,
              }}
            >
              <div className="flex flex-col items-center">
                <div className={`rounded-full overflow-hidden border-4 transition-all ${
                  username === activeSpeakerId ? 'border-blue-500 scale-110' : 'border-gray-300'
                }`}
                style={{
                  width: windowDimensions.width < 768 ? '50px' : '70px',
                  height: windowDimensions.width < 768 ? '50px' : '70px',
                }}>
                  <img 
                    src={getUserProfileImage()}
                    alt="User"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = getDefaultAvatar(username || 'User');
                    }}
                  />
                </div>
                <div className={`text-xs mt-2 font-medium ${
                  username === activeSpeakerId ? 'text-black' : 'text-gray-600'
                }`}>
                  User
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline for Free Discussion */}
      {isFreeDiscussion && (
        <FreeDiscussionTimeline
          turns={philosopherTurns}
          currentTurn={freeDiscussion.state.currentTurn}
          onSeek={(turn) => console.log('Seek to turn:', turn)}
          view={freeDiscussion.state.timelineView}
          philosopherColors={philosopherColors}
        />
      )}

      {/* Playback controls for Free Discussion */}
      {isFreeDiscussion && freeDiscussion.state.showPlaybackControls && (
        <PlaybackControls
          isPlaying={!freeDiscussion.state.isPaused}
          isPaused={freeDiscussion.state.isPaused}
          playbackSpeed={freeDiscussion.state.playbackSpeed}
          currentTurn={freeDiscussion.state.currentTurn}
          maxTurns={freeDiscussion.state.maxTurns}
          isProcessing={freeDiscussion.state.isProcessingControl}
          onPlay={freeDiscussion.controls.onPlay}
          onPause={freeDiscussion.controls.onPause}
          onSpeedChange={freeDiscussion.controls.onSpeedChange}
          onToggleAutoPlay={() => freeDiscussion.updateUIState({ 
            isAutoPlay: !freeDiscussion.state.isAutoPlay 
          })}
          autoPlay={freeDiscussion.state.isAutoPlay}
          onNextTurn={freeDiscussion.controls.onNextTurn}
        />
      )}
      
      {/* Input area */}
      <div className="bg-white border-t border-gray-200 p-3 w-full">
        <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto">
          <div className="relative bg-gray-100 rounded-full px-4 py-2 flex items-center">
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={
                isFreeDiscussion && freeDiscussion.state.allowInterruption
                  ? "Type to interrupt the discussion..."
                  : "Type a message..."
              }
              className="flex-1 bg-transparent outline-none resize-none text-sm"
              rows={1}
              disabled={!isConnected}
            />
            
            {isFreeDiscussion && freeDiscussion.state.allowInterruption && (
              <button
                type="button"
                onClick={() => console.log('Raise hand')}
                className="mr-2 p-1.5 rounded-full hover:bg-gray-200"
                title="Raise hand to speak"
              >
                <HandRaisedIcon className="h-5 w-5 text-gray-600" />
              </button>
            )}
            
            <button
              type="submit"
              disabled={message.trim() === '' || !isConnected}
              className={`p-1.5 rounded-full ${
                message.trim() === '' || !isConnected
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EnhancedCircularChatUI;
