'use client';

import { useState, useEffect } from 'react';

// 철학자 정보 인터페이스
interface Philosopher {
  id: string;
  name: string;
  period?: string;
  nationality?: string;
  description?: string;
  key_concepts?: string[];
  quote?: string;
  portrait_url?: string;
}

// NPC 생성에 필요한 속성 타입 정의
export interface CustomNpcProps {
  name: string;
  role: string;
  voice_style: string;
  reference_philosophers: string[];
  communication_style: string;
  debate_approach: string;
}

// 사용 가능한 철학자 목록
const AVAILABLE_PHILOSOPHERS = [
  'Socrates', 'Plato', 'Aristotle', 'Kant', 'Nietzsche', 
  'Hegel', 'Marx', 'Sartre', 'Camus', 'Simone de Beauvoir',
  'Rousseau', 'Confucius', 'Lao Tzu', 'Buddha', 'Wittgenstein'
];

// 통신 스타일 옵션
const COMMUNICATION_STYLES = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'assertive', label: 'Assertive' },
  { value: 'collaborative', label: 'Collaborative' },
  { value: 'analytical', label: 'Analytical' }
];

// 토론 접근 방식 옵션
const DEBATE_APPROACHES = [
  { value: 'dialectical', label: 'Dialectical' },
  { value: 'analytical', label: 'Analytical' },
  { value: 'pragmatic', label: 'Pragmatic' },
  { value: 'critical', label: 'Critical' }
];

// Props for CustomNpcCreator
interface CustomNpcCreatorProps {
  onNpcCreated?: (npc: { id: string; name: string; description: string; concepts: string[]; voice_style: string }) => void;
}

