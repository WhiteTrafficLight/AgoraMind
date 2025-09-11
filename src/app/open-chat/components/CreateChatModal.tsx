import React, { useState, useRef } from 'react';
import { useLoadingOverlay } from '@/app/loadingOverlay';
import { XMarkIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { CreateChatModalProps, ChatRoomCreationParams, Philosopher } from '../types/openChat.types';
import PhilosopherDetailsModal from './PhilosopherDetailsModal';
import { loggers } from '@/utils/logger';

const CreateChatModal: React.FC<CreateChatModalProps> = ({
  isOpen,
  onClose,
  onCreateChat,
  isCreating,
  philosophers,
  customNpcs
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const overlay = useLoadingOverlay();
  const [formData, setFormData] = useState<ChatRoomCreationParams>({
    title: '',
    maxParticipants: 6,
    npcs: [],
    isPublic: true,
    generateInitialMessage: true,
    dialogueType: 'free',
    context: '',
    contextUrl: '',
    contextFileContent: ''
  });

  const [contextType, setContextType] = useState<'none' | 'url' | 'text'>('none');
  const [selectedPhilosophers, setSelectedPhilosophers] = useState<string[]>([]);
  const [selectedCustomNpcs, setSelectedCustomNpcs] = useState<string[]>([]);
  const [npcPositions, setNpcPositions] = useState<Record<string, 'pro' | 'con'>>({});
  const [userDebateRole, setUserDebateRole] = useState<'pro' | 'con' | 'neutral'>('neutral');
  const [moderatorStyleId, setModeratorStyleId] = useState<string>('0');
  
  // 철학자 정보 모달 관련 상태
  const [selectedPhilosopherDetails, setSelectedPhilosopherDetails] = useState<Philosopher | null>(null);
  const [showPhilosopherDetails, setShowPhilosopherDetails] = useState(false);
  
  // 추천 주제 표시 상태
  const [showRecommendedTopics, setShowRecommendedTopics] = useState(false);
  
  // Free discussion settings
  const [freeDiscussionSettings, setFreeDiscussionSettings] = useState({
    autoPlay: false,
    playbackSpeed: 1.0,
    turnInterval: 3.0,
    maxTurns: 50,
    allowInterruption: true,
  });
  
  // Fine-tuned philosophers (allowed for selection)
  const FINE_TUNED = new Set(['sartre', 'camus', 'nietzsche']);
  
  // Deprecated (file input removed); keep ref to avoid refactor errors
  const fileInputRef = useRef<HTMLInputElement>(null);

  const moderatorStyles = [
    { id: '0', name: 'Jamie the Host', description: 'Casual and friendly young-style moderator' },
    { id: '1', name: 'Dr. Lee', description: 'Polite and academic university professor-style moderator' },
    { id: '2', name: 'Zuri Show', description: 'Energetic and entertaining YouTuber host-style moderator' },
    { id: '3', name: 'Elias of the End', description: 'Serious and weighty tone moderator' },
    { id: '4', name: 'Miss Hana', description: 'Bright and educational style moderator' }
  ];

  // Handle form field changes
  const handleChange = (field: keyof ChatRoomCreationParams, value: string | string[] | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle philosopher selection
  const togglePhilosopher = (philosopherId: string) => {
    setSelectedPhilosophers(prev => {
      const newSelection = prev.includes(philosopherId)
        ? prev.filter(p => p !== philosopherId)
        : [...prev, philosopherId];
      
      // Update formData.npcs
      const allSelected = [...newSelection, ...selectedCustomNpcs];
      handleChange('npcs', allSelected);
      
      return newSelection;
    });

    // Handle npcPositions for debate mode
    if (formData.dialogueType === 'debate') {
      if (selectedPhilosophers.includes(philosopherId)) {
        // Removing philosopher - remove position
        setNpcPositions(prev => {
          const updated = { ...prev };
          delete updated[philosopherId];
          return updated;
        });
      } else {
        // Adding philosopher - assign balanced position
        const proCount = Object.values(npcPositions).filter(p => p === 'pro').length;
        const conCount = Object.values(npcPositions).filter(p => p === 'con').length;
        const defaultPosition = proCount <= conCount ? 'pro' : 'con';
        
        setNpcPositions(prev => ({
          ...prev,
          [philosopherId]: defaultPosition
        }));
      }
    }
  };

  // Handle custom NPC selection
  const toggleCustomNpc = (npcId: string) => {
    setSelectedCustomNpcs(prev => {
      const newSelection = prev.includes(npcId)
        ? prev.filter(n => n !== npcId)
        : [...prev, npcId];
      
      // Update formData.npcs
      const allSelected = [...selectedPhilosophers, ...newSelection];
      handleChange('npcs', allSelected);
      
      return newSelection;
    });

    // Handle npcPositions for debate mode
    if (formData.dialogueType === 'debate') {
      if (selectedCustomNpcs.includes(npcId)) {
        // Removing NPC - remove position
        setNpcPositions(prev => {
          const updated = { ...prev };
          delete updated[npcId];
          return updated;
        });
      } else {
        // Adding NPC - assign balanced position
        const proCount = Object.values(npcPositions).filter(p => p === 'pro').length;
        const conCount = Object.values(npcPositions).filter(p => p === 'con').length;
        const defaultPosition = proCount <= conCount ? 'pro' : 'con';
        
        setNpcPositions(prev => ({
          ...prev,
          [npcId]: defaultPosition
        }));
      }
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        handleChange('contextFileContent', content);
        handleChange('context', `File: ${file.name}`);
      };
      reader.readAsText(file);
    }
  };

  // Handle dialogue type change
  const handleDialogueTypeChange = (type: string) => {
    handleChange('dialogueType', type as 'free' | 'debate' | 'socratic' | 'dialectical');
    if (type !== 'debate') {
      setNpcPositions({});
      setUserDebateRole('neutral');
    }
  };

  // Set NPC position for debate
  const setNpcPosition = (npcId: string, position: 'pro' | 'con') => {
    if (selectedPhilosophers.includes(npcId) || selectedCustomNpcs.includes(npcId)) {
      setNpcPositions(prev => ({
        ...prev,
        [npcId]: position
      }));
    }
  };

  // 철학자 정보 로드 함수
  const loadPhilosopherDetails = async (philosopherId: string) => {
    try {
      // 먼저 커스텀 NPC에서 찾기
      const customNpc = customNpcs.find(p => p.id.toLowerCase() === philosopherId.toLowerCase());
      if (customNpc) {
        setSelectedPhilosopherDetails(customNpc);
        setShowPhilosopherDetails(true);
        return;
      }
      
      // 이미 로드한 기본 철학자 정보가 있다면 사용
      const existingPhil = philosophers.find(p => p.id.toLowerCase() === philosopherId.toLowerCase());
      if (existingPhil) {
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
        loggers.ui.error(`Failed to load philosopher data from static file`);
      }
    } catch (error) {
      loggers.ui.error('Error fetching philosopher details:', error);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Please enter a chat title');
      return;
    }

    // Prepare context based on type
    let finalContext = '';
    if (contextType === 'url' && formData.contextUrl) {
      finalContext = `URL: ${formData.contextUrl}`;
    } else if (contextType === 'text' && formData.context) {
      finalContext = formData.context;
    }

    const finalFormData: ChatRoomCreationParams = {
      ...formData,
      context: finalContext,
      contextUrl: contextType === 'url' ? formData.contextUrl : undefined,
      contextFileContent: undefined
    };

    // Add debate-specific data
    if (formData.dialogueType === 'debate') {
      finalFormData.npcPositions = npcPositions;
      finalFormData.userDebateRole = userDebateRole;
      finalFormData.moderator = {
        style_id: moderatorStyleId,
        style: moderatorStyles.find(s => s.id === moderatorStyleId)?.name || 'Jamie the Host'
      };
    }

    // Add free discussion settings
    if (formData.dialogueType === 'free') {
      finalFormData.freeDiscussionConfig = {
        auto_play: freeDiscussionSettings.autoPlay,
        playback_speed: freeDiscussionSettings.playbackSpeed,
        turn_interval: freeDiscussionSettings.turnInterval,
        max_turns: freeDiscussionSettings.maxTurns,
        allow_user_interruption: freeDiscussionSettings.allowInterruption,
      };
    }

    try {
      // Show overlay by context type
      overlay.show('Creating room…');
      if (contextType === 'url') {
        overlay.update(
          'Reading and summarizing the context…',
          'When the context is long, it might take some time for philosophers to read it.'
        );
      } else if (contextType === 'text') {
        overlay.update('Preparing participants…');
      }

      await onCreateChat(finalFormData);
    } catch (error) {
      loggers.ui.error('Error creating chat:', error);
    }
    finally {
      overlay.hide();
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: '',
      maxParticipants: 6,
      npcs: [],
      isPublic: true,
      generateInitialMessage: true,
      dialogueType: 'free',
      context: '',
      contextUrl: '',
      contextFileContent: ''
    });
    setContextType('none');
    setSelectedPhilosophers([]);
    setSelectedCustomNpcs([]);
    setNpcPositions({});
    setUserDebateRole('neutral');
    setModeratorStyleId('0');
    setStep(1);
    // 철학자 정보 모달 상태 초기화
    setSelectedPhilosopherDetails(null);
    setShowPhilosopherDetails(false);
    // 추천 주제 상태 초기화
    setShowRecommendedTopics(false);
    // Free discussion defaults (manual mode)
    setFreeDiscussionSettings({
      autoPlay: false,
      playbackSpeed: 1.0,
      turnInterval: 3.0,
      maxTurns: 50,
      allowInterruption: true,
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const goToNextStep = () => {
    if (step < 3) {
      setStep((prev) => (prev + 1) as 1 | 2 | 3);
    }
  };

  const goToPreviousStep = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3);
    }
  };

  if (!isOpen) {
    return null;
  }

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

  return (
    <>
      {/* Background overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={handleClose}></div>

      {/* Modal container */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-5xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl z-50 border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Create New Chat</h2>
          <button
            onClick={handleClose}
            className="inline-flex items-center justify-center rounded-full p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={isCreating}
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4">
          <form onSubmit={handleSubmit}>
            {/* Step 1: Dialogue Pattern */}
            {step === 1 && (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Dialogue Pattern</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
                  <div
                    className={`relative p-6 border-2 rounded-xl cursor-pointer transition bg-white text-center flex flex-col items-center gap-3 ${
                      formData.dialogueType === 'free'
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                    onClick={() => handleDialogueTypeChange('free')}
                  >
                    <img src="/Free.png" alt="Free Discussion" className="w-20 h-20 object-cover rounded-md" />
                    <div className="font-semibold text-base text-gray-900">Free Discussion</div>
                    <div className="text-sm text-gray-600 leading-tight">
                      Open-format dialogue<br/>with no specific structure
                    </div>
                  </div>

                  <div className="relative p-6 border-2 rounded-xl bg-gray-100 border-gray-200 cursor-not-allowed opacity-60 text-center flex flex-col items-center gap-3">
                    <div className="absolute top-2 right-2 bg-gray-600 text-white px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wide">Coming Soon</div>
                    <img src="/ProCon.png" alt="Pro-Con Debate" className="w-20 h-20 object-cover rounded-md" />
                    <div className="font-semibold text-base text-gray-400">Pro-Con Debate</div>
                    <div className="text-sm text-gray-300 leading-tight">Structured debate<br/>with opposing positions</div>
                  </div>

                  <div className="relative p-6 border-2 rounded-xl bg-gray-100 border-gray-200 cursor-not-allowed opacity-60 text-center flex flex-col items-center gap-3">
                    <div className="absolute top-2 right-2 bg-gray-600 text-white px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wide">Coming Soon</div>
                    <img src="/Socratic.png" alt="Socratic Dialogue" className="w-20 h-20 object-cover rounded-md" />
                    <div className="font-semibold text-base text-gray-400">Socratic Dialogue</div>
                    <div className="text-sm text-gray-300 leading-tight">Question-based approach<br/>to explore a topic</div>
                  </div>

                  <div className="relative p-6 border-2 rounded-xl bg-gray-100 border-gray-200 cursor-not-allowed opacity-60 text-center flex flex-col items-center gap-3">
                    <div className="absolute top-2 right-2 bg-gray-600 text-white px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wide">Coming Soon</div>
                    <img src="/Dialectical.png" alt="Dialectical Discussion" className="w-20 h-20 object-cover rounded-md" />
                    <div className="font-semibold text-base text-gray-400">Dialectical Discussion</div>
                    <div className="text-sm text-gray-300 leading-tight">Thesis-Antithesis-Synthesis<br/>format</div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Chat Title and Context */}
            {step === 2 && (
              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Chat Title:</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="What would you like to discuss today?"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    required
                  />
                </div>

                {/* Recommended Topics Section */}
                <div>
                  <div
                    className="flex items-center justify-between py-2 cursor-pointer select-none border-b-2 border-gray-200 mb-2"
                    onClick={() => setShowRecommendedTopics(!showRecommendedTopics)}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                      <svg
                        className="h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                      </svg>
                      Recommended Topics for {
                        formData.dialogueType === 'free' ? 'Free Discussion' :
                        formData.dialogueType === 'debate' ? 'Pro-Con Debate' :
                        formData.dialogueType === 'socratic' ? 'Socratic Dialogue' :
                        'Dialectical Discussion'
                      }
                    </div>
                  </div>

                  <div className={showRecommendedTopics ? 'mt-3' : 'hidden'}>
                    {formData.dialogueType === 'free' && (
                      <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                        <li>&quot;The meaning of happiness in different philosophical traditions&quot;</li>
                        <li>&quot;How does technology shape human experience in the modern world?&quot;</li>
                        <li>&quot;The relationship between art and moral values&quot;</li>
                        <li>&quot;Free will and determinism: Are our choices truly free?&quot;</li>
                        <li>&quot;The nature of consciousness and self-awareness&quot;</li>
                      </ul>
                    )}

                    {formData.dialogueType === 'debate' && (
                      <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                        <li>&quot;Is artificial intelligence beneficial or harmful to humanity?&quot;</li>
                        <li>&quot;Should we prioritize individual liberty over collective welfare?&quot;</li>
                        <li>&quot;Is objective morality possible without religion?&quot;</li>
                        <li>&quot;Should societies focus on equality of opportunity or equality of outcome?&quot;</li>
                        <li>&quot;Is human nature fundamentally good or self-interested?&quot;</li>
                      </ul>
                    )}

                    {formData.dialogueType === 'socratic' && (
                      <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                        <li>&quot;What is justice? How can we recognize a just society?&quot;</li>
                        <li>&quot;What constitutes knowledge versus mere opinion?&quot;</li>
                        <li>&quot;What is the nature of virtue? Can it be taught?&quot;</li>
                        <li>&quot;What makes a life worth living? How should we define success?&quot;</li>
                        <li>&quot;How should we understand the relationship between mind and body?&quot;</li>
                      </ul>
                    )}

                    {formData.dialogueType === 'dialectical' && (
                      <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                        <li>&quot;Thesis: Reason is the primary source of knowledge | Antithesis: Experience is the primary source of knowledge&quot;</li>
                        <li>&quot;Thesis: Morality is objective | Antithesis: Morality is culturally relative&quot;</li>
                        <li>&quot;Thesis: Human technology enhances our humanity | Antithesis: Technology alienates us from our true nature&quot;</li>
                        <li>&quot;Thesis: Free markets maximize human flourishing | Antithesis: Markets require regulation to prevent exploitation&quot;</li>
                        <li>&quot;Thesis: Mind is separate from matter | Antithesis: Mind emerges from physical processes&quot;</li>
                      </ul>
                    )}
                  </div>

                  {/* Quick topic buttons */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {formData.dialogueType === 'free' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleChange('title', "The meaning of happiness in different philosophical traditions")}
                          className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Happiness
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChange('title', "The nature of consciousness and self-awareness")}
                          className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Consciousness
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChange('title', "How does technology shape human experience?")}
                          className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Technology & Humanity
                        </button>
                      </>
                    )}

                    {formData.dialogueType === 'debate' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleChange('title', "Is artificial intelligence beneficial or harmful to humanity?")}
                          className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          AI Ethics
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChange('title', "Individual liberty vs. collective welfare")}
                          className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Liberty vs. Community
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChange('title', "Is human nature fundamentally good or self-interested?")}
                          className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Human Nature
                        </button>
                      </>
                    )}

                    {formData.dialogueType === 'socratic' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleChange('title', "What is justice? How can we recognize a just society?")}
                          className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          On Justice
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChange('title', "What constitutes knowledge versus mere opinion?")}
                          className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Knowledge vs. Opinion
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChange('title', "What makes a life worth living?")}
                          className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          The Good Life
                        </button>
                      </>
                    )}

                    {formData.dialogueType === 'dialectical' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleChange('title', "Reason vs. Experience as the source of knowledge")}
                          className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Reason vs. Experience
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChange('title', "Is morality objective or culturally relative?")}
                          className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Moral Objectivity
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChange('title', "Mind-body relationship: dualism or physicalism?")}
                          className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Mind-Body Problem
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Context</label>

                  {/* Context type selection */}
                  <div className="flex border-b-2 border-gray-200 mb-4">
                    <button
                      type="button"
                      onClick={() => setContextType('none')}
                      className={`px-4 py-3 text-sm font-medium -mb-[2px] border-b-2 ${
                        contextType === 'none'
                          ? 'text-gray-900 border-gray-900'
                          : 'text-gray-600 border-transparent hover:text-gray-700'
                      }`}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      onClick={() => setContextType('url')}
                      className={`px-4 py-3 text-sm font-medium -mb-[2px] border-b-2 ${
                        contextType === 'url'
                          ? 'text-gray-900 border-gray-900'
                          : 'text-gray-600 border-transparent hover:text-gray-700'
                      }`}
                    >
                      URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setContextType('text')}
                      className={`px-4 py-3 text-sm font-medium -mb-[2px] border-b-2 ${
                        contextType === 'text'
                          ? 'text-gray-900 border-gray-900'
                          : 'text-gray-600 border-transparent hover:text-gray-700'
                      }`}
                    >
                      Text
                    </button>
                  </div>

                  {/* URL input */}
                  {contextType === 'url' && (
                    <input
                      type="url"
                      value={formData.contextUrl}
                      onChange={(e) => handleChange('contextUrl', e.target.value)}
                      placeholder="https://example.com/article"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-black shadow-sm"
                    />
                  )}

                  {/* Text input */}
                  {contextType === 'text' && (
                    <textarea
                      value={formData.context}
                      onChange={(e) => handleChange('context', e.target.value)}
                      placeholder={`Please add detailed description about the topic.
ex) Chat Title: Would you erase your worst memory for peace of mind?
Context: A revolutionary technology can delete specific memories forever. You carry a traumatic memory that shapes who you are, but also causes ongoing suffering. Should one embrace pain that forms identity, or choose peace by removing it? Provide background, constraints, and desired perspectives.`}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-black shadow-sm min-h-[120px] overflow-y-auto modal-scroll resize-none"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Participants */}
            {step === 3 && (
              <div className="space-y-6">
                <label className="block mb-2 font-medium text-lg">Select Participants</label>

                {/* User debate role for debate type */}
                {formData.dialogueType === 'debate' && (
                  <div className="space-y-3">
                    <h3 className="text-base font-medium">Select Your Role in the Debate</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div
                        onClick={() => setUserDebateRole('pro')}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                          userDebateRole === 'pro'
                            ? 'border-emerald-600 bg-emerald-50'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="font-semibold text-gray-900">Pro (Affirmative)</div>
                        <div className="text-sm text-gray-500">Support the proposition</div>
                      </div>

                      <div
                        onClick={() => setUserDebateRole('con')}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                          userDebateRole === 'con'
                            ? 'border-rose-600 bg-rose-50'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="font-semibold text-gray-900">Con (Negative)</div>
                        <div className="text-sm text-gray-500">Oppose the proposition</div>
                      </div>

                      <div
                        onClick={() => setUserDebateRole('neutral')}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                          userDebateRole === 'neutral'
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="font-semibold text-gray-900">Observer</div>
                        <div className="text-sm text-gray-500">Watch the debate neutrally</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Moderator styles for debate */}
                {formData.dialogueType === 'debate' && (
                  <div className="mb-6">
                    <h3 className="text-base font-medium mb-3">Select Moderator Style</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {moderatorStyles.map(style => (
                        <div
                          key={style.id}
                          onClick={() => setModeratorStyleId(style.id)}
                          className={`rounded-lg border-2 transition cursor-pointer ${
                            moderatorStyleId === style.id
                              ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600'
                              : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center gap-3 p-3">
                            <img
                              src={`/moderator_portraits/Moderator${style.id}.png`}
                              alt={style.name}
                              className="w-12 h-12 rounded-md object-cover"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{style.name}</div>
                              <div className="text-sm text-gray-500">{style.description}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Free Discussion Settings (disabled; handled in EnhancedCircularChatUI) */}
                {false && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-base font-medium mb-4">Free Discussion Settings</h3>

                    {/* Auto-play toggle */}
                    <div className="mb-4">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={freeDiscussionSettings.autoPlay}
                          onChange={(e) => setFreeDiscussionSettings(prev => ({
                            ...prev,
                            autoPlay: e.target.checked
                          }))}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-700">Auto-play conversation</span>
                          <p className="text-xs text-gray-500">Philosophers will speak automatically in sequence</p>
                        </div>
                      </label>
                    </div>

                    {/* Playback speed */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Playback Speed
                      </label>
                      <div className="flex gap-2">
                        {[0.5, 1.0, 1.5, 2.0].map(speed => (
                          <button
                            key={speed}
                            type="button"
                            onClick={() => setFreeDiscussionSettings(prev => ({
                              ...prev,
                              playbackSpeed: speed
                            }))}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                              freeDiscussionSettings.playbackSpeed === speed
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Turn interval */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Turn Interval (seconds)
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="0.5"
                        value={freeDiscussionSettings.turnInterval}
                        onChange={(e) => setFreeDiscussionSettings(prev => ({
                          ...prev,
                          turnInterval: parseFloat(e.target.value)
                        }))}
                        className="w-full"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {freeDiscussionSettings.turnInterval} seconds between turns
                      </div>
                    </div>

                    {/* User interruption */}
                    <div>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={freeDiscussionSettings.allowInterruption}
                          onChange={(e) => setFreeDiscussionSettings(prev => ({
                            ...prev,
                            allowInterruption: e.target.checked
                          }))}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-700">Allow interruptions</span>
                          <p className="text-xs text-gray-500">You can interrupt the discussion at any time</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Selected philosophers display */}
                {(selectedPhilosophers.length > 0 || selectedCustomNpcs.length > 0) && (
                  <div className="mb-6">
                    <h3 className="text-base font-medium mb-3">
                      Selected Philosophers ({selectedPhilosophers.length + selectedCustomNpcs.length})
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      {[...selectedPhilosophers, ...selectedCustomNpcs].map(npcId => {
                        const npc = [...philosophers, ...customNpcs].find(p => p.id === npcId);
                        if (!npc) return null;

                        return (
                          <div key={npcId} className="flex flex-col items-center">
                            <div className="relative">
                              <img
                                src={npc.portrait_url || getPhilosopherPortraitPath(npc.name)}
                                alt={npc.name}
                                className="w-16 h-16 rounded-full object-cover ring-1 ring-gray-200"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(npc.name)}&background=random&size=64`;
                                }}
                              />
                              <button
                                onClick={() => {
                                  if (selectedPhilosophers.includes(npcId)) {
                                    togglePhilosopher(npcId);
                                  } else {
                                    toggleCustomNpc(npcId);
                                  }
                                }}
                                className="absolute -top-1 -right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 shadow"
                                aria-label="Remove philosopher"
                              >
                                ×
                              </button>

                              {/* Debate positions */}
                              {formData.dialogueType === 'debate' && (
                                <div className="mt-2 flex gap-1 justify-center">
                                  <button
                                    type="button"
                                    onClick={() => setNpcPosition(npcId, 'pro')}
                                    className={`px-2 py-0.5 rounded text-xs border ${
                                      npcPositions[npcId] === 'pro'
                                        ? 'bg-emerald-600 text-white border-transparent'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    Pro
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setNpcPosition(npcId, 'con')}
                                    className={`px-2 py-0.5 rounded text-xs border ${
                                      npcPositions[npcId] === 'con'
                                        ? 'bg-rose-600 text-white border-transparent'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    Con
                                  </button>
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-gray-700 mt-1">{npc.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Custom NPCs */}
                {customNpcs.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-base font-medium mb-2">My Custom Philosophers</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {customNpcs.map(npc => (
                        <div
                          key={npc.id}
                          className={`border rounded-lg p-3 transition select-none ${
                            selectedCustomNpcs.includes(npc.id)
                              ? 'ring-2 ring-black border-black bg-gray-100'
                              : 'hover:shadow-sm'
                          }`}
                        >
                          <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => toggleCustomNpc(npc.id)}
                          >
                            <img
                              src={npc.portrait_url || getPhilosopherPortraitPath(npc.name)}
                              alt={npc.name}
                              className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-200"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(npc.name)}&background=random&size=32`;
                              }}
                            />
                            <span className="text-sm text-gray-800">{npc.name}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              loadPhilosopherDetails(npc.id);
                              return false;
                            }}
                            className="mt-2 text-xs text-black hover:underline"
                          >
                            View details
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Classic Philosophers */}
                <div>
                  <h3 className="text-base font-medium mb-2">Classic Philosophers</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {philosophers.map(philosopher => {
                      const pid = (philosopher.id || '').toLowerCase();
                      const isFineTuned = FINE_TUNED.has(pid);
                      const isDisabled = !isFineTuned;
                      const isSelected = selectedPhilosophers.includes(philosopher.id);
                      return (
                        <div
                          key={philosopher.id}
                          className={`border rounded-lg p-3 transition select-none relative ${
                            isSelected ? 'ring-2 ring-black border-black bg-gray-100' : 'hover:shadow-sm'
                          } ${isDisabled ? 'opacity-60 grayscale cursor-not-allowed' : ''}`}
                          aria-disabled={isDisabled}
                        >
                          {isDisabled && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg">
                              <img src="/lock.png" alt="Locked" className="h-full w-auto max-w-full opacity-20 select-none object-contain" />
                            </div>
                          )}
                          <div
                            className={`flex items-center gap-2 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            onClick={() => { if (!isDisabled) togglePhilosopher(philosopher.id); }}
                          >
                            <img
                              src={philosopher.portrait_url || getPhilosopherPortraitPath(philosopher.name)}
                              alt={philosopher.name}
                              className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-200"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(philosopher.name)}&background=random&size=32`;
                              }}
                            />
                            <span className="text-sm text-gray-800">{philosopher.name}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              loadPhilosopherDetails(philosopher.id);
                              return false;
                            }}
                            className="mt-2 text-xs text-black hover:underline"
                          >
                            View details
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={goToPreviousStep}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={step <= 1}
              style={{ visibility: step > 1 ? 'visible' : 'hidden' }}
            >
              &lt;
            </button>

            <div className="text-sm text-gray-500">{step}/3</div>

            <button
              type="button"
              onClick={goToNextStep}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={step >= 3 || (step === 1 && !formData.dialogueType)}
              style={{ visibility: step < 3 ? 'visible' : 'hidden' }}
            >
              &gt;
            </button>
          </div>
        </div>

        {/* Submit Button */}
        {step === 3 && (
          <div className="px-6 py-4 border-t flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 rounded-md bg-black text-white px-4 py-2 text-sm font-medium shadow hover:bg-gray-900 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-black"
              disabled={!formData.title.trim() || (selectedPhilosophers.length + selectedCustomNpcs.length) === 0 || isCreating}
            >
              {isCreating ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Creating...
                </>
              ) : (
                'Create Chat'
              )}
            </button>
          </div>
        )}
      </div>
      
      {/* Philosopher Details Modal */}
      <PhilosopherDetailsModal
        philosopher={selectedPhilosopherDetails}
        isOpen={showPhilosopherDetails}
        onClose={() => setShowPhilosopherDetails(false)}
        onToggleSelect={(philosopherId) => {
          // 선택된 철학자 목록에서 찾기
          if (selectedPhilosophers.includes(philosopherId)) {
            togglePhilosopher(philosopherId);
          } else if (selectedCustomNpcs.includes(philosopherId)) {
            toggleCustomNpc(philosopherId);
          } else {
            // 아직 선택되지 않은 경우 적절한 목록에 추가
            const isCustomNpc = customNpcs.some(npc => npc.id === philosopherId);
            if (isCustomNpc) {
              toggleCustomNpc(philosopherId);
            } else {
              togglePhilosopher(philosopherId);
            }
          }
        }}
        isSelected={selectedPhilosophers.includes(selectedPhilosopherDetails?.id || '') || 
                   selectedCustomNpcs.includes(selectedPhilosopherDetails?.id || '')}
      />
    </>
  );
};

export default CreateChatModal; 