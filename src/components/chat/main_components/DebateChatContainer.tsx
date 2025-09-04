'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useSocketConnection } from '../main_hooks/useSocketConnection';
import { useDebateState } from '../main_hooks/useDebateState';
import MessageInput from './MessageInput';
import ParticipantGrid from './ParticipantGrid';
import MessageList from './MessageList';
import { DebateChatContainerProps, ChatMessage, ParticipantInfo } from '../main_types/debate.types';
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
  // 모더레이터 스타일 정보 매핑
  const moderatorStyles = [
    { id: '0', name: 'Jamie the Host' },
    { id: '1', name: 'Dr. Lee' },
    { id: '2', name: 'Zuri Show' },
    { id: '3', name: 'Elias of the End' },
    { id: '4', name: 'Miss Hana' }
  ];

  const [messageText, setMessageText] = useState('');
  const [userProfilePicture, setUserProfilePicture] = useState<string | null>(null);
  const [npcDetails, setNpcDetails] = useState<Record<string, any>>({});
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [isUserTurn, setIsUserTurn] = useState<boolean>(false);
  const [turnIndicatorVisible, setTurnIndicatorVisible] = useState<boolean>(false);
  const [isGeneratingNext, setIsGeneratingNext] = useState<boolean>(false);
  
  // 타이핑 애니메이션을 위한 상태
  const [lastMessageCount, setLastMessageCount] = useState<number>(0);
  const [typingMessageIds, setTypingMessageIds] = useState<Set<string>>(new Set());
  
  // 타이핑 완료 핸들러
  const handleTypingComplete = (messageId: string) => {
    setTypingMessageIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      return newSet;
    });
  };
  
  // 외부 props 우선 사용
  const activeTypingMessageIds = externalTypingMessageIds || typingMessageIds;
  const activeOnTypingComplete = externalOnTypingComplete || handleTypingComplete;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 모더레이터 정보 가져오기
  const getModeratorInfo = useMemo(() => {
    const moderatorConfig = (room as any).moderator;
    
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

  // 사용자 프로필 가져오기
  const fetchUserProfile = async (username: string) => {
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const profileData = await response.json();
        if (profileData && (profileData.profileImage || profileData.profilePicture)) {
          setUserProfilePicture(profileData.profileImage || profileData.profilePicture);
        }
      }
    } catch (error: any) {
      loggers.auth.error('사용자 프로필 가져오기 실패', error);
    }
  };

  // NPC 세부 정보 로드
  useEffect(() => {
    const loadNpcDetails = async () => {
      const details: Record<string, any> = {};
      
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
        // API 호출 제거 - 기본 NPC 정보 생성
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

  // 사용자 프로필 가져오기
  useEffect(() => {
    if (username) {
      fetchUserProfile(username);
    }
  }, [username]);

  // 메시지 자동 스크롤
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 새 메시지 타이핑 애니메이션 감지
  useEffect(() => {
    if (messages.length > lastMessageCount) {
      const newMessages = messages.slice(lastMessageCount);
      const newTypingIds = new Set(typingMessageIds);
      
      newMessages.forEach(message => {
        const isUser = room.participants.users.includes(message.sender) || message.sender === username;
        // skipAnimation이 true인 경우 (새로고침으로 로드된 메시지) 타이핑 애니메이션 스킵
        if (!isUser && !message.id.startsWith('temp-waiting-') && !message.skipAnimation) {
          newTypingIds.add(message.id);
        }
      });
      
      setTypingMessageIds(newTypingIds);
      setLastMessageCount(messages.length);
    }
  }, [messages.length, lastMessageCount, typingMessageIds, room.participants.users, username]);

  // 사용자 차례일 때 입력창에 포커스
  useEffect(() => {
    if (waitingForUserInput && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        loggers.ui.info('사용자 턴에서 입력창 자동 포커스');
      }, 300); // 약간의 지연을 주어 렌더링 완료 후 포커스
    }
  }, [waitingForUserInput]);

  // 메시지 전송 핸들러
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim() && !isInputDisabled) {
      // 사용자 차례인 경우 onProcessUserMessage 사용
      if (waitingForUserInput && currentUserTurn && onProcessUserMessage) {
        loggers.chat.info('사용자 메시지를 onProcessUserMessage로 처리', { 
          messageLength: messageText.trim().length,
          userTurn: currentUserTurn 
        });
        onProcessUserMessage(messageText.trim());
      } else {
        // 일반적인 경우 기존 로직 사용
        loggers.chat.info('메시지를 onSendMessage로 전송', { 
          messageLength: messageText.trim().length 
        });
        onSendMessage(messageText.trim());
      }
      setMessageText('');
    }
  };

  // Next 메시지 요청 핸들러
  const handleNextMessage = async () => {
    if (isGeneratingNext || !onRequestNextMessage) return;
    
    setIsGeneratingNext(true);
    loggers.chat.info(`Next 버튼 클릭 - 방에 대한 다음 메시지 요청`, { roomId: room.id });
    
    try {
      await onRequestNextMessage();
    } catch (error) {
      loggers.chat.error('Next 메시지 요청 중 오류', error);
    } finally {
      setIsGeneratingNext(false);
    }
  };

  // Helper functions
  const setUserTurn = (turn: boolean, visible: boolean) => {
    setIsUserTurn(turn);
    setTurnIndicatorVisible(visible);
  };

  // 입력 상태 계산 - 사용자 차례이거나 일반 채팅일 때 활성화
  const isInputDisabled = isLoading || isGeneratingResponse || 
    !(waitingForUserInput || (isUserTurn && !waitingForUserInput));

  // 사용자 차례 표시 로직 개선
  const displayUserTurn = waitingForUserInput || isUserTurn;
  const shouldShowNextButton = (
    isDebateRoom: boolean,
    onRequestNextMessage: any,
    messagesLength: number
  ) => {
    // Next 버튼을 항상 표시 (토론방이고 함수가 있으면)
    return isDebateRoom && onRequestNextMessage;
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

  // Generate philosopher portrait path from static files (DebateTopicModal.tsx와 동일한 함수)
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
    // 철학자 포트레이트 경로 사용 (DebateTopicModal.tsx와 동일)
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

  // 참가자 분류
  const proParticipants = [...new Set(room.pro || [])];
  const conParticipants = [...new Set(room.con || [])];
  const neutralParticipants = [...new Set(room.neutral || [])];

  // 디베이트 룸 여부 확인
  const isDebateRoom = room.dialogueType === 'debate';

  return (
    <div className="debate-chat-container">
      {/* 헤더 */}
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

      {/* 토픽 배너 */}
      <div className="debate-topic-banner">
        <div className="debate-topic-sides">
          <div className="debate-side-label pro">Pro</div>
          <div className="debate-side-label neutral">Neutral</div>
          <div className="debate-side-label con">Con</div>
        </div>
      </div>

      {/* 메인 채팅 영역 */}
      <div className="debate-chat-area" ref={messageContainerRef}>
        {/* 참가자 그리드 컴포넌트 */}
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

        {/* 메시지 리스트 컴포넌트 */}
        <MessageList
          messages={messages}
          messagesEndRef={messagesEndRef}
          isUserTurn={isUserTurn}
          typingMessageIds={activeTypingMessageIds}
          getNameFromId={getNameFromId}
          getProfileImage={getProfileImage}
          isUserParticipant={isUserParticipant}
          handleTypingComplete={activeOnTypingComplete}
          showNextButton={shouldShowNextButton(isDebateRoom, onRequestNextMessage, messages.length)}
          onRequestNext={handleNextMessage}
          isGeneratingNext={isGeneratingNext}
        />
      </div>

      {/* 입력 영역 컴포넌트 */}
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