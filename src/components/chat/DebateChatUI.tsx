'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UserIcon, PaperAirplaneIcon, ArrowPathIcon, ArrowDownCircleIcon } from '@heroicons/react/24/outline';
import { ChatMessage, ChatRoom, NpcDetail } from '@/lib/ai/chatService';
import { formatTimestamp } from '@/lib/utils/dateUtils';
import { useRouter } from 'next/router';

interface DebateChatUIProps {
  room: ChatRoom;
  messages: ChatMessage[];
  npcDetails: NpcDetail[];
  onSendMessage: (message: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  isGeneratingResponse: boolean;
  username?: string;
  onEndChat?: () => void;
  userRole?: string;
  onRequestNextMessage?: () => void;
}

const DebateChatUI: React.FC<DebateChatUIProps> = ({
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
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [userProfilePicture, setUserProfilePicture] = useState<string | null>(null);
  const [npcDetails, setNpcDetails] = useState<Record<string, NpcDetail>>({});
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [isUserTurn, setIsUserTurn] = useState<boolean>(false);
  const [turnIndicatorVisible, setTurnIndicatorVisible] = useState<boolean>(false);
  const [inputDisabled, setInputDisabled] = useState<boolean>(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userSide = userRole || 'neutral';
  
  // Check if device is mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);
  
  // Load NPC details
  useEffect(() => {
    const loadNpcDetails = async () => {
      const details: Record<string, NpcDetail> = {};
      
      // 기존 npcDetails 프롭스의 NPC를 Record 형태로 변환
      if (initialNpcDetails && initialNpcDetails.length > 0) {
        initialNpcDetails.forEach(npc => {
          details[npc.id] = npc;
        });
        setNpcDetails(details);
        return;
      }
      
      // 기존 프롭스에 NPC 정보가 없는 경우 API에서 가져오기
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
  
  // Fetch user profile to get profile picture
  useEffect(() => {
    if (username) {
      fetchUserProfile(username);
    }
  }, [username]);
  
  // Fetch user profile to get profile picture
  const fetchUserProfile = async (username: string) => {
    try {
      console.log('Fetching user profile for:', username);
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const profileData = await response.json();
        console.log('Profile data received:', profileData);
        if (profileData && profileData.profileImage) {
          console.log('Setting profile image:', profileData.profileImage);
          setUserProfilePicture(profileData.profileImage);
        } else if (profileData && profileData.profilePicture) {
          console.log('Setting profile picture:', profileData.profilePicture);
          setUserProfilePicture(profileData.profilePicture);
        } else {
          console.log('No profile image found in profileData:', profileData);
        }
      } else {
        console.error('Error response from profile API:', response.status);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };
  
  // Auto-scroll to the bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Function to check if input should be disabled
  const isInputDisabled = (): boolean => {
    return !isUserTurn || isGeneratingResponse;
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only allow submission when it's the user's turn and there's text
    if (messageText.trim() && isUserTurn) {
      console.log('💬 User is submitting message:', messageText);
      
      // Disable input field immediately to prevent double submissions
      setInputDisabled(true);
      
      // Send the message - make sure to pass the entire message at once
      onSendMessage(messageText);
      
      // Clear the input field after sending
      setMessageText('');
      
      // Turn off user turn indicators
      setIsUserTurn(false);
      setTurnIndicatorVisible(false);
      
      // Wait a bit before enabling the input field again (if it's still the user's turn)
      setTimeout(() => {
        if (inputRef.current && isUserTurn) {
          setInputDisabled(false);
          inputRef.current.focus();
        }
      }, 1000);
    }
  };

  // Input field render - add prominent visual cue when it's user's turn
  const renderInputField = () => {
    return (
      <textarea
        ref={inputRef}
        value={messageText}
        onChange={(e) => setMessageText(e.target.value)}
        onKeyDown={handleKeyPress}
        placeholder={isUserTurn ? "지금은 당신의 차례입니다. 메시지를 입력하세요." : "다음 버튼을 눌러 대화를 계속하세요."}
        className={`w-full resize-none outline-none p-2 ${
          isUserTurn 
            ? "bg-white border-2 border-blue-500 animate-pulse focus:animate-none" 
            : "bg-gray-100 text-gray-500"
        }`}
        style={{
          minHeight: '60px',
          borderRadius: '12px',
          transition: 'all 0.3s ease',
          boxShadow: isUserTurn ? '0 0 8px rgba(59, 130, 246, 0.5)' : 'none'
        }}
        disabled={isInputDisabled()}
      />
    );
  };
  
  // Apply a global CSS animation for the user turn indicator
  useEffect(() => {
    // Add the animation style to the document head when it's user's turn
    if (isUserTurn && turnIndicatorVisible) {
      const styleId = 'user-turn-animation-style';
      
      // Only add if not already present
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          @keyframes userTurnPulse {
            0% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
            50% { box-shadow: 0 0 15px rgba(59, 130, 246, 0.8); }
            100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
          }
          
          .user-turn-active {
            animation: userTurnPulse 2s infinite;
            border: 2px solid #3b82f6 !important;
          }
          
          @keyframes micBounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
          }
          
          .mic-bounce {
            animation: micBounce 1s infinite;
            color: #3b82f6;
          }
        `;
        document.head.appendChild(style);
      }
      
      // Focus the input field when it's the user's turn
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
    
    // Clean up styles on unmount
    return () => {
      const styleElement = document.getElementById('user-turn-animation-style');
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, [isUserTurn, turnIndicatorVisible]);

  // Listen for next-speaker-update events from socketClient
  useEffect(() => {
    const handleNextSpeakerUpdate = (event: CustomEvent) => {
      if (event.detail && event.detail.is_user === true) {
        console.log('🎤 User turn detected from event!', event.detail);
        setIsUserTurn(true);
        setTurnIndicatorVisible(true);
        
        // Focus the input field
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 100);
      } else {
        console.log('🎤 Non-user turn detected from event', event.detail);
        setIsUserTurn(false);
        setTurnIndicatorVisible(false);
      }
    };
    
    // Add the event listener
    document.addEventListener('next-speaker-update', handleNextSpeakerUpdate as EventListener);
    
    // Clean up on unmount
    return () => {
      document.removeEventListener('next-speaker-update', handleNextSpeakerUpdate as EventListener);
    };
  }, []);
  
  // Handle key press (Enter to send)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isInputDisabled()) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };
  
  // Check if this is a debate room
  const isDebateRoom = room.dialogueType === 'debate';
  
  // Helper function to determine if the next message button should be shown
  const shouldShowNextMessageButton = () => {
    if (!isDebateRoom || !onRequestNextMessage || isGeneratingResponse) return false;
    
    // Show the button if there are messages and we're not generating a response
    return messages.length > 0;
  };
  
  // Helper to get name from ID
  const getNameFromId = (id: string, isUser: boolean): string => {
    if (isUser) {
      return username;
    }
    
    // Check if this is a custom NPC (has UUID-like format)
    const isUuid = id.includes('-') && id.split('-').length === 5;
    
    const npc = npcDetails[id];
    if (npc) {
      return npc.name;
    } else if (isUuid) {
      // If it appears to be a custom NPC ID but we don't have details yet
      return "Custom Philosopher";
    }
    
    return id;
  };
  
  // Generate default avatar URL
  const getDefaultAvatar = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=64`;
  };
  
  // Get NPC profile image
  const getNpcProfileImage = (npcId: string): string => {
    if (npcDetails[npcId] && npcDetails[npcId].portrait_url) {
      return npcDetails[npcId].portrait_url;
    }
    const displayName = getNameFromId(npcId, false);
    return getDefaultAvatar(displayName);
  };
  
  // Helper to get profile image for participants
  const getProfileImage = (id: string, isUser: boolean): string => {
    if (isUser) {
      // Use userProfilePicture state if available
      if (userProfilePicture && userProfilePicture.length > 0) {
        return userProfilePicture;
      }
      // Fallback to UI Avatars if no DB image available
      return getDefaultAvatar(username);
    }
    
    // Use getNpcProfileImage for NPCs
    return getNpcProfileImage(id);
  };
  
  // Check if an ID is actually a user
  const isUserParticipant = (id: string): boolean => {
    return id === username || room.participants.users.includes(id);
  };
  
  // Check if an ID belongs to pro, con, or neutral based on room data
  const getParticipantSide = (id: string, isUser: boolean): 'pro' | 'con' | 'neutral' | 'moderator' => {
    // 메시지에서 해당 발신자의 메시지 객체 찾기
    const msg = messages.find(m => m.sender === id);
    
    // 모더레이터 메시지 확인 (sender, isSystemMessage, role 등으로 확인)
    if (id === 'Moderator' || msg?.isSystemMessage || msg?.role === 'moderator') {
      return 'moderator';
    }
    
    // 기존 로직과 동일
    if (proParticipants.includes(id)) {
      return 'pro';
    }
    
    if (conParticipants.includes(id)) {
      return 'con';
    }
    
    return 'neutral';
  };
  
  // Separate participants by side (make them unique)
  const proParticipants = [...new Set(room.pro || [])];
  const conParticipants = [...new Set(room.con || [])];
  const neutralParticipants = [...new Set(room.neutral || [])];
  
  // Get all unique senders from messages for visibility
  const uniqueSenders = Array.from(new Set(messages.map(msg => msg.sender)));
  
  // Ensure all message senders appear in the UI even if not in pro/con/neutral lists
  uniqueSenders.forEach(sender => {
    const isInAnyList = 
      proParticipants.includes(sender) || 
      conParticipants.includes(sender) || 
      neutralParticipants.includes(sender);
    
    if (!isInAnyList) {
      // Find message to check if user
      const msg = messages.find(m => m.sender === sender);
      const isSenderUser = msg?.isUser || sender === username;
      
      // Only add to a position list if not already in any list
      if (isSenderUser) {
        // Don't add user if already exists in participants.users
        const isAlreadyInUsers = room.participants.users.some(userId => 
          userId === sender || userId === username
        );
        
        if (!isAlreadyInUsers) {
          neutralParticipants.push(sender);
        }
      } else {
        // Add NPC to neutral as fallback (only if not already included)
        neutralParticipants.push(sender);
      }
    }
  });
  
  // 모더레이터 Participants 추가 (숨김)
  const moderatorParticipants = ['Moderator'];
  
  // Initialize socket client for npc-selected events
  useEffect(() => {
    // Only initialize if we have a valid room
    if (!room || !room.id) return;
    
    const initSocket = async () => {
      try {
        // Import socketClient dynamically to avoid SSR issues
        const { default: socketClient } = await import('@/lib/socket/socketClient');
        
        // Initialize with current username or default
        const storedUsername = sessionStorage.getItem('chat_username') || username;
        const instance = await socketClient.init(storedUsername);
        
        // Join the room - ensure roomId is a number
        const roomIdNum = typeof room.id === 'string' ? parseInt(room.id) : room.id;
        console.log(`DebateChatUI: Joining room ${roomIdNum} (${typeof roomIdNum})`);
        instance.joinRoom(roomIdNum);
        
        // Add event handler for npc-selected
        instance.on('npc-selected', (data: { npc_id: string }) => {
          console.log('NPC selected for response:', data.npc_id);
          setSelectedNpcId(data.npc_id);
          
          // Auto-clear after 3 seconds
          setTimeout(() => {
            setSelectedNpcId(null);
          }, 3000);
        });
        
        // Cleanup on unmount
        return () => {
          instance.leaveRoom(roomIdNum);
          instance.off('npc-selected', () => {});
        };
      } catch (error) {
        console.error('Error initializing socket for debate UI:', error);
      }
    };
    
    initSocket();
  }, [room.id, username]);
  
  // Add styling for selected NPC
  const getProfileStyle = (id: string, side: 'pro' | 'con' | 'neutral' | 'moderator') => {
    // Base styles
    const baseStyle = {
      ...profileImageContainerStyle, 
      border: getBorderStyle(side),
      transition: 'all 0.3s ease'
    };
    
    // Add highlighted style if this NPC is currently selected
    if (selectedNpcId === id) {
      return {
        ...baseStyle,
        boxShadow: '0 0 10px 3px rgba(59, 130, 246, 0.6)',
        transform: 'scale(1.1)'
      };
    }
    
    return baseStyle;
  };
  
  // Styled components (inline styles)
  const mainContainerStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    width: '100%',
    maxWidth: '100%',
    backgroundColor: '#f9fafb'
  };
  
  const headerStyle = {
    backgroundColor: 'white',
    borderBottom: '1px solid #e5e7eb',
    padding: '16px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };
  
  const titleStyle = {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: '#111827',
    marginRight: '8px'
  };
  
  const bannerStyle = {
    backgroundImage: 'linear-gradient(to right, #dbeafe, white, #fee2e2)',
    padding: '8px 16px',
    textAlign: 'center' as const,
    borderBottom: '1px solid #e5e7eb'
  };
  
  const chatAreaStyle = {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px'
  };
  
  const participantsContainerStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px'
  };
  
  const profileContainerStyle = {
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center'
  };
  
  const profileImageContainerStyle = {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    overflow: 'hidden',
    marginBottom: '8px'
  };
  
  const profileImageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    objectPosition: 'center top' as const
  };
  
  const nameStyle = {
    fontSize: '0.875rem',
    fontWeight: '500',
    textAlign: 'center' as const,
    maxWidth: '80px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  };
  
  const roleStyle = {
    fontSize: '0.75rem',
    textAlign: 'center' as const
  };
  
  const messagesContainerStyle = {
    marginTop: '32px',
    paddingBottom: '64px'
  };
  
  const inputContainerStyle = {
    backgroundColor: 'white',
    borderTop: '1px solid #e5e7eb',
    padding: '16px'
  };
  
  // Border colors for profile images based on side
  const getBorderStyle = (side: 'pro' | 'con' | 'neutral' | 'moderator') => {
    if (side === 'pro') return '2px solid #3b82f6';
    if (side === 'con') return '2px solid #ef4444';
    if (side === 'moderator') return '2px solid #f59e0b'; // 진행자는 주황색
    return '2px solid #9ca3af';
  };
  
  // Text colors for roles based on side
  const getTextColor = (side: 'pro' | 'con' | 'neutral' | 'moderator') => {
    if (side === 'pro') return '#1d4ed8';
    if (side === 'con') return '#b91c1c';
    if (side === 'moderator') return '#b45309'; // 진행자는 주황색
    return '#4b5563';
  };
  
  useEffect(() => {
    // 초기 메시지 디버깅
    if (messages && messages.length > 0) {
      console.log(`DebateChatUI: Received ${messages.length} initial messages`);
      console.log(`First message from: ${messages[0].sender}, isUser: ${messages[0].isUser}`);
      console.log(`isSystemMessage: ${messages[0].isSystemMessage}, role: ${messages[0].role}`);
      console.log(`Message text: ${messages[0].text.substring(0, 100)}...`);
      console.log(`Full first message:`, messages[0]);
      console.log(`Message contains 초기메시지에용: ${messages[0].text.includes('초기메시지에용')}`);
      
      // Moderator 메시지가 있는지 확인
      const moderatorMsg = messages.find(msg => 
        msg.sender === 'Moderator' || 
        msg.isSystemMessage === true || 
        msg.role === 'moderator'
      );
      
      if (moderatorMsg) {
        console.log(`✅ Moderator message found: ${moderatorMsg.text.substring(0, 100)}...`);
        console.log(`Moderator message details:`, {
          sender: moderatorMsg.sender,
          isSystemMessage: moderatorMsg.isSystemMessage,
          role: moderatorMsg.role,
          text: moderatorMsg.text
        });
      } else {
        console.log(`❌ No moderator message found in messages array`);
      }
    } else {
      console.log(`DebateChatUI: No initial messages`);
    }
  }, [messages]);
  
  // 메시지 답장 핸들러 함수
  const handleReplyToMessage = (message: ChatMessage) => {
    // 현재 구현에서는 실제로 답장 기능은 없으므로 로그만 남김
    console.log("Reply to message:", message);
  };
  
  // Helper function to get sender name from ID using NPC details
  const getSenderName = (senderId: string, npcDetails: Record<string, NpcDetail>): string => {
    if (!npcDetails) return senderId;
    
    // Check if this is a custom NPC (has UUID-like format)
    const isUuid = senderId.includes('-') && senderId.split('-').length === 5;
    
    const npc = npcDetails[senderId];
    if (npc) {
      return npc.name;
    } else if (isUuid) {
      // If it appears to be a custom NPC ID but we don't have details yet
      return "Custom Philosopher";
    }
    
    return senderId;
  };
  
  // 대화 분석 함수 추가 - 현재 메시지 분석하여 다음 발언자 파악
  useEffect(() => {
    if (!messages || messages.length === 0 || !room) return;
    
    // 디베이트 모드에서만 작동
    if (room.dialogueType !== 'debate') return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;
    
    console.log('Last message sender:', lastMessage.sender, 'Role:', lastMessage.role);
    console.log('User info - username:', username, 'userRole:', userRole);
    
    // 모더레이터 메시지 검사
    if (lastMessage.role === 'moderator' || lastMessage.sender === 'Moderator') {
      console.log('Moderator message detected, checking for next speaker cues');
      
      // 메시지 텍스트에서 다음 발언자 추출 시도 (한글/영어 패턴 모두 지원)
      const nextSpeakerPattern = /먼저\s+(.+?)\s+측에서|먼저\s+(.+?)\s+님께서|다음은\s+(.+?)\s+측에서|이제\s+(.+?)\s+님의\s+차례|next\s+speaker\s+is\s+(.+?)\s|it's\s+(.+?)'s\s+turn|pro\s+side|con\s+side|user/i;
      const match = lastMessage.text.match(nextSpeakerPattern);
      
      if (match) {
        // 가능한 모든 캡처 그룹에서 비어있지 않은 첫 번째 그룹 선택
        const nextSpeaker = match[1] || match[2] || match[3] || match[4] || match[5] || match[6] || '';
        console.log(`🎯 모더레이터가 다음 발언자로 지목: "${nextSpeaker}"`);
        
        // 다양한 방식으로 사용자 관련 언급 확인
        const isUserMentioned = 
          nextSpeaker.toLowerCase().includes('user') || 
          nextSpeaker.toLowerCase().includes('you') || 
                                (username && nextSpeaker.toLowerCase().includes(username.toLowerCase())) ||
                                nextSpeaker.toLowerCase().includes('neutral') ||
          nextSpeaker.toLowerCase().includes(userSide.toLowerCase()) ||
          nextSpeaker.toLowerCase().includes('pro') && userRole === 'pro' ||
          nextSpeaker.toLowerCase().includes('con') && userRole === 'con';
        
        console.log(`사용자 언급 확인: ${isUserMentioned}, 사용자 역할: ${userRole}`);
        setIsUserTurn(isUserMentioned);
        
        if (isUserMentioned) {
          console.log('🎤 현재 사용자의 발언 차례입니다!');
          // 깜빡임 효과 활성화
          setTurnIndicatorVisible(true);
          
          // 입력창으로 포커스
          if (inputRef.current) {
            inputRef.current.focus();
          }
          
          // 깜빡임 효과 (3번 깜빡임)
          let blinkCount = 0;
          const blinkInterval = setInterval(() => {
            setTurnIndicatorVisible(prev => !prev);
            blinkCount++;
            
            if (blinkCount >= 6) { // 3번 깜빡임 (켜짐/꺼짐 각각 1회로 계산)
              clearInterval(blinkInterval);
              setTurnIndicatorVisible(true); // 최종적으로 표시 유지
            }
          }, 500);
          
          return () => clearInterval(blinkInterval);
        }
      } else {
        // 정규식 매치가 없는 경우도 프로/콘 언급 확인
        const hasPro = lastMessage.text.toLowerCase().includes('pro') || lastMessage.text.toLowerCase().includes('찬성');
        const hasCon = lastMessage.text.toLowerCase().includes('con') || lastMessage.text.toLowerCase().includes('반대');
        
        if (hasPro && userRole === 'pro') {
          console.log('Pro side mentioned and user is Pro - setting user turn');
          setIsUserTurn(true);
          setTurnIndicatorVisible(true);
          if (inputRef.current) inputRef.current.focus();
        } else if (hasCon && userRole === 'con') {
          console.log('Con side mentioned and user is Con - setting user turn');
          setIsUserTurn(true);
          setTurnIndicatorVisible(true);
          if (inputRef.current) inputRef.current.focus();
        }
      }
    }
    
    // 마지막 API 발언자가 "next_speaker"로 사용자를 지정한 경우
    // 이 정보는 일반적으로 소켓이나 API 응답으로 받을 수 있음
    const lastSpeakerData = window.localStorage.getItem('lastNextSpeakerData');
    if (lastSpeakerData) {
      try {
        const speakerData = JSON.parse(lastSpeakerData);
        if (speakerData.speaker_id === username || 
            speakerData.speaker_id === 'You' || 
            speakerData.speaker_id === 'User123') {
          console.log('Next speaker data indicates it is user turn');
          setIsUserTurn(true);
          setTurnIndicatorVisible(true);
        }
      } catch (e) {
        console.error('Error parsing last speaker data:', e);
      }
    }
    
    // 일반 메시지 분석 - 마지막 발언이 반대측이면 사용자가 찬성측인 경우 사용자 차례
    if (room.pro && room.con) {
      const lastSender = lastMessage.sender;
      const isLastMessageFromCon = room.con.includes(lastSender);
      const isLastMessageFromPro = room.pro.includes(lastSender);
      const isUserPro = room.pro.includes(username || '');
      const isUserCon = room.con.includes(username || '');
      
      console.log(`Last message analysis - Sender: ${lastSender}, FromCon: ${isLastMessageFromCon}, FromPro: ${isLastMessageFromPro}`);
      console.log(`User position - Pro: ${isUserPro}, Con: ${isUserCon}`);
      
      // 사용자가 찬성측이고 마지막 메시지가 반대측인 경우
      if (isUserPro && isLastMessageFromCon) {
        console.log('User is Pro and last message is from Con - setting user turn');
        setIsUserTurn(true);
        setTurnIndicatorVisible(true);
        if (inputRef.current) inputRef.current.focus();
      } 
      // 사용자가 반대측이고 마지막 메시지가 찬성측인 경우
      else if (isUserCon && isLastMessageFromPro) {
        console.log('User is Con and last message is from Pro - setting user turn');
        setIsUserTurn(true);
        setTurnIndicatorVisible(true);
        if (inputRef.current) inputRef.current.focus();
      } else {
        console.log('Not user turn based on message analysis');
        setIsUserTurn(false);
        setTurnIndicatorVisible(false);
      }
    }
  }, [messages, room, username, userRole, userSide]);
  
  // CSS 애니메이션을 위한 스타일 추가
  useEffect(() => {
    // 전역 스타일 추가
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @keyframes userTurnInput {
        0%, 100% { box-shadow: 0 0 8px rgba(59, 130, 246, 0.7); }
        50% { box-shadow: 0 0 20px rgba(59, 130, 246, 1); }
      }
      
      @keyframes userTurnProfile {
        0% { transform: scale(1.1); box-shadow: 0 0 12px 4px rgba(59, 130, 246, 0.7); }
        50% { transform: scale(1.2); box-shadow: 0 0 20px 10px rgba(59, 130, 246, 1); }
        100% { transform: scale(1.1); box-shadow: 0 0 12px 4px rgba(59, 130, 246, 0.7); }
      }
      
      @keyframes speakingIndicator {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      .user-turn-input-focus {
        border: 2px solid #3b82f6 !important;
        box-shadow: 0 0 15px rgba(59, 130, 246, 0.7) !important;
        animation: userTurnInput 2s infinite !important;
        background-color: #f0f9ff !important;
        font-weight: 500 !important;
        transform: scale(1.03) !important;
        transition: all 0.3s ease !important;
      }
      
      .user-turn-profile {
        animation: userTurnProfile 1.5s infinite !important;
      }
      
      .user-turn-alert {
        animation: speakingIndicator 2s infinite !important;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1) !important;
      }
      
      .mic-icon-bounce {
        display: inline-block;
        animation: bounce 1s infinite ease-in-out !important;
      }
    `;
    document.head.appendChild(styleEl);
    
    // Clean up
    return () => {
      document.head.removeChild(styleEl);
  };
  }, []);
  
  return (
    <div style={mainContainerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 style={titleStyle}>{room.title}</h2>
          <button 
            onClick={onRefresh} 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer'
            }}
            disabled={isLoading}
          >
            <ArrowPathIcon style={{ 
              height: '16px', 
              width: '16px', 
              color: '#6b7280',
              animation: isLoading ? 'spin 1s linear infinite' : 'none'
            }} />
          </button>
        </div>
        
        {onEndChat && (
          <button 
            onClick={onEndChat}
            style={{
              padding: '4px 12px',
              fontSize: '0.75rem',
              backgroundColor: '#ef4444',
              color: 'white',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            End Conversation
          </button>
        )}
      </div>
      
      {/* Topic Banner */}
      <div style={bannerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: '33%', textAlign: 'left', color: '#1d4ed8', fontWeight: 500 }}>Pro</div>
          <div style={{ width: '33%', color: '#4b5563', fontWeight: 500 }}>Neutral</div>
          <div style={{ width: '33%', textAlign: 'right', color: '#dc2626', fontWeight: 500 }}>Con</div>
        </div>
      </div>
      
      {/* Main chat area */}
      <div 
        style={chatAreaStyle}
        ref={messageContainerRef}
      >
        <div style={participantsContainerStyle}>
          {/* Pro Side (Left) */}
          <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: '16px' }}>
            {proParticipants.map(id => {
              const isUser = isUserParticipant(id);
              const name = getNameFromId(id, isUser);
              const avatar = getProfileImage(id, isUser);
              
              return (
                <div key={`pro-${id}`} style={profileContainerStyle}>
                  <div style={{ 
                    ...getProfileStyle(id, 'pro'),
                    // 사용자의 차례이고 사용자가 이 참가자인 경우 하이라이트
                    ...(isUserTurn && isUser ? {
                      boxShadow: '0 0 20px 8px rgba(59, 130, 246, 0.9)',
                      transform: 'scale(1.2)',
                      border: '3px solid #3b82f6'
                    } : {})
                  }}
                    className={isUserTurn && isUser ? 'user-turn-profile' : ''}
                  >
                    <img 
                      src={avatar} 
                      alt={name}
                      style={profileImageStyle}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getDefaultAvatar(name);
                      }}
                    />
                  </div>
                  <div style={{ ...nameStyle, color: getTextColor('pro') }}>{name}</div>
                  <div style={{ ...roleStyle, color: '#3b82f6' }}>Pro</div>
                </div>
              );
            })}
          </div>
          
          {/* Neutral (Center) */}
          <div style={{ borderRight: '1px solid #e5e7eb', padding: '0 8px' }}>
            {neutralParticipants.map(id => {
              const isUser = isUserParticipant(id);
              const name = getNameFromId(id, isUser);
              const avatar = getProfileImage(id, isUser);
              
              return (
                <div key={`neutral-${id}`} style={profileContainerStyle}>
                  <div style={{ 
                    ...getProfileStyle(id, 'neutral'),
                    // 사용자의 차례이고 사용자가 이 참가자인 경우 하이라이트
                    ...(isUserTurn && isUser ? {
                      boxShadow: '0 0 20px 8px rgba(59, 130, 246, 0.9)',
                      transform: 'scale(1.2)',
                      border: '3px solid #3b82f6'
                    } : {})
                  }}
                    className={isUserTurn && isUser ? 'user-turn-profile' : ''}
                  >
                    <img 
                      src={avatar} 
                      alt={name}
                      style={profileImageStyle}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getDefaultAvatar(name);
                      }}
                    />
                  </div>
                  <div style={{ ...nameStyle, color: getTextColor('neutral') }}>{name}</div>
                  <div style={{ ...roleStyle, color: '#6b7280' }}>Neutral</div>
                </div>
              );
            })}
          </div>
          
          {/* Con Side (Right) */}
          <div style={{ paddingLeft: '16px' }}>
            {conParticipants.map(id => {
              const isUser = isUserParticipant(id);
              const name = getNameFromId(id, isUser);
              const avatar = getProfileImage(id, isUser);
              
              return (
                <div key={`con-${id}`} style={profileContainerStyle}>
                  <div style={{ 
                    ...getProfileStyle(id, 'con'),
                    // 사용자의 차례이고 사용자가 이 참가자인 경우 하이라이트
                    ...(isUserTurn && isUser ? {
                      boxShadow: '0 0 20px 8px rgba(59, 130, 246, 0.9)',
                      transform: 'scale(1.2)',
                      border: '3px solid #3b82f6'
                    } : {})
                  }}
                    className={isUserTurn && isUser ? 'user-turn-profile' : ''}
                  >
                    <img 
                      src={avatar} 
                      alt={name}
                      style={profileImageStyle}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getDefaultAvatar(name);
                      }}
                    />
                  </div>
                  <div style={{ ...nameStyle, color: getTextColor('con') }}>{name}</div>
                  <div style={{ ...roleStyle, color: '#ef4444' }}>Con</div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Messages */}
        <div style={messagesContainerStyle}>
          {messages.filter(msg => msg.text && msg.text.trim() !== '').map((message, index) => {
            // Determine if message is from the user
            const isUser = message.isUser || 
                          message.sender === 'User' || 
                          message.sender === 'User123' || 
                          message.sender === username || 
                          (room.participants.users && room.participants.users.includes(message.sender));
            
            const sender = message.sender;
            const name = isUser ? username : getNameFromId(sender, isUser);
            const avatar = getProfileImage(sender, isUser);
            
            // Important: For user messages, use the userRole prop to ensure correct placement
            let side = getParticipantSide(sender, isUser);
            if (isUser && userRole) {
              side = userRole as 'pro' | 'con' | 'neutral' | 'moderator';
            }
            
            // For messages with a role field, prioritize that over other detection methods
            if (message.role && ['pro', 'con', 'neutral', 'moderator'].includes(message.role)) {
              side = message.role as 'pro' | 'con' | 'neutral' | 'moderator';
            }
            
            // 진행자 메시지 특별 스타일
            const isModerator = side === 'moderator' || 
                                sender === 'Moderator' || 
                                message.isSystemMessage === true || 
                                message.role === 'moderator';
            
            const messageContainerStyle = {
              display: 'flex',
              justifyContent: isModerator ? 'center' : (side === 'pro' ? 'flex-start' : side === 'con' ? 'flex-end' : 'center'),
              alignItems: 'flex-start',
              gap: '8px',
              maxWidth: '100%',
              marginBottom: '16px'
            };
            
            // Use message ID as key if available, otherwise fall back to index but with a unique prefix based on sender
            const messageKey = message.id ? `msg-${message.id}` : `msg-${sender}-${index}-${Date.now()}`;
            
            // 하드코딩된 메시지 체크 (테스트용)
            const hasHardcodedText = message.text && message.text.includes('초기메시지에용');
            
            // 모더레이터는 다른 스타일 적용
            const messageBubbleStyle = isModerator 
              ? {
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: '#fffbeb', // 옅은 주황색 배경
                color: '#92400e', // 갈색 글자
                border: '1px solid #fcd34d', // 주황색 테두리
                borderLeft: '4px solid #f59e0b', // 진한 주황색 왼쪽 테두리
                display: 'inline-block',
                maxWidth: '80%',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                textAlign: 'left' as const
              }
              : {
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: side === 'pro' ? '#dbeafe' : side === 'con' ? '#fee2e2' : '#f3f4f6',
                color: side === 'pro' ? '#1e40af' : side === 'con' ? '#991b1b' : '#1f2937',
                display: 'inline-block'
              };

            // 진행자 메시지에 특별 스타일 추가 (테스트용)
            if (isModerator && hasHardcodedText) {
              messageBubbleStyle.backgroundColor = '#e0f2fe'; // 밝은 파란색 배경
              messageBubbleStyle.color = '#0369a1'; // 파란색 글자
              messageBubbleStyle.border = '1px solid #7dd3fc'; // 파란색 테두리
              messageBubbleStyle.borderLeft = '4px solid #0ea5e9'; // 진한 파란색 왼쪽 테두리
            }
            
            const avatarContainerStyle = {
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              overflow: 'hidden',
              flexShrink: 0,
              marginTop: '4px'
            };
            
            // 진행자는 항상 둥근 경계 유지
            if (!isModerator) {
              // Customize border radius based on side
              if (side === 'pro') {
                messageBubbleStyle.borderRadius = '0 12px 12px 12px';
              } else if (side === 'con') {
                messageBubbleStyle.borderRadius = '12px 0 12px 12px';
              }
            }
            
            return (
              <div key={messageKey} style={messageContainerStyle}>
                {(side !== 'con' || isModerator) && (
                  <div style={{
                    ...avatarContainerStyle,
                    border: getBorderStyle(isModerator ? 'moderator' : side)
                  }}>
                    <img 
                      src={avatar}
                      alt={name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getDefaultAvatar(name);
                      }}
                    />
                  </div>
                )}
                
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: isModerator ? 'center' : (side === 'con' ? 'flex-end' : 'flex-start'),
                  maxWidth: isModerator ? '80%' : '70%'
                }}>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: isModerator ? '#92400e' : '#6b7280', 
                    marginBottom: '4px',
                    fontWeight: isModerator ? 'bold' : 'normal'
                  }}>
                    {isModerator ? '📣 Moderator' : (isUser ? username : name)}
                  </div>
                  <div style={messageBubbleStyle}>
                    <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.text}</p>
                    
                    {/* 하드코딩된 메시지 체크 표시 (테스트용) */}
                    {isModerator && (
                      <div style={{ fontSize: '0.75rem', marginTop: '8px', color: '#6b7280' }}>
                        {hasHardcodedText ? '✅ 하드코딩된 메시지가 표시됨' : '❌ 하드코딩된 메시지 없음'}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
                
                {side === 'con' && !isModerator && (
                  <div style={{
                    ...avatarContainerStyle,
                    border: getBorderStyle(side)
                  }}>
                    <img 
                      src={avatar}
                      alt={name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getDefaultAvatar(name);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          
          {isGeneratingResponse && (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
              <div style={{ 
                backgroundColor: '#f3f4f6',
                padding: '8px 16px',
                borderRadius: '16px',
                color: '#6b7280',
                animation: 'pulse 2s infinite'
              }}>
                Generating response...
              </div>
            </div>
          )}
          
          {/* 사용자 차례 알림 표시 */}
          {isUserTurn && turnIndicatorVisible && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              margin: '20px 0'
            }}>
              <div 
                className="user-turn-alert"
                style={{ 
                  backgroundColor: '#e0f2fe',
                  padding: '15px 25px',
                  borderRadius: '16px',
                  color: '#0369a1',
                  border: '2px solid #7dd3fc',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  maxWidth: '90%'
                }}
              >
                <span className="mic-icon-bounce" style={{ fontSize: '1.75rem' }}>🎤</span>
                <span>지금은 당신의 발언 차례입니다!</span>
              </div>
            </div>
          )}
          
          {/* Next message button for debate mode */}
          {shouldShowNextMessageButton() && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              marginTop: '16px', 
              marginBottom: '16px' 
            }}>
              <button
                onClick={onRequestNextMessage}
                disabled={isGeneratingResponse}
                style={{ 
                  backgroundColor: isGeneratingResponse ? '#d1d5db' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '9999px',
                  width: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isGeneratingResponse ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => {
                  if (!isGeneratingResponse) {
                    e.currentTarget.style.transform = 'translateY(2px)';
                    e.currentTarget.style.boxShadow = '0 2px 4px -1px rgba(0, 0, 0, 0.1)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isGeneratingResponse) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                  }
                }}
              >
                <ArrowDownCircleIcon width={24} height={24} />
              </button>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Input area */}
      <div style={{
        ...inputContainerStyle,
        ...(isUserTurn ? {
          boxShadow: '0 -10px 15px -3px rgba(59, 130, 246, 0.1)',
          padding: '16px',
          borderTop: '2px solid #3b82f6',
          backgroundColor: '#f0f9ff',
          transition: 'all 0.3s ease'
        } : {})
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
          {renderInputField()}
          <button
            type="submit"
            disabled={!messageText.trim() || isInputDisabled()}
            style={{
              backgroundColor: !messageText.trim() || isInputDisabled() ? '#93c5fd' : '#2563eb',
              color: 'white',
              borderRadius: '9999px',
              width: '40px',
              height: '40px',
              border: 'none',
              cursor: !messageText.trim() || isInputDisabled() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !messageText.trim() || isInputDisabled() ? 0.7 : 1,
              transition: 'all 0.3s ease',
              transform: isUserTurn && messageText.trim() ? 'scale(1.1)' : 'scale(1)',
              boxShadow: isUserTurn && messageText.trim() ? '0 0 10px rgba(59, 130, 246, 0.7)' : 'none',
              animation: isUserTurn && messageText.trim() ? 'pulse 1.5s infinite' : 'none'
            }}
          >
            <PaperAirplaneIcon style={{ height: '20px', width: '20px' }} />
          </button>
        </form>
        
        {/* Show a message indicating it's not user's turn */}
        {!isUserTurn && !isGeneratingResponse && (
          <div style={{
            textAlign: 'center',
            fontSize: '0.85rem',
            color: '#6b7280',
            marginTop: '8px'
          }}>
            현재 다른 참가자의 발언 차례입니다. 당신의 차례가 되면 알려드립니다.
        </div>
      )}
      </div>
    </div>
  );
};

export default DebateChatUI; 