'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, ArrowLeftIcon, StopIcon } from '@heroicons/react/24/outline';
import { ChatMessage as ChatMessageBase } from '@/lib/ai/chatService';
import { useFreeDiscussion } from '@/hooks/useFreeDiscussion';
import { PlaybackControls } from './PlaybackControls';
import { FreeDiscussionTimeline } from './FreeDiscussionTimeline';
import { freeDiscussionService } from '@/lib/api/freeDiscussionService';
import { PhilosopherTurn, FreeDiscussionMessage } from '@/app/open-chat/types/freeDiscussion.types';
import '@/utils/freeDiscussionDebug';
import { loggers } from '@/utils/logger';

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
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const [username, setUsername] = useState('');
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [npcDetails, setNpcDetails] = useState<Record<string, NpcDetail>>({});
  const [userProfilePicture, setUserProfilePicture] = useState<string | null>(null);
  const [isWaitingNext, setIsWaitingNext] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const waitTargetCountRef = useRef<number | null>(null);
  const waitBaseIndexRef = useRef<number>(0);
  const waitForNonUserRef = useRef<boolean>(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
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
  // Disable input until we receive the first non-user message (moderator/system/philosopher)
  const hasReceivedNonUser = augMessages.some(m => !m.isUser);
  const MODERATOR_IMAGE = '/moderator_portraits/Moderator_basic.png';

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
          loggers.ui.error('Error fetching user:', err);
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
      loggers.ui.error('Error fetching user profile:', error);
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

  // Handle message sending (guarded to avoid double submissions)
  const handleSendMessage = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e && typeof (e as any).preventDefault === 'function') {
      (e as any).preventDefault();
    }
    if (sendingRef.current) return;
    const content = message.trim();
    if (content === '') return;
    try {
      // Clear input immediately for snappier UX
      setMessage('');
      sendingRef.current = true;
      setIsSending(true);
      if (isFreeDiscussion) {
        // Disable Next Turn until a non-user reply arrives
        waitBaseIndexRef.current = augMessages.length;
        waitForNonUserRef.current = true;
        setIsWaitingNext(true);
        try {
          await freeDiscussion.controls.onInterrupt(content);
        } catch (err) {
          loggers.ui.error('User send failed:', err);
          setIsWaitingNext(false);
          waitForNonUserRef.current = false;
          waitBaseIndexRef.current = 0;
        }
      } else {
        loggers.chat.info('Regular message sending not implemented in this demo');
      }
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ignore Enter while IME composition is active to avoid leaving last character
    const nativeAny = e.nativeEvent as any;
    if (isComposing || nativeAny?.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendingRef.current) {
        handleSendMessage(e);
      }
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

  // Participants list for thumbnails
  const allParticipants = [
    ...participants.npcs.map(npcId => ({
      id: npcId,
      type: 'npc' as const,
      name: getNpcDisplayName(npcId),
      image: getNpcProfileImage(npcId),
    })),
    { id: 'user', type: 'user' as const, name: username || 'User', image: getUserProfileImage() },
  ];

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

  // When waiting for next message, clear waiting state once a new message is appended
  useEffect(() => {
    if (!isWaitingNext) return;
    // Waiting for non-user reply (after sending a user message)
    if (waitForNonUserRef.current) {
      const base = waitBaseIndexRef.current;
      if (augMessages.length > base) {
        for (let i = base; i < augMessages.length; i++) {
          const m: any = augMessages[i];
          if (m && m.message_type && m.message_type !== 'user') {
            setIsWaitingNext(false);
            waitForNonUserRef.current = false;
            waitBaseIndexRef.current = 0;
            waitTargetCountRef.current = null;
            break;
          }
        }
      }
      return;
    }
    // Waiting for the next appended message (after clicking Next Turn)
    if (waitTargetCountRef.current !== null && augMessages.length >= waitTargetCountRef.current) {
      setIsWaitingNext(false);
      waitTargetCountRef.current = null;
    }
  }, [augMessages.length, isWaitingNext]);

  // Always scroll messages to bottom when new messages arrive
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [augMessages.length]);

  // Derive active speaker info (treat system/moderator/SP/MO as Moderator with default portrait)
  const hasNoMessages = augMessages.length === 0;
  const activeSpeakerType = currentMessage ? (currentMessage as any).message_type : undefined;
  const activeSenderLower = String(currentMessage?.sender || '').toLowerCase();
  const activeSpeakerIsModerator = hasNoMessages || activeSpeakerType === 'moderator' || activeSpeakerType === 'system' || activeSenderLower === 'mo' || activeSenderLower === 'sp' || activeSenderLower === 'moderator' || activeSenderLower === 'system';
  const activeSpeakerIsUser = currentMessage?.isUser === true;
  const activeNpcId = !activeSpeakerIsUser && !activeSpeakerIsModerator && currentMessage ? (currentMessage.npc_id || currentMessage.sender) : null;
  const activeSpeakerName = activeSpeakerIsUser
    ? (username || 'User')
    : (activeSpeakerIsModerator ? 'Moderator' : (activeNpcId ? getNpcDisplayName(activeNpcId) : null));
  const activeSpeakerImage = activeSpeakerIsUser
    ? getUserProfileImage()
    : (activeSpeakerIsModerator ? MODERATOR_IMAGE : (activeNpcId ? getNpcProfileImage(activeNpcId) : getDefaultAvatar(activeSpeakerName || 'Speaker')));

  // Next button label/tooltip based on state
  const nextButtonLabel = (freeDiscussion && (freeDiscussion.state.isProcessingControl || isWaitingNext))
    ? 'Waiting...'
    : (hasNoMessages ? 'Begin the discussion' : 'Next Turn');
  const nextButtonTooltip = hasNoMessages ? 'Start the discussion' : 'Request the next message';
  const shouldPulseBegin = hasNoMessages && !!freeDiscussion && !(freeDiscussion.state.isProcessingControl || isWaitingNext);
  const isWaiting = !!freeDiscussion && (freeDiscussion.state.isProcessingControl || isWaitingNext);

  // Waiting dots animation state
  const [dotCount, setDotCount] = useState(0);
  useEffect(() => {
    if (!isWaiting) {
      setDotCount(0);
      return;
    }
    const id = setInterval(() => {
      setDotCount(prev => (prev + 1) % 3);
    }, 450);
    return () => clearInterval(id);
  }, [isWaiting]);

  return (
    <div className="fixed inset-0 bg-white flex flex-col w-full h-full overflow-hidden">
      <div className="h-full w-full flex flex-col transition-transform duration-200 ease-in-out">
      {/* Chat header */}
      <div className="bg-white border-b border-gray-200 p-3 flex flex-col items-center relative flex-none">
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
              className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            >
              Context
            </button>
          )}
          
          {/* Stats Panel Toggle */}
          {isFreeDiscussion && (
            <button
              onClick={() => setShowStatsPanel(!showStatsPanel)}
              className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            >
              Stats
            </button>
          )}

          {/* Dialogue History Drawer Toggle (hidden for demo)
          <button
            onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
            className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
          >
            History
          </button>
          */}
          
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

      {/* Main area: split layout */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left panel: Active speaker and thumbnails */}
        <div className="w-[42%] min-w-[260px] border-r border-gray-200 flex flex-col">
          {/* Active speaker */}
          <div className="p-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col items-center relative">
              <div className={`relative rounded-full overflow-hidden border-4 border-black w-2/3 aspect-square max-w-[420px]`}>
                <img src={activeSpeakerImage} alt={activeSpeakerName || 'Speaker'} className="w-full h-full object-cover" onError={(e) => {
                  const target = e.target as HTMLImageElement; target.onerror = null; target.src = getDefaultAvatar(activeSpeakerName || 'Speaker');
                }} />
                {isWaiting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="text-white text-[7.5rem] font-semibold leading-none select-none">
                      {'.'.repeat(dotCount + 1)}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-3 text-sm text-gray-500">Now speaking</div>
              <div className="text-xl font-semibold text-gray-900 truncate">{activeSpeakerName || '—'}</div>

              {/* Next Turn button positioned at bottom-right of the active speaker card */}
              {isFreeDiscussion && freeDiscussion && (
                <div className="absolute bottom-3 right-3 group">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        waitTargetCountRef.current = augMessages.length + 1;
                        waitBaseIndexRef.current = augMessages.length;
                        waitForNonUserRef.current = false;
                        setIsWaitingNext(true);
                        await freeDiscussion.controls.onNextTurn();
                      } catch (error) {
                        loggers.ui.error('Next turn failed:', error);
                        setIsWaitingNext(false);
                        waitForNonUserRef.current = false;
                        waitBaseIndexRef.current = 0;
                        waitTargetCountRef.current = null;
                      }
                    }}
                    disabled={freeDiscussion.state.isProcessingControl || isWaitingNext}
                    className={`text-sm px-4 py-2 rounded-md shadow-sm ${
                      freeDiscussion.state.isProcessingControl || isWaitingNext
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : `bg-black text-white hover:bg-gray-900 cursor-pointer ${shouldPulseBegin ? 'animate-pulse' : ''}`
                    }`}
                  >
                    {nextButtonLabel}
                  </button>
                  {/* Tooltip */}
                  <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition duration-100 pointer-events-none bg-gray-700 text-white text-sm px-2.5 py-1.5 rounded shadow-md whitespace-nowrap">
                    {nextButtonTooltip}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Thumbnails */}
          <div className="px-4 pb-3 overflow-y-auto flex-1">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {allParticipants.map(p => {
                const isActive = (activeSpeakerIsUser && p.type === 'user') || (!activeSpeakerIsUser && p.type === 'npc' && (activeNpcId === p.id));
                return (
                  <div key={`${p.type}-${p.id}`} className="flex flex-col items-center">
                    <div className={`rounded-full overflow-hidden border-2 ${isActive ? 'border-black' : 'border-gray-300'} w-14 h-14`}>
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover" onError={(e) => { const t = e.target as HTMLImageElement; t.onerror = null; t.src = getDefaultAvatar(p.name); }} />
                    </div>
                    <div className={`mt-1 text-[10px] font-medium ${isActive ? 'text-black' : 'text-gray-600'} truncate w-full text-center`}>{p.name}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* (input moved to full-width bottom bar) */}
        </div>

        {/* Right panel: Messages and controls */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
            <div className="text-sm text-gray-700 font-medium">Conversation</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={messagesContainerRef}>
            {augMessages.length === 0 && (
              <div className="text-xs text-gray-500">No messages yet.</div>
            )}
            {augMessages.map((msg, idx) => {
              const senderLower = String((msg.sender || msg.npc_id || '')).toLowerCase();
              const msgType: string | undefined = (msg as any).message_type;
              const isModeratorMsg = msgType === 'moderator' || msgType === 'system' || senderLower === 'mo' || senderLower === 'sp' || senderLower === 'moderator' || senderLower === 'system';
              const displayName = msg.isUser ? (username || 'User') : (isModeratorMsg ? 'Moderator' : (msg.senderName || msg.npc_id || msg.sender));
              const avatarSrc = msg.isUser ? getUserProfileImage() : (isModeratorMsg ? MODERATOR_IMAGE : getNpcProfileImage(msg.npc_id || msg.sender));
              const isLatest = idx === augMessages.length - 1;
              return (
                <div key={`msg-${idx}`} className={`bg-white rounded-md p-3 ${isLatest ? 'border-2 border-black' : 'border border-gray-200'}`}>
                  <div className="flex items-start gap-3">
                    <div className="rounded-full overflow-hidden border border-black w-8 h-8">
                      <img
                        src={avatarSrc}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        onError={(e) => { const t = e.target as HTMLImageElement; t.onerror = null; t.src = getDefaultAvatar(displayName); }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{displayName}</span>
                        <span className="mx-1">•</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{msg.text ?? msg.content}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Full-width bottom input bar */}
      <div className="border-t border-gray-200 bg-white p-3 flex items-start gap-3">
        <form onSubmit={(e) => e.preventDefault()} className="w-full">
          <div className="relative bg-gray-100 rounded-md px-4 py-3 flex items-start gap-3">
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={'Share your thoughts'}
              className="flex-1 bg-transparent outline-none resize-none text-sm py-1.5"
              rows={3}
              disabled={!isConnected || !hasReceivedNonUser}
            />
            <button
              type="button"
              onClick={(e) => handleSendMessage(e as any)}
              disabled={message.trim() === '' || !isConnected || isSending || !hasReceivedNonUser}
              className={`px-3 py-2 rounded-md ${
                message.trim() === '' || !isConnected || isSending || !hasReceivedNonUser
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-black hover:bg-gray-900 text-white cursor-pointer'
              }`}
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Timeline for Free Discussion (hidden for demo release; keep for future use)
      {isFreeDiscussion && freeDiscussion && (
        <FreeDiscussionTimeline
          turns={philosopherTurns}
          currentTurn={freeDiscussion.state.currentTurn}
          onSeek={(turn) => loggers.ui.debug('Seek to turn:', turn)}
          view={freeDiscussion.state.timelineView}
          philosopherColors={philosopherColors}
        />
      )}
      */}

      {/* Playback controls for Free Discussion (hidden for demo release; keep for future use)
      {isFreeDiscussion && freeDiscussion && freeDiscussion.state.showPlaybackControls && (
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
      */}

      {/* Removed bottom Next container and bottom input area as requested */}
      </div>

      {/* Right Drawer: Dialogue History (hidden for demo)
      <aside className={`fixed top-0 right-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl transition-transform duration-200 ease-in-out ${showHistoryDrawer ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="text-sm font-semibold text-gray-900">Dialogue History</h3>
            <button
              onClick={() => setShowHistoryDrawer(false)}
              className="inline-flex items-center justify-center rounded-full p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black"
              aria-label="Close"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 modal-scroll">
            {augMessages.length === 0 && (
              <div className="text-xs text-gray-500">No messages yet.</div>
            )}
            {augMessages.map((msg, idx) => (
              <div key={idx} className="border border-gray-200 rounded-md p-2 bg-white">
                <div className="text-xs font-medium text-gray-700 mb-1">
                  {msg.isUser ? 'User' : (msg.senderName || msg.npc_id || msg.sender)}
                  <span className="text-gray-400"> • {new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-xs text-gray-800 whitespace-pre-wrap">{msg.text ?? msg.content}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
      */}
    </div>
  );
};

export default EnhancedCircularChatUI;
