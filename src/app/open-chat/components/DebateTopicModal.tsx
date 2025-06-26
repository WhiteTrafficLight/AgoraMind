import React, { useState, useEffect } from 'react';
import { XMarkIcon, LinkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { DebateTopic } from '../utils/debateTopics';
import PhilosopherDetailsModal from './PhilosopherDetailsModal';
import { ChatRoomCreationParams } from '../types/openChat.types';
import { chatService } from '@/lib/ai/chatService';
import { useRouter } from 'next/navigation';

interface Philosopher {
  id: string;
  name: string;
  period?: string; 
  nationality?: string;
  description?: string;
  key_concepts?: string[];
  portrait_url?: string;
}

interface DebateTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: DebateTopic | null;
  categoryKey: string;
  topicIndex: number;
  onStartDebate: (categoryKey: string, topicIndex: number, topic: DebateTopic, userPosition: 'pro' | 'con' | 'neutral') => void;
  philosophers?: Philosopher[];
  customNpcs?: Philosopher[];
}

const DebateTopicModal: React.FC<DebateTopicModalProps> = ({
  isOpen,
  onClose,
  topic,
  categoryKey,
  topicIndex,
  onStartDebate,
  philosophers = [],
  customNpcs = []
}) => {
  const [userPosition, setUserPosition] = useState<'pro' | 'con' | 'neutral'>('neutral');
  const [selectedPhilosopherDetails, setSelectedPhilosopherDetails] = useState<Philosopher | null>(null);
  const [showPhilosopherDetails, setShowPhilosopherDetails] = useState(false);
  const [selectedProPhilosophers, setSelectedProPhilosophers] = useState<string[]>([]);
  const [selectedConPhilosophers, setSelectedConPhilosophers] = useState<string[]>([]);
  const [userProfilePicture, setUserProfilePicture] = useState<string>('');
  const [username, setUsername] = useState<string>('You');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  
  const router = useRouter();

  // Moderator styles - same as CreateChatModal
  const moderatorStyles = [
    { id: '0', name: 'Jamie the Host', description: 'Casual and friendly young-style moderator' },
    { id: '1', name: 'Dr. Lee', description: 'Polite and academic university professor-style moderator' },
    { id: '2', name: 'Zuri Show', description: 'Energetic and entertaining YouTuber host-style moderator' },
    { id: '3', name: 'Elias of the End', description: 'Serious and weighty tone moderator' },
    { id: '4', name: 'Miss Hana', description: 'Bright and educational style moderator' }
  ];

  // Load user profile on component mount
  useEffect(() => {
    const loadUserProfile = async () => {
      const storedUsername = sessionStorage.getItem('chat_username');
      
      if (storedUsername) {
        setUsername(storedUsername);
      }
      
      // Fetch user profile from API (matching DebateChatContainer pattern)
      try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
          const profileData = await response.json();
          console.log('Profile data received in DebateTopicModal:', profileData);
          
          if (profileData && (profileData.profileImage || profileData.profilePicture)) {
            const profileImageUrl = profileData.profileImage || profileData.profilePicture;
            console.log('Setting profile image:', profileImageUrl);
            setUserProfilePicture(profileImageUrl);
          } else {
            console.log('No profile image found, using default avatar');
            setUserProfilePicture(getDefaultAvatar(storedUsername || 'You'));
          }
        } else {
          console.error('Error response from profile API:', response.status);
          setUserProfilePicture(getDefaultAvatar(storedUsername || 'You'));
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setUserProfilePicture(getDefaultAvatar(storedUsername || 'You'));
      }
    };

    if (isOpen) {
      loadUserProfile();
    }
  }, [isOpen]);

  // Reset selections when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedProPhilosophers([]);
      setSelectedConPhilosophers([]);
      setUserPosition('neutral');
    }
  }, [isOpen, topic]);

  // Generate default avatar
  const getDefaultAvatar = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;
  };

  if (!isOpen || !topic) {
    return null;
  }

  // Get moderator info based on topic's moderator_style
  const getModeratorInfo = () => {
    const moderatorStyle = moderatorStyles.find(style => style.id === String(topic.moderator_style));
    return moderatorStyle || moderatorStyles[0]; // Default to Jamie if not found
  };

  const moderatorInfo = getModeratorInfo();

  const handleStartDebate = async () => {
    if (isCreating) return;
    
    setIsCreating(true);
    
    try {
      // Prepare NPCs list from selected philosophers
      const allSelectedNpcs = [...selectedProPhilosophers, ...selectedConPhilosophers];
      
      if (allSelectedNpcs.length === 0) {
        alert('Please select at least one philosopher to start the debate');
        setIsCreating(false);
        return;
      }

      // Prepare NPC positions
      const npcPositions: Record<string, 'pro' | 'con'> = {};
      selectedProPhilosophers.forEach(npc => {
        npcPositions[npc] = 'pro';
      });
      selectedConPhilosophers.forEach(npc => {
        npcPositions[npc] = 'con';
      });

      // Prepare context based on topic context
      let finalContext = '';
      if (topic.context.content) {
        if (topic.context.type === 'url') {
          finalContext = `URL: ${topic.context.content}`;
        } else {
          finalContext = topic.context.content;
        }
      }

      // Create chat room parameters
      const chatParams: ChatRoomCreationParams = {
        title: topic.title,
        context: finalContext,
        contextUrl: topic.context.type === 'url' ? topic.context.content : undefined,
        maxParticipants: 10, // Default max participants
        npcs: allSelectedNpcs,
        isPublic: true,
        dialogueType: 'debate',
        npcPositions,
        userDebateRole: userPosition,
        moderator: {
          style_id: String(topic.moderator_style),
          style: moderatorInfo.name
        },
        generateInitialMessage: true,
        username: username || sessionStorage.getItem('chat_username') || 'Anonymous'
      };

      console.log('Creating debate room with params:', chatParams);

      // Create the chat room
      const newChat = await chatService.createChatRoom(chatParams);
      console.log('Debate room creation response:', newChat);

      // Close modal and navigate to chat
      onClose();
      router.push(`/chat?id=${newChat.id}`);

    } catch (error) {
      console.error('Failed to create debate room:', error);
      alert('Failed to create debate room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handlePhilosopherSelect = (philosopherName: string, isProPosition: boolean) => {
    if (isProPosition) {
      setSelectedProPhilosophers(prev => {
        if (prev.includes(philosopherName)) {
          return prev.filter(p => p !== philosopherName);
        } else {
          // Limit to 2 philosophers per side
          return prev.length < 2 ? [...prev, philosopherName] : prev;
        }
      });
    } else {
      setSelectedConPhilosophers(prev => {
        if (prev.includes(philosopherName)) {
          return prev.filter(p => p !== philosopherName);
        } else {
          // Limit to 2 philosophers per side
          return prev.length < 2 ? [...prev, philosopherName] : prev;
        }
      });
    }
  };

  // 철학자 정보 로드 함수 (CreateChatModal에서 가져옴)
  const loadPhilosopherDetails = async (philosopherId: string) => {
    try {
      // 먼저 커스텀 NPC에서 찾기
      const customNpc = customNpcs.find(p => p.id.toLowerCase() === philosopherId.toLowerCase());
      if (customNpc) {
        setSelectedPhilosopherDetails(customNpc);
        setShowPhilosopherDetails(true);
        return;
      }
      
      // 이미 로드한 기본 철학자 정보가 있다면 재활용
      const existingPhil = philosophers.find(p => p.id.toLowerCase() === philosopherId.toLowerCase());
      if (existingPhil && existingPhil.description) {
        setSelectedPhilosopherDetails(existingPhil);
        setShowPhilosopherDetails(true);
        return;
      }
      
      // API 호출로 상세정보 가져오기
      const response = await fetch(`http://localhost:8000/api/philosophers/${philosopherId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedPhilosopherDetails(data);
        setShowPhilosopherDetails(true);
      } else {
        console.error(`Failed to fetch details for philosopher: ${philosopherId}`);
      }
    } catch (error) {
      console.error('Error fetching philosopher details:', error);
    }
  };

  // 철학자 정보 찾기 함수
  const findPhilosopherInfo = (philosopherName: string): Philosopher | null => {
    // 먼저 philosophers 배열에서 찾기
    const foundPhil = philosophers.find(p => 
      p.id.toLowerCase() === philosopherName.toLowerCase() || 
      p.name.toLowerCase() === philosopherName.toLowerCase()
    );
    
    if (foundPhil) return foundPhil;
    
    // customNpcs에서 찾기
    const foundCustom = customNpcs.find(p => 
      p.id.toLowerCase() === philosopherName.toLowerCase() || 
      p.name.toLowerCase() === philosopherName.toLowerCase()
    );
    
    return foundCustom || null;
  };

  const renderContextIcon = (contextType: string) => {
    switch (contextType) {
      case 'url':
        return <LinkIcon style={{ width: '20px', height: '20px', color: '#3b82f6' }} />;
      case 'pdf':
        return <DocumentTextIcon style={{ width: '20px', height: '20px', color: '#ef4444' }} />;
      case 'text':
        return <DocumentTextIcon style={{ width: '20px', height: '20px', color: '#6b7280' }} />;
      default:
        return null;
    }
  };

  const renderParticipantAvatar = (philosopherName: string, side: 'pro' | 'con') => {
    const philosopherInfo = findPhilosopherInfo(philosopherName);
    const defaultAvatarBg = side === 'pro' ? '22c55e' : 'ef4444';

    return (
      <div 
        key={philosopherName}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem'
        }}
      >
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          overflow: 'hidden',
          border: `2px solid ${side === 'pro' ? '#22c55e' : '#ef4444'}`
        }}>
          <img
            src={philosopherInfo?.portrait_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(philosopherName)}&background=${defaultAvatarBg}&color=fff&size=48`}
            alt={philosopherName}
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover'
            }}
          />
        </div>
        <span style={{
          fontSize: '0.75rem',
          color: '#374151',
          textAlign: 'center',
          fontWeight: '500'
        }}>
          {philosopherName}
        </span>
      </div>
    );
  };

  const renderUserAvatar = (side: 'pro' | 'con') => {
    if (userPosition !== side) return null;

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          overflow: 'hidden',
          border: `2px solid ${side === 'pro' ? '#22c55e' : '#ef4444'}`
        }}>
          <img
            src={userProfilePicture}
            alt={username}
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover'
            }}
          />
        </div>
        <span style={{
          fontSize: '0.75rem',
          color: '#374151',
          textAlign: 'center',
          fontWeight: '500'
        }}>
          {username}
        </span>
      </div>
    );
  };

  const renderPhilosopherCard = (philosopherName: string, isProPosition: boolean) => {
    const philosopherInfo = findPhilosopherInfo(philosopherName);
    const isSelected = isProPosition 
      ? selectedProPhilosophers.includes(philosopherName)
      : selectedConPhilosophers.includes(philosopherName);
    
    const backgroundColor = isSelected 
      ? (isProPosition ? '#dcfce7' : '#fee2e2') // Darker when selected
      : (isProPosition ? '#f0fdf4' : '#fef2f2'); // Light when not selected
    
    const borderColor = isProPosition ? '#bbf7d0' : '#fecaca';
    const defaultAvatarBg = isProPosition ? '22c55e' : 'ef4444';

    return (
      <div 
        key={philosopherName} 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.5rem',
          backgroundColor: backgroundColor,
          borderRadius: '0.375rem',
          border: `1px solid ${borderColor}`,
          marginBottom: '0.5rem',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease'
        }}
        onClick={() => handlePhilosopherSelect(philosopherName, isProPosition)}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flex: '1'
        }}>
          <img
            src={philosopherInfo?.portrait_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(philosopherName)}&background=${defaultAvatarBg}&color=fff&size=32`}
            alt={philosopherName}
            style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%' 
            }}
          />
          <span style={{ 
            color: '#374151', 
            textTransform: 'capitalize', 
            fontWeight: isSelected ? '600' : '500'
          }}>
            {philosopherName}
          </span>
        </div>
        
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            loadPhilosopherDetails(philosopherInfo?.id || philosopherName);
            return false;
          }}
          className="view-details-button"
          style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.5rem'
          }}
        >
          View details
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Background overlay */}
      <div className="create-chat-modal-overlay" onClick={onClose}></div>
      
      {/* Modal container */}
      <div className="create-chat-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="create-chat-modal-header">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Debate Topic</h2>
          <button 
            onClick={onClose}
            className="create-chat-modal-close"
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div className="create-chat-modal-content">
          {/* Topic Title */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              color: '#374151', 
              marginBottom: '1rem' 
            }}>
              {topic.title}
            </h3>
          </div>

          {/* Context Section */}
          {topic.context.content && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                marginBottom: '0.75rem' 
              }}>
                {topic.context.type && renderContextIcon(topic.context.type)}
                <h4 style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: '500', 
                  color: '#374151' 
                }}>Context</h4>
              </div>
              
              <div style={{ 
                backgroundColor: '#f9fafb', 
                borderRadius: '0.5rem', 
                padding: '1rem', 
                border: '1px solid #e5e7eb' 
              }}>
                {topic.context.type === 'url' ? (
                  <a 
                    href={topic.context.content} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      color: '#2563eb', 
                      textDecoration: 'underline',
                      wordBreak: 'break-all'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = '#1d4ed8'}
                    onMouseOut={(e) => e.currentTarget.style.color = '#2563eb'}
                  >
                    {topic.context.content}
                  </a>
                ) : (
                  <div style={{ 
                    color: '#374151', 
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {topic.context.content}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Moderator Section */}
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '1rem' 
            }}>Debate Moderator</h4>
            <div className="moderator-selection-card selected">
              <div className="moderator-card-content">
                <img
                  src={`/portraits/Moderator${topic.moderator_style}.png`}
                  alt={moderatorInfo.name}
                  className="moderator-image"
                />
                <div className="moderator-info">
                  <div className="moderator-name">{moderatorInfo.name}</div>
                  <div className="moderator-description">{moderatorInfo.description}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Participants Section */}
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '1rem' 
            }}>Participants</h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '1.5rem',
              minHeight: '120px'
            }}>
              {/* Pro Participants */}
              <div style={{ 
                backgroundColor: '#f0fdf4', 
                borderRadius: '0.5rem', 
                padding: '1rem', 
                border: '1px solid #bbf7d0' 
              }}>
                <h5 style={{ 
                  fontWeight: '600', 
                  color: '#166534', 
                  marginBottom: '0.75rem', 
                  textAlign: 'center' 
                }}>Pro Side</h5>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {selectedProPhilosophers.map(philosopher => 
                    renderParticipantAvatar(philosopher, 'pro')
                  )}
                  {renderUserAvatar('pro')}
                  {(selectedProPhilosophers.length === 0 && userPosition !== 'pro') && (
                    <div style={{
                      color: '#9ca3af',
                      fontSize: '0.875rem',
                      textAlign: 'center',
                      padding: '1rem'
                    }}>
                      Select philosophers below
                    </div>
                  )}
                </div>
              </div>

              {/* Con Participants */}
              <div style={{ 
                backgroundColor: '#fef2f2', 
                borderRadius: '0.5rem', 
                padding: '1rem', 
                border: '1px solid #fecaca' 
              }}>
                <h5 style={{ 
                  fontWeight: '600', 
                  color: '#991b1b', 
                  marginBottom: '0.75rem', 
                  textAlign: 'center' 
                }}>Con Side</h5>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {selectedConPhilosophers.map(philosopher => 
                    renderParticipantAvatar(philosopher, 'con')
                  )}
                  {renderUserAvatar('con')}
                  {(selectedConPhilosophers.length === 0 && userPosition !== 'con') && (
                    <div style={{
                      color: '#9ca3af',
                      fontSize: '0.875rem',
                      textAlign: 'center',
                      padding: '1rem'
                    }}>
                      Select philosophers below
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recommended Philosophers Section */}
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '1rem' 
            }}>Recommended Philosophers</h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '1.5rem' 
            }}>
              {/* Pro Position */}
              <div style={{ 
                backgroundColor: '#f0fdf4', 
                borderRadius: '0.5rem', 
                padding: '1rem', 
                border: '1px solid #bbf7d0' 
              }}>
                <h5 style={{ 
                  fontWeight: '600', 
                  color: '#166534', 
                  marginBottom: '0.75rem', 
                  textAlign: 'center' 
                }}>Pro Position</h5>
                <div>
                  {topic.pro_philosophers.map(philosopher => 
                    renderPhilosopherCard(philosopher, true)
                  )}
                </div>
              </div>

              {/* Con Position */}
              <div style={{ 
                backgroundColor: '#fef2f2', 
                borderRadius: '0.5rem', 
                padding: '1rem', 
                border: '1px solid #fecaca' 
              }}>
                <h5 style={{ 
                  fontWeight: '600', 
                  color: '#991b1b', 
                  marginBottom: '0.75rem', 
                  textAlign: 'center' 
                }}>Con Position</h5>
                <div>
                  {topic.con_philosophers.map(philosopher => 
                    renderPhilosopherCard(philosopher, false)
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* User Position Selection */}
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '1rem' 
            }}>Choose Your Position</h4>
            <div className="debate-role-cards-container">
              <div 
                onClick={() => setUserPosition('pro')}
                className={`debate-role-card ${userPosition === 'pro' ? 'pro' : ''}`}
                style={{ cursor: 'pointer' }}
              >
                <div className="debate-role-card-title">
                  Pro (Support)
                </div>
                <div className="debate-role-card-description">
                  Argue in favor of the proposition
                </div>
              </div>
              
              <div 
                onClick={() => setUserPosition('con')}
                className={`debate-role-card ${userPosition === 'con' ? 'con' : ''}`}
                style={{ cursor: 'pointer' }}
              >
                <div className="debate-role-card-title">
                  Con (Oppose)
                </div>
                <div className="debate-role-card-description">
                  Argue against the proposition
                </div>
              </div>
              
              <div 
                onClick={() => setUserPosition('neutral')}
                className={`debate-role-card ${userPosition === 'neutral' ? 'neutral' : ''}`}
                style={{ cursor: 'pointer' }}
              >
                <div className="debate-role-card-title">
                  Observer
                </div>
                <div className="debate-role-card-description">
                  Watch and learn from the debate
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Start Debate Button */}
        <div className="create-chat-actions">
          <button
            onClick={handleStartDebate}
            className="create-chat-submit"
            disabled={isCreating || (selectedProPhilosophers.length === 0 && selectedConPhilosophers.length === 0)}
          >
            {isCreating ? (
              <>
                <span className="loading-spinner"></span>
                Creating Debate...
              </>
            ) : (
              'Start Debate'
            )}
          </button>
        </div>
      </div>

      {/* Philosopher Details Modal */}
      <PhilosopherDetailsModal
        philosopher={selectedPhilosopherDetails}
        isOpen={showPhilosopherDetails}
        onClose={() => setShowPhilosopherDetails(false)}
        onToggleSelect={() => {}} // 토론 모달에서는 선택 기능이 필요없음
        isSelected={false}
      />
    </>
  );
};

export default DebateTopicModal; 