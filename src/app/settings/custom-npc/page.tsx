'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import CustomNpcCreator from '@/components/CustomNpcCreator';
import Modal from '@/components/ui/Modal';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

// NPC 타입 정의
interface CustomNpc {
  id: string;
  name: string;
  description: string;
  concepts: string[];
  voice_style: string;
  portrait_url?: string;
}

export default function CustomNpcPage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [npcs, setNpcs] = useState<CustomNpc[]>([]);
  const [loadingPortrait, setLoadingPortrait] = useState<string | null>(null);
  const [portraitMap, setPortraitMap] = useState<Record<string,string>>({});
  const [portraitError, setPortraitError] = useState<Record<string,string>>({});
  const [showModal, setShowModal] = useState(false);

  // Function to fetch NPC list
  const fetchNpcs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/npc/list');
      const data = await res.json();
      if (res.ok) setNpcs(data.npcs || []);
      else console.error('Failed to fetch NPCs', data);
    } catch (err) {
      console.error('Error fetching NPCs', err);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => { fetchNpcs(); }, []);

  // 이미지 생성 후 DB 업데이트 함수 추가
  const updateNpcPortrait = async (npcId: string, portraitUrl: string) => {
    try {
      const res = await fetch('/api/npc/update-portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npcId, portraitUrl })
      });
      
      if (!res.ok) {
        console.error('Failed to update NPC portrait in DB:', await res.json());
      } else {
        console.log('NPC portrait updated in DB successfully');
      }
    } catch (err) {
      console.error('Error updating NPC portrait in DB:', err);
    }
  };

  // Callback when a new NPC is created
  const handleNpcCreated = async (npc: CustomNpc) => {
    // Refresh list
    await fetchNpcs();
    // Generate portrait via Python backend
    setLoadingPortrait(npc.id);
    setPortraitError(prev => ({ ...prev, [npc.id]: '' }));
    try {
      const res = await fetch('http://localhost:8000/api/portraits/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npc_name: npc.name,
          role: npc.description,
          reference_philosophers: npc.concepts,
          voice_style: npc.voice_style,
        })
      });
      const data = await res.json();
      console.log('Portrait generation response:', data, 'status:', res.status);
      if (res.ok && data.url) {
        setPortraitMap(prev => ({ ...prev, [npc.id]: data.url }));
        // DB에 portrait_url 업데이트
        await updateNpcPortrait(npc.id, data.url);
      } else {
        setPortraitError(prev => ({ ...prev, [npc.id]: data.detail || data.message || 'Portrait generation failed' }));
      }
    } catch (e: any) {
      console.error('Portrait generation error', e);
      setPortraitError(prev => ({ ...prev, [npc.id]: e.message || 'Error generating portrait' }));
    } finally {
      setLoadingPortrait(null);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Custom Philosophers</h1>
          <p className="text-gray-600 mb-8">
            Create custom philosophical personas to explore unique perspectives and 
            engage in dialogues with your own philosophical constructs.
          </p>
          
          {/* Create New Philosopher Button */}
          <div className="mb-8">
            <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition">
              + Create New Philosopher
            </button>
          </div>
          {/* NPC Creation Modal */}
          {showModal && (
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create New Philosopher">
              <CustomNpcCreator onNpcCreated={async (npc) => { await handleNpcCreated(npc); setShowModal(false); }} />
            </Modal>
          )}
          
          {/* Your Custom Philosophers */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Your Custom Philosophers</h2>
              <div className="text-sm text-gray-500">{npcs.length} philosophers</div>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
              </div>
            ) : (
              <div className="md:grid md:grid-cols-2 md:gap-8">
                {npcs.map(npc => (
                  <div key={npc.id} className="bg-white border-t border-b border-gray-200 py-6 overflow-hidden relative" style={{ marginBottom: '2rem' }}>
                    <div className="p-5 flex items-start">
                      {/* Portrait or spinner */}
                      <div className="mr-4 self-center">
                        <div className="relative" style={{ width: '115px', height: '115px' }}>
                          <img
                            src={portraitMap[npc.id] || npc.portrait_url || '/Profile.png'}
                            crossOrigin="anonymous"
                            alt={npc.name}
                            className="rounded-full object-cover"
                            style={{ 
                              width: '115px', 
                              height: '115px',
                              maxWidth: '115px',
                              maxHeight: '115px'
                            }}
                            onError={(e) => {
                              console.error(`Image load error for ${npc.id}:`, e);
                              (e.target as HTMLImageElement).src = '/Profile.png';
                            }}
                          />
                          {loadingPortrait === npc.id && (
                            <div className="absolute inset-0 z-10 flex justify-center items-center bg-white bg-opacity-50 rounded-full">
                              <div className="animate-spin rounded-full h-12 w-12 border-2 border-t-2 border-gray-900"></div>
                            </div>
                          )}
                        </div>
                        {portraitError[npc.id] && (
                          <div className="text-red-500 text-xs mt-1">{portraitError[npc.id]}</div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-2">{npc.name}</h3>
                        <p className="text-gray-600 text-sm mb-3">{npc.description}</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {npc.concepts.map((concept: string, idx: number) => (
                            <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                              {concept}
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-4 mt-4 justify-end" style={{ position: 'absolute', right: '20px', bottom: '12px', zIndex: 20 }}>
                          <button className="text-sm text-gray-500 hover:text-gray-800 transition">
                            <PencilIcon className="h-4 w-4 inline mr-1" />
                            Edit
                          </button>
                          <button className="text-sm text-red-500 hover:text-red-700 transition font-medium">
                            <TrashIcon className="h-4 w-4 inline mr-1" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {!isLoading && npcs.length === 0 && (
              <div className="text-center py-10 bg-gray-50 rounded-lg">
                <p className="text-gray-500 mb-4">You haven't created any custom philosophers yet.</p>
                <button className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition">
                  Create Your First Philosopher
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 