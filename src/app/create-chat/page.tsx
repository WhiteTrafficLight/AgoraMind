'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import chatService, { ChatRoomCreationParams } from '@/lib/ai/chatService';

interface Philosopher {
  id: string;
  name: string;
  period?: string; 
  nationality?: string;
  description?: string;
  key_concepts?: string[];
  portrait_url?: string;
}

export default function CreateChatPage() {
  const router = useRouter();
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newChatContext, setNewChatContext] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(5);
  const [selectedNPCs, setSelectedNPCs] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [customNpcs, setCustomNpcs] = useState<Philosopher[]>([]);
  
  const availableNPCs = ['Socrates', 'Plato', 'Aristotle', 'Nietzsche', 'Kant', 'Marx', 'Hegel', 'Beauvoir', 'Sartre', 'Wittgenstein', 'Camus'];

  // 기본 철학자 목록 로드 함수
  const fetchPhilosophers = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/philosophers');
      if (response.ok) {
        const data = await response.json();
        setPhilosophers(data.philosophers || []);
      } else {
        console.error('Failed to fetch philosophers');
        // 기본 철학자 목록으로 대체
        setPhilosophers(availableNPCs.map(name => ({ id: name.toLowerCase(), name })));
      }
    } catch (error) {
      console.error('Error fetching philosophers:', error);
      // 기본 철학자 목록으로 대체
      setPhilosophers(availableNPCs.map(name => ({ id: name.toLowerCase(), name })));
    }
  };

  // 사용자 커스텀 NPC 목록 로드 함수
  const fetchCustomNpcs = async () => {
    try {
      const response = await fetch('/api/npc/list');
      if (response.ok) {
        const data = await response.json();
        setCustomNpcs(data.npcs || []);
      } else {
        console.error('Failed to fetch custom NPCs');
      }
    } catch (error) {
      console.error('Error fetching custom NPCs:', error);
      setCustomNpcs([]);
    }
  };

  // 컴포넌트 마운트 시 철학자 목록과 커스텀 NPC 목록 로드
  useEffect(() => {
    fetchPhilosophers();
    fetchCustomNpcs();
  }, []);

  const toggleNPC = (npc: string) => {
    console.log('🔍 NPC 선택/해제:', npc);
    
    // ID 디버깅 - 길이, 형식 등 확인
    if (npc) {
      console.log('  🔹 NPC ID 길이:', npc.length);
      console.log('  🔹 NPC ID 형식:', npc.includes('-') ? 'UUID-like' : 'Simple string');
      
      // 이 ID로 직접 API 호출해서 데이터 확인
      fetch(`/api/npc/get?id=${encodeURIComponent(npc)}`)
        .then(res => res.json())
        .then(data => {
          console.log('  ✅ API 응답 데이터:', data);
          console.log('  ✅ NPC 이름:', data.name);
          console.log('  ✅ 프로필 URL:', data.portrait_url || 'NONE');
        })
        .catch(err => console.error('  ❌ API 호출 실패:', err));
    }
    
    if (selectedNPCs.includes(npc)) {
      setSelectedNPCs(selectedNPCs.filter(n => n !== npc));
    } else {
      setSelectedNPCs([...selectedNPCs, npc]);
    }
  };
  
  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newChatTitle.trim() || selectedNPCs.length === 0) return;
    
    setIsCreating(true);
    
    try {
      const chatParams: ChatRoomCreationParams = {
        title: newChatTitle,
        context: newChatContext,
        maxParticipants,
        npcs: selectedNPCs
      };
      
      await chatService.createChatRoom(chatParams);
      router.push('/open-chat');
    } catch (error) {
      console.error('Error creating chat:', error);
      alert('There was an error creating the chat. Please try again.');
      setIsCreating(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Create New Chat</h1>
      
      <form onSubmit={handleCreateChat} className="bg-white border border-black p-6 rounded-md shadow-sm">
        <div className="mb-4">
          <label className="block mb-1 font-medium">Chat Title</label>
          <input
            type="text"
            value={newChatTitle}
            onChange={(e) => setNewChatTitle(e.target.value)}
            placeholder="Enter a title for your chat..."
            className="w-full p-2 border border-black rounded-md"
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block mb-1 font-medium">Context</label>
          <textarea
            value={newChatContext}
            onChange={(e) => setNewChatContext(e.target.value)}
            placeholder="Provide some context for the discussion..."
            className="w-full p-2 border border-black rounded-md h-24"
          />
        </div>
        
        <div className="mb-4">
          <label className="block mb-1 font-medium">Maximum Participants</label>
          <input
            type="number"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
            min="2"
            max="10"
            className="w-full p-2 border border-black rounded-md"
          />
        </div>
        
        <div className="mb-6">
          <label className="block mb-1 font-medium">Select Participants</label>
          
          {/* My NPCs 섹션 */}
          {customNpcs.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2 text-gray-700">My NPCs</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {customNpcs.map(npc => (
                  // Custom NPC 디버깅
                  <div 
                    key={npc.id}
                    onClick={() => {
                      // 선택 전에 해당 NPC 객체 전체 정보 로그
                      console.log('📌 선택한 Custom NPC 전체 정보:', npc);
                      console.log('   ID:', npc.id);
                      console.log('   이름:', npc.name);
                      console.log('   설명:', npc.description);
                      console.log('   프로필 URL:', npc.portrait_url);
                      toggleNPC(npc.id);
                    }}
                    className={`border p-2 rounded-md cursor-pointer text-center text-sm ${
                      selectedNPCs.includes(npc.id) 
                        ? 'bg-black text-white' 
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {npc.name || '(이름 없음)'}
                    {npc.portrait_url && <span className="ml-1">🖼️</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Default Philosophers 섹션 */}
          <div>
            <h3 className="text-sm font-medium mb-2 text-gray-700">Default Philosophers</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {philosophers.map(philosopher => (
                <div 
                  key={philosopher.id}
                  onClick={() => toggleNPC(philosopher.id)}
                  className={`border p-2 rounded-md cursor-pointer text-center text-sm ${
                    selectedNPCs.includes(philosopher.id) 
                      ? 'bg-black text-white' 
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {philosopher.name}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => window.close()}
            className="px-4 py-2 border border-black rounded-md hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 flex items-center"
            disabled={!newChatTitle.trim() || selectedNPCs.length === 0 || isCreating}
          >
            {isCreating ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                Creating...
              </>
            ) : (
              'Create Chat'
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 
 