export default function CustomNpcCreator({ onNpcCreated }: CustomNpcCreatorProps) {
  // 상태 관리
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [selectedPhilosopherDetails, setSelectedPhilosopherDetails] = useState<Philosopher | null>(null);
  const [showPhilosopherDetails, setShowPhilosopherDetails] = useState(false);
  
  // NPC 속성 상태
  const [npc, setNpc] = useState<CustomNpcProps>({
    name: '',
    role: '',
    voice_style: '',
    reference_philosophers: [],
    communication_style: 'balanced',
    debate_approach: 'dialectical'
  });

  // 철학자 목록 로드
  useEffect(() => {
    const fetchPhilosophers = async () => {
      try {
        // API 서버에서 철학자 목록 가져오기
        const response = await fetch('http://localhost:8000/api/philosophers');
        if (response.ok) {
          const data = await response.json();
          setPhilosophers(data.philosophers);
        } else {
          console.error('Failed to fetch philosophers');
        }
      } catch (error) {
        console.error('Error fetching philosophers:', error);
        // 기본 철학자 목록 사용
        setPhilosophers([
          { id: 'socrates', name: 'Socrates' },
          { id: 'plato', name: 'Plato' },
          { id: 'aristotle', name: 'Aristotle' },
          { id: 'kant', name: 'Kant' },
          { id: 'nietzsche', name: 'Nietzsche' },
          { id: 'hegel', name: 'Hegel' },
          { id: 'marx', name: 'Marx' },
          { id: 'sartre', name: 'Sartre' },
          { id: 'camus', name: 'Camus' },
          { id: 'beauvoir', name: 'Simone de Beauvoir' },
          { id: 'rousseau', name: 'Rousseau' },
          { id: 'confucius', name: 'Confucius' },
          { id: 'laozi', name: 'Lao Tzu' },
          { id: 'buddha', name: 'Buddha' },
          { id: 'wittgenstein', name: 'Wittgenstein' }
        ]);
      }
    };

    fetchPhilosophers();
  }, []);

  // 철학자 세부 정보 로드
  const loadPhilosopherDetails = async (philosopherId: string) => {
    try {
      setSelectedPhilosopherDetails(null);
      // API 서버에서 철학자 세부 정보 가져오기
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

  // 입력 변경 핸들러
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNpc({
      ...npc,
      [e.target.name]: e.target.value
    });
  };

  // 드롭다운 변경 핸들러
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNpc({
      ...npc,
      [e.target.name]: e.target.value
    });
  };

  // 철학자 선택 핸들러 (최대 3명 선택 제한)
  const handlePhilosopherSelect = (philosopherId: string) => {
    setError(null);
    setNpc(prev => {
      const selected = prev.reference_philosophers;
      let newSelected: string[];
      if (selected.includes(philosopherId)) {
        // 제거
        newSelected = selected.filter(id => id !== philosopherId);
      } else {
        // 추가 (최대 3개)
        if (selected.length >= 3) {
          setError('You can select up to 3 philosophers.');
          return prev;
        }
        newSelected = [...selected, philosopherId];
      }
      return { ...prev, reference_philosophers: newSelected };
    });
  };

  // NPC 생성 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // 필수 필드 검증
      if (!npc.name || !npc.role || !npc.voice_style || npc.reference_philosophers.length === 0) {
        throw new Error('Please fill in all required fields and select at least one philosopher');
      }

      // 백엔드 API 호출
      const response = await fetch('/api/npc/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(npc)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create NPC');
      }

      const data = await response.json();
      console.log('Created NPC:', data);
      setSuccess(true);
      
      // Notify parent of new NPC
      if (onNpcCreated) {
        onNpcCreated({
          id: data.id,
          name: data.npc.name,
          description: data.npc.role,
          concepts: data.npc.reference_philosophers,
          voice_style: data.npc.voice_style
        });
      }
      
      // 폼 초기화
      setNpc({
        name: '',
        role: '',
        voice_style: '',
        reference_philosophers: [],
        communication_style: 'balanced',
        debate_approach: 'dialectical'
      });
    } catch (err) {
      console.error('Error creating NPC:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  // 철학자 세부 정보 모달
  const PhilosopherDetailsModal = () => {
    if (!selectedPhilosopherDetails) return null;
    
    // 기본 아바타 생성 함수
    const getDefaultAvatar = () => {
      const name = selectedPhilosopherDetails.name || 'Philosopher';
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128&font-size=0.5`;
    };

    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-30 z-50 transition-opacity opacity-100 pointer-events-auto flex items-center justify-center"
        onClick={() => setShowPhilosopherDetails(false)}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
      >
        <div 
          className="fixed bg-white rounded-2xl w-full max-h-[80vh] overflow-y-auto z-[101]"
          onClick={e => e.stopPropagation()}
          style={{ 
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white', 
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '-10px 0 20px -5px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.2)',
            width: '90%',
            maxWidth: '500px'
          }}
        >
          <div className="flex justify-end">
            <button 
              className="text-gray-500 hover:text-gray-800 absolute top-3 right-3 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200" 
              onClick={() => setShowPhilosopherDetails(false)}
              style={{ 
                fontSize: '16px', 
                fontWeight: 'bold',
                border: 'none', 
                transition: 'all 0.2s',
                width: '28px',
                height: '28px',
                borderRadius: '50%'
              }}
            >
              ✕
            </button>
          </div>
          
          <div className="flex items-center mb-4 mt-2">
            <div className="mr-10 flex-shrink-0">
              <img
                src={selectedPhilosopherDetails.portrait_url ?? getDefaultAvatar()}
                alt={selectedPhilosopherDetails.name || 'Philosopher'}
                width={144}
                height={144}
                style={{ objectFit: 'cover', objectPosition: 'top center', borderRadius: '50%' }}
                onError={(e) => {
                  // 이미지 로드 실패 시 기본 아바타로 대체
                  (e.target as HTMLImageElement).src = getDefaultAvatar();
                }}
              />
            </div>
            <div>
              <h3 className="text-4xl font-bold" style={{ color: 'black' }}>{selectedPhilosopherDetails.name}</h3>
              <div className="text-sm text-gray-500">
                {selectedPhilosopherDetails.period && <div>{selectedPhilosopherDetails.nationality} • {selectedPhilosopherDetails.period}</div>}
              </div>
            </div>
          </div>
          
          {selectedPhilosopherDetails.quote && (
            <div 
              className="mt-3 italic border-l-4 border-gray-200 pl-3 py-1 text-gray-600 text-sm"
              style={{ borderLeftColor: '#e5e7eb', paddingLeft: '12px' }}
            >
              "{selectedPhilosopherDetails.quote}"
            </div>
          )}
          
          {selectedPhilosopherDetails.description && (
            <div 
              className="mt-3 text-gray-700 text-sm"
              style={{ color: '#374151', lineHeight: '1.5' }}
            >
              {selectedPhilosopherDetails.description}
            </div>
          )}
          
          {selectedPhilosopherDetails.key_concepts && selectedPhilosopherDetails.key_concepts.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2 text-sm" style={{ color: '#111827' }}>Key Concepts</h4>
              <div className="flex flex-wrap gap-1">
                {selectedPhilosopherDetails.key_concepts.map((concept, index) => (
                  <span 
                    key={index} 
                    className="bg-gray-100 px-2 py-1 rounded-full text-xs"
                    style={{ backgroundColor: '#f3f4f6', borderRadius: '9999px', padding: '4px 8px' }}
                  >
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-5 flex justify-end">
            <button 
              className="px-3 py-1.5 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition text-sm"
              style={{ 
                backgroundColor: '#1f2937', 
                color: 'white', 
                borderRadius: '9999px', 
                padding: '6px 12px',
                transition: 'all 0.2s'
              }}
              onClick={() => {
                handlePhilosopherSelect(selectedPhilosopherDetails.id);
                setShowPhilosopherDetails(false);
              }}
            >
              {npc.reference_philosophers.includes(selectedPhilosopherDetails.id) 
                ? 'Remove Influence' 
                : 'Add as Influence'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg p-4">
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 text-green-700 p-3 rounded mb-4">
          Philosopher created successfully!
        </div>
      )}
      
      {showPhilosopherDetails && <PhilosopherDetailsModal />}
      
      <form onSubmit={handleSubmit} className="space-y-6">
          {/* 기본 정보 */}
        <div>
          <h3 className="text-lg font-medium mb-4">Basic Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                id="name"
                type="text"
              name="name"
              value={npc.name}
              onChange={handleInputChange}
              required
              placeholder="e.g., Modern Socrates"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                Role/Focus *
              </label>
              <input
                id="role"
                type="text"
              name="role"
              value={npc.role}
              onChange={handleInputChange}
              required
                placeholder="e.g., Digital Ethics Explorer"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        
        {/* 섹션 구분선 */}
        <hr className="border-t border-gray-200 my-6" />
        
        {/* 스타일 */}
        <div>
          <h3 className="text-lg font-medium mb-4">Voice & Style</h3>
          
          <div className="mb-4">
            <label htmlFor="voice_style" className="block text-sm font-medium text-gray-700 mb-1">
              Voice Style *
            </label>
            <textarea
              id="voice_style"
              name="voice_style"
              value={npc.voice_style}
              onChange={handleInputChange}
              required
              placeholder="Describe how this philosopher speaks, writes, and expresses ideas..."
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="communication_style" className="block text-sm font-medium text-gray-700 mb-1">
                Communication Style
              </label>
              <select
                id="communication_style"
                name="communication_style"
                value={npc.communication_style}
                onChange={handleSelectChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COMMUNICATION_STYLES.map(style => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="debate_approach" className="block text-sm font-medium text-gray-700 mb-1">
                Debate Approach
              </label>
              <select
                id="debate_approach"
                name="debate_approach"
                value={npc.debate_approach}
                onChange={handleSelectChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DEBATE_APPROACHES.map(approach => (
                  <option key={approach.value} value={approach.value}>
                    {approach.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        {/* 섹션 구분선 */}
        <hr className="border-t border-gray-200 my-6" />
        
        {/* 철학적 영향 */}
        <div>
          <h3 className="text-lg font-medium mb-4">Philosophical Influences</h3>
          <p className="text-sm text-gray-500 mb-3">
            Select philosophers that influence this custom persona (select at least one). Click on info (ⓘ) to learn more.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {philosophers.map(philosopher => (
              <div 
                key={philosopher.id}
                className="relative group"
              >
                <div className="flex items-center">
                  <div 
                    onClick={() => handlePhilosopherSelect(philosopher.id)}
                    className={`p-2 text-sm rounded cursor-pointer text-center transition flex-grow 
                      ${npc.reference_philosophers.includes(philosopher.id) 
                        ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'}`}
                  >
                    {philosopher.name}
                  </div>
                  <button
                    type="button"
                    className="ml-1 text-gray-400 hover:text-gray-600 p-1"
                    onClick={() => loadPhilosopherDetails(philosopher.id)}
                  >
                    ⓘ
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* 선택된 철학자 태그 표시 (최대 3명) */}
          {npc.reference_philosophers.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-4">
              {npc.reference_philosophers.map(id => {
                const phil = philosophers.find(p => p.id === id);
                if (!phil) return null;
                const avatarUrl = phil.portrait_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(phil.name)}&background=random&size=128&font-size=0.5`;
                return (
                  <div key={id} className="relative flex flex-col items-center" style={{ width: '144px' }}>
                    <img
                      src={avatarUrl}
                      alt={phil.name}
                      width={144}
                      height={144}
                      style={{
                        objectFit: 'cover',
                        objectPosition: 'top center',
                        borderRadius: '50%',
                        boxShadow: '-10px 0 20px -5px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.2)'
                      }}
                      onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(phil.name)}&background=random&size=128&font-size=0.5`; }}
                    />
                    <button
                      type="button"
                      onClick={() => handlePhilosopherSelect(id)}
                      aria-label="Remove influence"
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '28px',
                        height: '28px',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        color: '#4B5563',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      &times;
                    </button>
                    <span style={{ marginTop: '4px', fontSize: '12px', textAlign: 'center', color: '#374151', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {phil.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* 섹션 구분선 */}
        <hr className="border-t border-gray-200 my-6" />
        
        {/* 버튼 */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => {
              setNpc({
                name: '',
                role: '',
                voice_style: '',
                reference_philosophers: [],
                communication_style: 'balanced',
                debate_approach: 'dialectical'
              });
              setError(null);
              setSuccess(false);
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
          >
            Reset
          </button>
          
          <button
              type="submit" 
              disabled={loading}
            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
          >
            {loading ? (
              <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-white rounded-full"></div>
            ) : (
              'Create'
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 