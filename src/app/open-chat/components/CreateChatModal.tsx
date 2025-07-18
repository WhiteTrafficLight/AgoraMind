import React, { useState, useRef } from 'react';
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
  const [formData, setFormData] = useState<ChatRoomCreationParams>({
    title: '',
    maxParticipants: 6,
    npcs: [],
    isPublic: true,
    generateInitialMessage: true,
    dialogueType: 'debate',
    context: '',
    contextUrl: '',
    contextFileContent: ''
  });

  const [contextType, setContextType] = useState<'none' | 'url' | 'file'>('none');
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
    } else if (contextType === 'file' && formData.contextFileContent) {
      finalContext = formData.contextFileContent;
    }

    const finalFormData: ChatRoomCreationParams = {
      ...formData,
      context: finalContext,
      contextUrl: contextType === 'url' ? formData.contextUrl : undefined,
      contextFileContent: contextType === 'file' ? formData.contextFileContent : undefined
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

    try {
      await onCreateChat(finalFormData);
    } catch (error) {
      loggers.ui.error('Error creating chat:', error);
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
      dialogueType: 'debate',
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
      {/* CSS Styles */}
      <style jsx>{`
        .context-section {
          margin-bottom: 24px;
        }
        
        .context-tab-container {
          display: flex;
          border-bottom: 2px solid #e5e7eb;
          margin-bottom: 16px;
        }
        
        .context-tab {
          padding: 12px 16px;
          background: none;
          border: none;
          font-weight: 500;
          font-size: 14px;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s ease;
          border-bottom: 2px solid transparent;
          position: relative;
          bottom: -2px;
        }
        
        .context-tab:hover {
          color: #374151;
        }
        
        .context-tab-active {
          color: #111827 !important;
          border-bottom-color: #111827 !important;
        }
        
        .file-upload-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          transition: background-color 0.2s ease;
          font-size: 14px;
          color: #374151;
        }
        
        .file-upload-button:hover {
          background-color: #f9fafb;
        }
        
        .file-upload-icon {
          height: 20px;
          width: 20px;
        }
        
        .hidden {
          display: none;
        }

        .dialogue-pattern-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-top: 16px;
        }
        
        .dialogue-pattern-card {
          position: relative;
          padding: 24px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: white;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        
        .dialogue-pattern-card:hover {
          border-color: #d1d5db;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .dialogue-pattern-card.selected {
          border-color: #111827;
          background: #f9fafb;
        }
        
        .dialogue-pattern-card.disabled {
          background: #f3f4f6;
          border-color: #e5e7eb;
          cursor: not-allowed;
          opacity: 0.6;
        }
        
        .dialogue-pattern-card.disabled:hover {
          border-color: #e5e7eb;
          box-shadow: none;
        }
        
        .dialogue-pattern-image {
          width: 80px;
          height: 80px;
          object-fit: cover;
          border-radius: 8px;
        }
        
        .dialogue-pattern-title {
          font-weight: 600;
          font-size: 16px;
          color: #111827;
        }
        
        .dialogue-pattern-card.disabled .dialogue-pattern-title {
          color: #9ca3af;
        }
        
        .dialogue-pattern-tooltip {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.4;
        }
        
        .dialogue-pattern-card.disabled .dialogue-pattern-tooltip {
          color: #d1d5db;
        }
        
        .coming-soon-text {
          position: absolute;
          top: 8px;
          right: 8px;
          background: #6b7280;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>
      
      {/* Background overlay */}
      <div className="create-chat-modal-overlay" onClick={handleClose}></div>
      
      {/* Modal container */}
      <div className="create-chat-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="create-chat-modal-header">
          <h2 className="text-2xl font-bold">Create New Chat</h2>
          <button 
            onClick={handleClose}
            className="create-chat-modal-close"
            disabled={isCreating}
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div className="create-chat-modal-content">
          <form onSubmit={handleSubmit}>
            {/* Step 1: Dialogue Pattern */}
            {step === 1 && (
              <div className="create-chat-step-container">
                <label className="create-chat-label">Dialogue Pattern</label>
                <div className="dialogue-pattern-grid">
                  <div 
                    className={`dialogue-pattern-card disabled`}
                  >
                    <div className="coming-soon-text">Coming Soon</div>
                    <img src="/Free.png" alt="Free Discussion" className="dialogue-pattern-image" />
                    <div className="dialogue-pattern-title">Free Discussion</div>
                    <div className="dialogue-pattern-tooltip">
                      Open-format dialogue<br/>with no specific structure
                    </div>
                  </div>
                  
                  <div 
                    className={`dialogue-pattern-card ${formData.dialogueType === 'debate' ? 'selected' : ''}`}
                    onClick={() => handleDialogueTypeChange('debate')}
                  >
                    <img src="/ProCon.png" alt="Pro-Con Debate" className="dialogue-pattern-image" />
                    <div className="dialogue-pattern-title">Pro-Con Debate</div>
                    <div className="dialogue-pattern-tooltip">
                      Structured debate<br/>with opposing positions
                    </div>
                  </div>
                  
                  <div 
                    className={`dialogue-pattern-card disabled`}
                  >
                    <div className="coming-soon-text">Coming Soon</div>
                    <img src="/Socratic.png" alt="Socratic Dialogue" className="dialogue-pattern-image" />
                    <div className="dialogue-pattern-title">Socratic Dialogue</div>
                    <div className="dialogue-pattern-tooltip">
                      Question-based approach<br/>to explore a topic
                    </div>
                  </div>
                  
                  <div 
                    className={`dialogue-pattern-card disabled`}
                  >
                    <div className="coming-soon-text">Coming Soon</div>
                    <img src="/Dialectical.png" alt="Dialectical Discussion" className="dialogue-pattern-image" />
                    <div className="dialogue-pattern-title">Dialectical Discussion</div>
                    <div className="dialogue-pattern-tooltip">
                      Thesis-Antithesis-Synthesis<br/>format
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Chat Title and Context */}
            {step === 2 && (
              <div className="create-chat-step-container">
                <div className="mb-8">
                  <label className="create-chat-label">Chat Title:</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    placeholder="What would you like to discuss today?"
                    className="create-chat-input"
                    required
                  />
                </div>

                {/* Recommended Topics Section */}
                <div className="recommended-topics-section">
                  <div 
                    className="recommended-topics-header"
                    onClick={() => setShowRecommendedTopics(!showRecommendedTopics)}
                  >
                    <div className="recommended-topics-label">
                      <svg 
                        className="recommended-topics-icon" 
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
                  
                  <div className={`recommended-topics-content ${showRecommendedTopics ? '' : 'hidden'}`}>
                    {formData.dialogueType === 'free' && (
                      <ul className="recommended-topics-list">
                        <li>&quot;The meaning of happiness in different philosophical traditions&quot;</li>
                        <li>&quot;How does technology shape human experience in the modern world?&quot;</li>
                        <li>&quot;The relationship between art and moral values&quot;</li>
                        <li>&quot;Free will and determinism: Are our choices truly free?&quot;</li>
                        <li>&quot;The nature of consciousness and self-awareness&quot;</li>
                      </ul>
                    )}
                    
                    {formData.dialogueType === 'debate' && (
                      <ul className="recommended-topics-list">
                        <li>&quot;Is artificial intelligence beneficial or harmful to humanity?&quot;</li>
                        <li>&quot;Should we prioritize individual liberty over collective welfare?&quot;</li>
                        <li>&quot;Is objective morality possible without religion?&quot;</li>
                        <li>&quot;Should societies focus on equality of opportunity or equality of outcome?&quot;</li>
                        <li>&quot;Is human nature fundamentally good or self-interested?&quot;</li>
                      </ul>
                    )}
                    
                    {formData.dialogueType === 'socratic' && (
                      <ul className="recommended-topics-list">
                        <li>&quot;What is justice? How can we recognize a just society?&quot;</li>
                        <li>&quot;What constitutes knowledge versus mere opinion?&quot;</li>
                        <li>&quot;What is the nature of virtue? Can it be taught?&quot;</li>
                        <li>&quot;What makes a life worth living? How should we define success?&quot;</li>
                        <li>&quot;How should we understand the relationship between mind and body?&quot;</li>
                      </ul>
                    )}
                    
                    {formData.dialogueType === 'dialectical' && (
                      <ul className="recommended-topics-list">
                        <li>&quot;Thesis: Reason is the primary source of knowledge | Antithesis: Experience is the primary source of knowledge&quot;</li>
                        <li>&quot;Thesis: Morality is objective | Antithesis: Morality is culturally relative&quot;</li>
                        <li>&quot;Thesis: Human technology enhances our humanity | Antithesis: Technology alienates us from our true nature&quot;</li>
                        <li>&quot;Thesis: Free markets maximize human flourishing | Antithesis: Markets require regulation to prevent exploitation&quot;</li>
                        <li>&quot;Thesis: Mind is separate from matter | Antithesis: Mind emerges from physical processes&quot;</li>
                      </ul>
                    )}
                  </div>
                  
                  {/* Quick topic buttons */}
                  <div className="topic-quick-buttons">
                    {formData.dialogueType === 'free' && (
                      <>
                        <button 
                          type="button" 
                          onClick={() => handleChange('title', "The meaning of happiness in different philosophical traditions")}
                          className="topic-quick-button"
                        >
                          Happiness
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleChange('title', "The nature of consciousness and self-awareness")}
                          className="topic-quick-button"
                        >
                          Consciousness
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleChange('title', "How does technology shape human experience?")}
                          className="topic-quick-button"
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
                          className="topic-quick-button"
                        >
                          AI Ethics
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleChange('title', "Individual liberty vs. collective welfare")}
                          className="topic-quick-button"
                        >
                          Liberty vs. Community
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleChange('title', "Is human nature fundamentally good or self-interested?")}
                          className="topic-quick-button"
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
                          className="topic-quick-button"
                        >
                          On Justice
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleChange('title', "What constitutes knowledge versus mere opinion?")}
                          className="topic-quick-button"
                        >
                          Knowledge vs. Opinion
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleChange('title', "What makes a life worth living?")}
                          className="topic-quick-button"
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
                          className="topic-quick-button"
                        >
                          Reason vs. Experience
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleChange('title', "Is morality objective or culturally relative?")}
                          className="topic-quick-button"
                        >
                          Moral Objectivity
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleChange('title', "Mind-body relationship: dualism or physicalism?")}
                          className="topic-quick-button"
                        >
                          Mind-Body Problem
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="context-section">
                  <label className="create-chat-label">Context</label>
                  
                  {/* Context type selection */}
                  <div className="context-tab-container">
                    <button
                      type="button"
                      onClick={() => setContextType('none')}
                      className={`context-tab ${contextType === 'none' ? 'context-tab-active' : ''}`}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      onClick={() => setContextType('url')}
                      className={`context-tab ${contextType === 'url' ? 'context-tab-active' : ''}`}
                    >
                      URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setContextType('file')}
                      className={`context-tab ${contextType === 'file' ? 'context-tab-active' : ''}`}
                    >
                      File
                    </button>
                  </div>

                  {/* URL input */}
                  {contextType === 'url' && (
                    <input
                      type="url"
                      value={formData.contextUrl}
                      onChange={(e) => handleChange('contextUrl', e.target.value)}
                      placeholder="https://example.com/article"
                      className="create-chat-input"
                    />
                  )}

                  {/* File upload */}
                  {contextType === 'file' && (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.md,.pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="file-upload-button"
                      >
                        <DocumentArrowUpIcon className="file-upload-icon" />
                        {formData.context || 'Choose file (txt, md, pdf)'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Participants */}
            {step === 3 && (
              <div className="create-chat-step-container">
                <label className="block mb-4 font-medium text-lg">Select Participants</label>
                
                {/* User debate role for debate type */}
                {formData.dialogueType === 'debate' && (
                  <div className="debate-role-selection-container">
                    <h3 className="debate-role-selection-title">Select Your Role in the Debate</h3>
                    <div className="debate-role-cards-container">
                      <div 
                        onClick={() => setUserDebateRole('pro')}
                        className={`debate-role-card ${userDebateRole === 'pro' ? 'pro' : ''}`}
                      >
                        <div className="debate-role-card-title">
                          Pro (Affirmative)
                        </div>
                        <div className="debate-role-card-description">Support the proposition</div>
                      </div>
                      
                      <div 
                        onClick={() => setUserDebateRole('con')}
                        className={`debate-role-card ${userDebateRole === 'con' ? 'con' : ''}`}
                      >
                        <div className="debate-role-card-title">
                          Con (Negative)
                        </div>
                        <div className="debate-role-card-description">Oppose the proposition</div>
                      </div>
                      
                      <div 
                        onClick={() => setUserDebateRole('neutral')}
                        className={`debate-role-card ${userDebateRole === 'neutral' ? 'neutral' : ''}`}
                      >
                        <div className="debate-role-card-title">
                          Observer
                        </div>
                        <div className="debate-role-card-description">Watch the debate neutrally</div>
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
                          className={`moderator-selection-card ${
                            moderatorStyleId === style.id ? 'selected' : ''
                          }`}
                        >
                          <div className="moderator-card-content">
                            <img
                              src={`/moderator_portraits/Moderator${style.id}.png`}
                              alt={style.name}
                              className="moderator-image"
                            />
                            <div className="moderator-info">
                              <div className="moderator-name">{style.name}</div>
                              <div className="moderator-description">{style.description}</div>
                            </div>
                          </div>
                        </div>
                      ))}
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
                          <div key={npcId} className="selected-philosopher-container">
                            <div className="selected-philosopher-image-wrapper">
                              <img
                                src={npc.portrait_url || getPhilosopherPortraitPath(npc.name)}
                                alt={npc.name}
                                className="philosopher-image-medium"
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
                                className="selected-philosopher-remove"
                                aria-label="Remove philosopher"
                              >
                                ×
                              </button>
                              
                              {/* Debate positions */}
                              {formData.dialogueType === 'debate' && (
                                <div className="debate-position-buttons">
                                  <button
                                    type="button"
                                    onClick={() => setNpcPosition(npcId, 'pro')}
                                    className={`debate-position-button ${
                                      npcPositions[npcId] === 'pro' ? 'pro' : 'neutral'
                                    }`}
                                  >
                                    Pro
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setNpcPosition(npcId, 'con')}
                                    className={`debate-position-button ${
                                      npcPositions[npcId] === 'con' ? 'con' : 'neutral'
                                    }`}
                                  >
                                    Con
                                  </button>
                                </div>
                              )}
                            </div>
                            <span className="selected-philosopher-name">
                              {npc.name}
                            </span>
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
                          className={`philosopher-selection-card ${
                            selectedCustomNpcs.includes(npc.id) ? 'selected' : ''
                          }`}
                        >
                          <div 
                            className="philosopher-card-content"
                            onClick={() => toggleCustomNpc(npc.id)}
                          >
                            <img
                              src={npc.portrait_url || getPhilosopherPortraitPath(npc.name)}
                              alt={npc.name}
                              className="philosopher-image-small"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(npc.name)}&background=random&size=32`;
                              }}
                            />
                            <span className="philosopher-card-name">{npc.name}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              loadPhilosopherDetails(npc.id);
                              return false;
                            }}
                            className="view-details-button"
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
                    {philosophers.map(philosopher => (
                      <div 
                        key={philosopher.id}
                        className={`philosopher-selection-card ${
                          selectedPhilosophers.includes(philosopher.id) ? 'selected' : ''
                        }`}
                      >
                        <div 
                          className="philosopher-card-content"
                          onClick={() => togglePhilosopher(philosopher.id)}
                        >
                          <img
                            src={philosopher.portrait_url || getPhilosopherPortraitPath(philosopher.name)}
                            alt={philosopher.name}
                            className="philosopher-image-small"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(philosopher.name)}&background=random&size=32`;
                            }}
                          />
                          <span className="philosopher-card-name">{philosopher.name}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            loadPhilosopherDetails(philosopher.id);
                            return false;
                          }}
                          className="view-details-button"
                        >
                          View details
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer Navigation */}
        <div className="create-chat-footer">
          <div className="create-chat-navigation">
            <button
              type="button"
              onClick={goToPreviousStep}
              className="create-chat-nav-button"
              disabled={step <= 1}
              style={{ visibility: step > 1 ? 'visible' : 'hidden' }}
            >
              &lt;
            </button>
            
            <div className="create-chat-step-indicator">
              {step}/3
            </div>
            
            <button
              type="button"
              onClick={goToNextStep}
              className="create-chat-nav-button"
              disabled={step >= 3 || (step === 1 && !formData.dialogueType)}
              style={{ visibility: step < 3 ? 'visible' : 'hidden' }}
            >
              &gt;
            </button>
          </div>
        </div>

        {/* Submit Button */}
        {step === 3 && (
          <div className="create-chat-actions">
            <button
              type="button"
              onClick={handleSubmit}
              className="create-chat-submit"
              disabled={!formData.title.trim() || (selectedPhilosophers.length + selectedCustomNpcs.length) === 0 || isCreating}
            >
              {isCreating ? (
                <>
                  <span className="loading-spinner"></span>
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