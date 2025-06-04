'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useSocketConnection } from './hooks/useSocketConnection';
import { useDebateState } from './hooks/useDebateState';
import MessageInput from './components/MessageInput';
import ParticipantGrid from './components/ParticipantGrid';
import MessageList from './components/MessageList';
import { DebateChatContainerProps } from './types/debate.types';

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
  onRequestNextMessage
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 모더레이터 정보 가져오기
  const getModeratorInfo = () => {
    const moderatorConfig = (room as any).moderator;
    if (moderatorConfig && moderatorConfig.style_id) {
      const style = moderatorStyles.find(s => s.id === moderatorConfig.style_id);
      return {
        name: style?.name || 'Jamie the Host',
        profileImage: `/portraits/Moderator${moderatorConfig.style_id}.png`
      };
    }
    return {
      name: 'Jamie the Host',
      profileImage: '/portraits/Moderator0.png'
    };
  };

  const moderatorInfo = getModeratorInfo();

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
      console.error('Error fetching user profile:', error);
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
        try {
          const response = await fetch(`/api/npc/get?id=${encodeURIComponent(npcId)}`);
          if (response.ok) {
            const npcDetail = await response.json();
            details[npcId] = npcDetail;
          }
        } catch (error) {
          console.error(`Error loading NPC details for ${npcId}:`, error);
        }
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
        if (!isUser && !message.id.startsWith('temp-waiting-')) {
          newTypingIds.add(message.id);
        }
      });
      
      setTypingMessageIds(newTypingIds);
      setLastMessageCount(messages.length);
    }
  }, [messages.length, lastMessageCount, typingMessageIds, room.participants.users, username]);

  // 타이핑 완료 핸들러
  const handleTypingComplete = (messageId: string) => {
    setTypingMessageIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      return newSet;
    });
  };

  // 메시지 전송 핸들러
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (messageText.trim() && isUserTurn) {
      console.log('User is submitting message:', messageText);
      
      onSendMessage(messageText);
      setMessageText('');
      setUserTurn(false, false);
      
      setTimeout(() => {
        if (inputRef.current && isUserTurn) {
          inputRef.current.focus();
        }
      }, 1000);
    }
  };

  // Next 메시지 요청 핸들러
  const handleNextMessage = async () => {
    if (isGeneratingNext || !onRequestNextMessage) return;
    
    setIsGeneratingNext(true);
    console.log(`Next 버튼 클릭 - 방 ${room.id}에 대한 다음 메시지 요청`);
    
    try {
      await onRequestNextMessage();
    } catch (error) {
      console.error('Next 메시지 요청 중 오류:', error);
    } finally {
      setIsGeneratingNext(false);
    }
  };

  // Helper functions
  const setUserTurn = (turn: boolean, visible: boolean) => {
    setIsUserTurn(turn);
    setTurnIndicatorVisible(visible);
  };

  const shouldShowNextMessageButton = (
    isDebateRoom: boolean,
    onRequestNextMessage: any,
    messagesLength: number
  ) => {
    if (!isDebateRoom || !onRequestNextMessage || isGeneratingResponse) return false;
    // 토론방에서는 항상 Next 버튼 표시 (메시지 개수 무관)
    return true;
  };

  const isInputDisabled = !isUserTurn || isGeneratingResponse;

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

  const getNpcProfileImage = (npcId: string): string => {
    if (npcId === 'Moderator' || npcId === 'moderator') {
      return moderatorInfo.profileImage;
    }
    
    const npc = npcDetails[npcId];
    if (npc && npc.portrait_url) {
      return npc.portrait_url;
    }
    return `/portraits/${npcId}.png`;
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
          typingMessageIds={typingMessageIds}
          getNameFromId={getNameFromId}
          getProfileImage={getProfileImage}
          isUserParticipant={isUserParticipant}
          handleTypingComplete={handleTypingComplete}
          showNextButton={shouldShowNextMessageButton(isDebateRoom, onRequestNextMessage, messages.length)}
          onRequestNext={handleNextMessage}
          isGeneratingNext={isGeneratingNext}
        />
      </div>

      {/* 입력 영역 컴포넌트 */}
      <MessageInput
        messageText={messageText}
        setMessageText={setMessageText}
        onSubmit={handleSubmit}
        isUserTurn={isUserTurn}
        isInputDisabled={isInputDisabled}
        inputRef={inputRef}
        isGeneratingResponse={isGeneratingResponse}
      />
    </div>
  );
};

export default DebateChatContainer; 