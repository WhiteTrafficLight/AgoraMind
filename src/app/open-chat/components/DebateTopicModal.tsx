import React, { useState, useEffect } from 'react';
import { XMarkIcon, LinkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { DebateTopic } from '../utils/debateTopics';
import PhilosopherDetailsModal from './PhilosopherDetailsModal';
import { ChatRoomCreationParams, Philosopher } from '../types/openChat.types';
import { chatService } from '@/lib/ai/chatService';
import { useRouter } from 'next/navigation';
import { loggers } from '@/utils/logger';

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
          loggers.auth.debug('Profile data received in DebateTopicModal', profileData);
          
          if (profileData && (profileData.profileImage || profileData.profilePicture)) {
            const profileImageUrl = profileData.profileImage || profileData.profilePicture;
            loggers.auth.debug('Setting profile image', { profileImageUrl });
            setUserProfilePicture(profileImageUrl);
          } else {
            loggers.auth.info('No profile image found, using default avatar');
            setUserProfilePicture(getDefaultAvatar(storedUsername || 'You'));
          }
        } else {
          loggers.auth.error('Error response from profile API', { status: response.status });
          setUserProfilePicture(getDefaultAvatar(storedUsername || 'You'));
        }
      } catch (error) {
        loggers.auth.error('Error fetching user profile', error);
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

  // Generate philosopher portrait path from static files
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

      loggers.chat.debug('Creating debate room with params', chatParams);

      // Create the chat room
      const newChat = await chatService.createChatRoom(chatParams);
      loggers.chat.info('Debate room creation response', newChat);

      // Close modal and navigate to chat
      onClose();
      router.push(`/chat?id=${newChat.id}`);

    } catch (error) {
      loggers.chat.error('Failed to create debate room', error);
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
      
      // 정적 JSON 파일에서 직접 찾기 (백업)
      const response = await fetch('/data/philosophers.json');
      if (response.ok) {
        const data = await response.json();
        const philosopher = data.philosophers.find((p: any) => 
          p.id.toLowerCase() === philosopherId.toLowerCase()
        );
        if (philosopher) {
          setSelectedPhilosopherDetails(philosopher);
          setShowPhilosopherDetails(true);
        } else {
          loggers.ui.error(`Philosopher '${philosopherId}' not found in data`);
        }
      } else {
        loggers.ui.error('Failed to load philosopher data from static file');
      }
    } catch (error) {
      loggers.ui.error('Error fetching philosopher details', error);
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
        return <LinkIcon className="h-5 w-5 text-blue-600" />;
      case 'pdf':
        return <DocumentTextIcon className="h-5 w-5 text-red-600" />;
      case 'text':
        return <DocumentTextIcon className="h-5 w-5 text-gray-500" />;
      default:
        return null;
    }
  };

  const renderParticipantAvatar = (philosopherName: string, side: 'pro' | 'con') => {
    const philosopherInfo = findPhilosopherInfo(philosopherName);
    const defaultAvatarBg = side === 'pro' ? '22c55e' : 'ef4444';
    const borderClass = side === 'pro' ? 'border-emerald-500' : 'border-rose-500';
    return (
      <div key={philosopherName} className="flex flex-col items-center gap-2 p-2">
        <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${borderClass}`}>
          <img
            src={philosopherInfo?.portrait_url || getPhilosopherPortraitPath(philosopherName)}
            alt={philosopherName}
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(philosopherName)}&background=${defaultAvatarBg}&color=fff&size=48`;
            }}
            className="w-full h-full object-cover"
          />
        </div>
        <span className="text-xs text-gray-700 text-center font-medium">{philosopherName}</span>
      </div>
    );
  };

  const renderUserAvatar = (side: 'pro' | 'con') => {
    if (userPosition !== side) return null;
    const borderClass = side === 'pro' ? 'border-emerald-500' : 'border-rose-500';
    return (
      <div className="flex flex-col items-center gap-2 p-2">
        <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${borderClass}`}>
          <img src={userProfilePicture} alt={username} className="w-full h-full object-cover" />
        </div>
        <span className="text-xs text-gray-700 text-center font-medium">{username}</span>
      </div>
    );
  };

  const renderPhilosopherCard = (philosopherName: string, isProPosition: boolean) => {
    const philosopherInfo = findPhilosopherInfo(philosopherName);
    const isSelected = isProPosition
      ? selectedProPhilosophers.includes(philosopherName)
      : selectedConPhilosophers.includes(philosopherName);
    const bgClass = isProPosition
      ? (isSelected ? 'bg-emerald-100' : 'bg-emerald-50')
      : (isSelected ? 'bg-rose-100' : 'bg-rose-50');
    const borderClass = isProPosition ? 'border-emerald-200' : 'border-rose-200';
    const defaultAvatarBg = isProPosition ? '22c55e' : 'ef4444';
    return (
      <div
        key={philosopherName}
        className={`flex items-center justify-between gap-2 p-2 rounded-md border ${borderClass} ${bgClass} mb-2 cursor-pointer`}
        onClick={() => handlePhilosopherSelect(philosopherName, isProPosition)}
      >
        <div className="flex items-center gap-2 flex-1">
          <img
            src={philosopherInfo?.portrait_url || getPhilosopherPortraitPath(philosopherName)}
            alt={philosopherName}
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(philosopherName)}&background=${defaultAvatarBg}&color=fff&size=32`;
            }}
            className="w-8 h-8 rounded-full"
          />
          <span className={`capitalize ${isSelected ? 'font-semibold' : 'font-medium'} text-gray-700`}>
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
          className="text-xs px-2 py-1 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          View details
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Background overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose}></div>
      
      {/* Modal container */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-4xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl z-50 border border-gray-200" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold">Debate Topic</h2>
          <button 
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Topic Title */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">{topic.title}</h3>
          </div>

          {/* Context Section */}
          {topic.context.content && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                {topic.context.type && renderContextIcon(topic.context.type)}
                <h4 className="text-base font-medium text-gray-700">Context</h4>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                {topic.context.type === 'url' ? (
                  <a href={topic.context.content} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all hover:text-blue-700">
                    {topic.context.content}
                  </a>
                ) : (
                  <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {topic.context.content}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Moderator Section */}
          <div>
            <h4 className="text-base font-medium text-gray-700 mb-4">Debate Moderator</h4>
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center gap-3 p-3">
                <img
                  src={`/moderator_portraits/Moderator${topic.moderator_style}.png`}
                  alt={moderatorInfo.name}
                  className="w-14 h-14 rounded-md object-cover"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{moderatorInfo.name}</div>
                  <div className="text-sm text-gray-500">{moderatorInfo.description}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Participants Section */}
          <div>
            <h4 className="text-base font-medium text-gray-700 mb-4">Participants</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[120px]">
              {/* Pro Participants */}
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <h5 className="font-semibold text-emerald-800 mb-3 text-center">Pro Side</h5>
                <div className="flex flex-col items-center gap-2">
                  {selectedProPhilosophers.map(philosopher => 
                    renderParticipantAvatar(philosopher, 'pro')
                  )}
                  {renderUserAvatar('pro')}
                  {(selectedProPhilosophers.length === 0 && userPosition !== 'pro') && (
                    <div className="text-sm text-gray-400 text-center p-4">
                      Select philosophers below
                    </div>
                  )}
                </div>
              </div>

              {/* Con Participants */}
              <div className="bg-rose-50 rounded-lg p-4 border border-rose-200">
                <h5 className="font-semibold text-rose-800 mb-3 text-center">Con Side</h5>
                <div className="flex flex-col items-center gap-2">
                  {selectedConPhilosophers.map(philosopher => 
                    renderParticipantAvatar(philosopher, 'con')
                  )}
                  {renderUserAvatar('con')}
                  {(selectedConPhilosophers.length === 0 && userPosition !== 'con') && (
                    <div className="text-sm text-gray-400 text-center p-4">
                      Select philosophers below
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recommended Philosophers Section */}
          <div>
            <h4 className="text-base font-medium text-gray-700 mb-4">Recommended Philosophers</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pro Position */}
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <h5 className="font-semibold text-emerald-800 mb-3 text-center">Pro Position</h5>
                <div>
                  {topic.pro_philosophers.map(philosopher => 
                    renderPhilosopherCard(philosopher, true)
                  )}
                </div>
              </div>

              {/* Con Position */}
              <div className="bg-rose-50 rounded-lg p-4 border border-rose-200">
                <h5 className="font-semibold text-rose-800 mb-3 text-center">Con Position</h5>
                <div>
                  {topic.con_philosophers.map(philosopher => 
                    renderPhilosopherCard(philosopher, false)
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* User Position Selection */}
          <div>
            <h4 className="text-base font-medium text-gray-700 mb-4">Choose Your Position</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div
                onClick={() => setUserPosition('pro')}
                className={`p-4 rounded-lg border-2 cursor-pointer transition ${userPosition === 'pro' ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
              >
                <div className="font-semibold text-gray-900">Pro (Support)</div>
                <div className="text-sm text-gray-500">Argue in favor of the proposition</div>
              </div>
              <div
                onClick={() => setUserPosition('con')}
                className={`p-4 rounded-lg border-2 cursor-pointer transition ${userPosition === 'con' ? 'border-rose-600 bg-rose-50' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
              >
                <div className="font-semibold text-gray-900">Con (Oppose)</div>
                <div className="text-sm text-gray-500">Argue against the proposition</div>
              </div>
              <div
                onClick={() => setUserPosition('neutral')}
                className={`p-4 rounded-lg border-2 cursor-pointer transition ${userPosition === 'neutral' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
              >
                <div className="font-semibold text-gray-900">Observer</div>
                <div className="text-sm text-gray-500">Watch and learn from the debate</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Start Debate Button */}
        <div className="px-6 py-4 border-t flex justify-end">
          <button
            onClick={handleStartDebate}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium shadow hover:bg-blue-700 disabled:opacity-50"
            disabled={isCreating || (selectedProPhilosophers.length === 0 && selectedConPhilosophers.length === 0)}
          >
            {isCreating ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
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