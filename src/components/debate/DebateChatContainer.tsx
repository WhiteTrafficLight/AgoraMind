'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import MessageInput from './MessageInput';
import ParticipantGrid from './ParticipantGrid';
import MessageList from './MessageList';
import { DebateChatContainerProps, NpcDetail } from '@/types/debate';
import { loggers } from '@/utils/logger';

const DebateChatContainer: React.FC<DebateChatContainerProps> = ({
  room,
  messages,
  npcDetails: initialNpcDetails,
  onSendMessage,
  onRefresh,
  isLoading,
  isGeneratingResponse,
  username = 'You',
  onEndChat,
  userRole,
  onRequestNextMessage,
  typingMessageIds: externalTypingMessageIds,
  onTypingComplete: externalOnTypingComplete,
  waitingForUserInput = false,
  currentUserTurn = null,
  onProcessUserMessage
}) => {
  const moderatorStyles = [
    { id: '0', name: 'Jamie the Host' },
    { id: '1', name: 'Dr. Lee' },
    { id: '2', name: 'Zuri Show' },
    { id: '3', name: 'Elias of the End' },
    { id: '4', name: 'Miss Hana' }
  ];

  const [messageText, setMessageText] = useState('');
  const [userProfilePicture, setUserProfilePicture] = useState<string | null>(null);
  const [npcDetails, setNpcDetails] = useState<Record<string, NpcDetail>>({});
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [isUserTurn, setIsUserTurn] = useState<boolean>(false);
  const [turnIndicatorVisible, setTurnIndicatorVisible] = useState<boolean>(false);
  const [isGeneratingNext, setIsGeneratingNext] = useState<boolean>(false);
  
  const [lastMessageCount, setLastMessageCount] = useState<number>(0);
  const [typingMessageIds, setTypingMessageIds] = useState<Set<string>>(new Set());
  
  const handleTypingComplete = (messageId: string) => {
    setTypingMessageIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      return newSet;
    });
  };
  
  // props
  const activeTypingMessageIds = externalTypingMessageIds || typingMessageIds;
  const activeOnTypingComplete = externalOnTypingComplete || handleTypingComplete;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const getModeratorInfo = useMemo(() => {
    const moderatorConfig = (room as { moderator?: { style_id?: string } }).moderator;
    
    if (moderatorConfig && moderatorConfig.style_id) {
      const style = moderatorStyles.find(s => s.id === moderatorConfig.style_id);
      
      return {
        name: style?.name || 'Jamie the Host',
        profileImage: `/moderator_portraits/Moderator${moderatorConfig.style_id}.png`
      };
    }
    
    return {
      name: 'Jamie the Host',
      profileImage: '/moderator_portraits/Moderator0.png'
    };
  }, [room]);

  const moderatorInfo = getModeratorInfo;

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
      loggers.auth.error('Failed to fetch user profile', error);
    }
  };

  useEffect(() => {
    const loadNpcDetails = async () => {
      const details: Record<string, NpcDetail> = {};
      
      if (initialNpcDetails && initialNpcDetails.length > 0) {
        initialNpcDetails.forEach(npc => {
          details[npc.id] = npc;
        });
        setNpcDetails(details);
        return;
      }
      
      const npcIds = [...(room.pro || []), ...(room.con || []), ...(room.neutral || [])].filter(id => 
        !room.participants.users.includes(id)
      );
      
      for (const npcId of npcIds) {
        // API - NPC
        details[npcId] = {
          id: npcId,
          name: npcId.charAt(0).toUpperCase() + npcId.slice(1),
          is_custom: false
        };
      }
      
      setNpcDetails(details);
    };
    
    loadNpcDetails();
  }, [initialNpcDetails, room.pro, room.con, room.neutral, room.participants.users]);

  /* eslint-disable react-hooks/set-state-in-effect -- legacy effect orchestration; refactor deferred to monolith decomposition phase. */
  useEffect(() => {
    if (username) {
      fetchUserProfile(username);
    }
  }, [username]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (messages.length > lastMessageCount) {
      const newMessages = messages.slice(lastMessageCount);
      const newTypingIds = new Set(typingMessageIds);

      newMessages.forEach(message => {
        const isUser = room.participants.users.includes(message.sender) || message.sender === username;
        // skipAnimation true ( )
        if (!isUser && !message.id.startsWith('temp-waiting-') && !message.skipAnimation) {
          newTypingIds.add(message.id);
        }
      });

      setTypingMessageIds(newTypingIds);
      setLastMessageCount(messages.length);
    }
  }, [messages.length, lastMessageCount, typingMessageIds, room.participants.users, username]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (waitingForUserInput && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        loggers.ui.info('Auto-focusing input on user turn');
      }, 300);
    }
  }, [waitingForUserInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim() && !isInputDisabled) {
      // onProcessUserMessage
      if (waitingForUserInput && currentUserTurn && onProcessUserMessage) {
        loggers.chat.info('Handling user message via onProcessUserMessage', { 
          messageLength: messageText.trim().length,
          userTurn: currentUserTurn 
        });
        onProcessUserMessage(messageText.trim());
      } else {
        loggers.chat.info('Sending message via onSendMessage', { 
          messageLength: messageText.trim().length 
        });
        onSendMessage(messageText.trim());
      }
      setMessageText('');
    }
  };

  // Next
  const handleNextMessage = async () => {
    if (isGeneratingNext || !onRequestNextMessage) return;
    
    setIsGeneratingNext(true);
    loggers.chat.info(`Next button clicked — requesting next message  room`, { roomId: room.id });
    
    try {
      await onRequestNextMessage();
    } catch (error) {
      loggers.chat.error('Error requesting next message', error);
    } finally {
      setIsGeneratingNext(false);
    }
  };

  // Helper functions
  const setUserTurn = (turn: boolean, visible: boolean) => {
    setIsUserTurn(turn);
    setTurnIndicatorVisible(visible);
  };

  const isInputDisabled = isLoading || isGeneratingResponse || 
    !(waitingForUserInput || (isUserTurn && !waitingForUserInput));

  const displayUserTurn = waitingForUserInput || isUserTurn;
  const shouldShowNextButton = (
    isDebateRoom: boolean,
    onRequestNextMessage: (() => void) | undefined,
  ) => {
    // Next ( )
    return isDebateRoom && !!onRequestNextMessage;
  };

  const getNameFromId = (id: string, isUser: boolean): string => {
    if (id === 'Moderator' || id === 'moderator') {
      return moderatorInfo.name;
    }
    
    if (isUser) {
      return username;
    }
    
    const npc = npcDetails[id];
    if (npc) {
      return npc.name;
    }
    
    return id.charAt(0).toUpperCase() + id.slice(1);
  };

  const getDefaultAvatar = (name: string) => {
    if (name === moderatorInfo.name || name === 'Moderator') {
      return moderatorInfo.profileImage;
    }
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
  };

  // Generate philosopher portrait path from static files (DebateTopicModal.tsx )
  const getPhilosopherPortraitPath = (philosopherName: string): string => {
    // Map philosopher names to actual file names (using last names mostly)
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
    
    // Fallback: use capitalized last word as filename
    const words = philosopherName.split(' ');
    const lastName = words[words.length - 1];
    const capitalizedLastName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
    return `/philosophers_portraits/${capitalizedLastName}.png`;
  };

  const getNpcProfileImage = (npcId: string): string => {
    if (npcId === 'Moderator' || npcId === 'moderator') {
      return moderatorInfo.profileImage;
    }
    
    const npc = npcDetails[npcId];
    if (npc && npc.portrait_url) {
      return npc.portrait_url;
    }
    // (DebateTopicModal.tsx )
    return getPhilosopherPortraitPath(npcId);
  };

  const getProfileImage = (id: string, isUser: boolean): string => {
    if (id === 'Moderator' || id === 'moderator') {
      return moderatorInfo.profileImage;
    }
    
    if (isUser) {
      if (userProfilePicture && userProfilePicture.length > 0) {
        return userProfilePicture;
      }
      return getDefaultAvatar(username);
    }
    return getNpcProfileImage(id);
  };

  const isUserParticipant = (id: string): boolean => {
    return room.participants.users.includes(id) || id === username;
  };

  const proParticipants = [...new Set(room.pro || [])];
  const conParticipants = [...new Set(room.con || [])];
  const neutralParticipants = [...new Set(room.neutral || [])];

  const isDebateRoom = room.dialogueType === 'debate';

  return (
    <div className="debate-chat-container">
      {/* Header */}
      <div className="debate-chat-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 className="debate-chat-title">{room.title}</h2>
          <button 
            onClick={onRefresh} 
            className="debate-refresh-button"
            disabled={isLoading}
          >
            <ArrowPathIcon className={`debate-refresh-icon ${isLoading ? 'spinning' : ''}`} />
          </button>
        </div>
        
        {onEndChat && (
          <button onClick={onEndChat} className="debate-end-button">
            End Conversation
          </button>
        )}
      </div>

      {/* Topic banner */}
      <div className="debate-topic-banner">
        <div className="debate-topic-sides">
          <div className="debate-side-label pro">Pro</div>
          <div className="debate-side-label neutral">Neutral</div>
          <div className="debate-side-label con">Con</div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="debate-chat-area" ref={messageContainerRef}>
        {/* Participants grid component */}
        <ParticipantGrid
          proParticipants={proParticipants}
          neutralParticipants={neutralParticipants}
          conParticipants={conParticipants}
          moderatorInfo={moderatorInfo}
          selectedNpcId={selectedNpcId}
          isUserTurn={isUserTurn}
          getNameFromId={getNameFromId}
          getProfileImage={getProfileImage}
          isUserParticipant={isUserParticipant}
        />

        {/* Message list component */}
        <MessageList
          messages={messages}
          messagesEndRef={messagesEndRef}
          isUserTurn={isUserTurn}
          typingMessageIds={activeTypingMessageIds}
          getNameFromId={getNameFromId}
          getProfileImage={getProfileImage}
          isUserParticipant={isUserParticipant}
          handleTypingComplete={activeOnTypingComplete}
          showNextButton={shouldShowNextButton(isDebateRoom, onRequestNextMessage)}
          onRequestNext={handleNextMessage}
          isGeneratingNext={isGeneratingNext}
        />
      </div>

      {/* Input area component */}
      <MessageInput
        messageText={messageText}
        setMessageText={setMessageText}
        onSubmit={handleSubmit}
        isUserTurn={displayUserTurn}
        isInputDisabled={isInputDisabled}
        inputRef={inputRef}
        isGeneratingResponse={isGeneratingResponse}
        currentUserTurn={currentUserTurn}
        waitingForUserInput={waitingForUserInput}
      />
    </div>
  );
};

export default DebateChatContainer; 