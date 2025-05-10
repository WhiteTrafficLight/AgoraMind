'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UserIcon, PaperAirplaneIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { ChatMessage, ChatRoom, NpcDetail } from '@/lib/ai/chatService';
import { formatTimestamp } from '@/lib/utils/dateUtils';

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
  onEndChat
}) => {
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [userProfilePicture, setUserProfilePicture] = useState<string | null>(null);
  const [npcDetails, setNpcDetails] = useState<Record<string, NpcDetail>>({});
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  
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
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim()) {
      onSendMessage(messageText);
      setMessageText('');
    }
  };
  
  // Helper to get name from ID
  const getNameFromId = (id: string, isUser: boolean): string => {
    if (isUser) {
      return username;
    }
    
    const npc = npcDetails[id];
    return npc ? npc.name : id;
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
    // 진행자인 경우 "moderator" 반환
    if (id === 'Moderator') {
      return 'moderator';
    }
    
    if (room.pro && room.pro.includes(id)) {
      return 'pro';
    } else if (room.con && room.con.includes(id)) {
      return 'con';
    } else {
      return 'neutral';
    }
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
      console.log(`Message text: ${messages[0].text.substring(0, 50)}...`);
      
      // Moderator 메시지가 있는지 확인
      const moderatorMsg = messages.find(msg => msg.sender === 'Moderator');
      if (moderatorMsg) {
        console.log(`✅ Moderator message found: ${moderatorMsg.text.substring(0, 50)}...`);
      } else {
        console.log(`⚠️ No Moderator message found in ${messages.length} messages`);
        
        // 모든 메시지 발신자 디버깅
        console.log(`Message senders: ${messages.map(m => m.sender).join(', ')}`);
      }
    } else {
      console.log(`DebateChatUI: No initial messages`);
    }
  }, [messages]);
  
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
                    ...getProfileStyle(id, 'pro') 
                  }}>
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
                    ...getProfileStyle(id, 'neutral')
                  }}>
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
                    ...getProfileStyle(id, 'con')
                  }}>
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
          {messages.map((message, index) => {
            const isUser = message.isUser || isUserParticipant(message.sender);
            const sender = message.sender;
            const name = getNameFromId(sender, isUser);
            const avatar = getProfileImage(sender, isUser);
            const side = getParticipantSide(sender, isUser);
            
            // 진행자 메시지 특별 스타일
            const isModerator = side === 'moderator' || sender === 'Moderator';
            
            const messageContainerStyle = {
              display: 'flex',
              justifyContent: isModerator ? 'center' : (side === 'pro' ? 'flex-start' : side === 'con' ? 'flex-end' : 'center'),
              alignItems: 'flex-start',
              gap: '8px',
              maxWidth: '100%',
              marginBottom: '16px'
            };
            
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
              <div key={`msg-${index}`} style={messageContainerStyle}>
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
                    {isModerator ? '📣 Moderator' : name}
                  </div>
                  <div style={messageBubbleStyle}>
                    <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.text}</p>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
                
                {side === 'con' && !isModerator && (
                  <div style={avatarContainerStyle}>
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
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Input area */}
      <div style={inputContainerStyle}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type your message here..."
            style={{
              flex: 1,
              border: '1px solid #d1d5db',
              borderRadius: '9999px',
              padding: '8px 16px',
              outline: 'none',
              fontSize: '0.875rem'
            }}
            disabled={isGeneratingResponse}
          />
          <button
            type="submit"
            disabled={!messageText.trim() || isGeneratingResponse}
            style={{
              backgroundColor: !messageText.trim() || isGeneratingResponse ? '#93c5fd' : '#2563eb',
              color: 'white',
              borderRadius: '9999px',
              padding: '8px',
              border: 'none',
              cursor: !messageText.trim() || isGeneratingResponse ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !messageText.trim() || isGeneratingResponse ? 0.7 : 1
            }}
          >
            <PaperAirplaneIcon style={{ height: '20px', width: '20px' }} />
          </button>
        </form>
      </div>
      
      {/* Keyframe animations */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DebateChatUI; 