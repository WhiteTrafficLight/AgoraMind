'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import CustomNpcCreator from '@/components/CustomNpcCreator';
import Modal from '@/components/ui/Modal';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import Header from '@/components/ui/Header';

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

  // 상대 URL로 변환하는 함수
  const getRelativePortraitUrl = (url: string) => {
    // 백엔드 URL에서 상대 경로로 변환 (http://localhost:8000/portraits/file.jpg -> /portraits/file.jpg)
    if (!url) return '';
    if (url.startsWith('http://localhost:8000/portraits/')) {
      return `/portraits/${url.split('/portraits/')[1]}`;
    }
    return url;
  };

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
        // URL을 상대 경로로 변환하여 저장
        const relativeUrl = getRelativePortraitUrl(data.url);
        setPortraitMap(prev => ({ ...prev, [npc.id]: relativeUrl }));
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
    <div className="min-h-screen bg-white px-6 py-8">
      <main className="max-w-6xl mx-auto">
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Custom Philosophers</h1>

          <div className="space-y-4 text-gray-700">
            <p>
              Create your own AI philosopher with unique perspectives and approaches. You can customize their personality,
              philosophical stance, and debate style.
            </p>
            <p>
              Your custom philosophers will be available in all your conversations and can interact with the built-in historical philosophers.
              Whether you want to create a modern thinker, blend different philosophical traditions, or explore entirely new perspectives, the choice is yours.
            </p>
            <p>
              <strong>Note:</strong> Custom NPCs are currently in beta. You can create and edit them, but some advanced features like detailed philosophical analysis
              and cross-referencing with historical texts are still being developed.
            </p>
            <p>
              <strong>Tip:</strong> For best results, provide detailed descriptions of your philosopher&apos;s views, their approach to ethical questions,
              and how they might respond to contemporary issues.
            </p>
          </div>

          <div>
            <button onClick={() => setShowModal(true)} className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">+ Create New Philosopher</button>
          </div>

          {showModal && (
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create New Philosopher">
              <CustomNpcCreator onNpcCreated={async (npc) => { await handleNpcCreated(npc); setShowModal(false); }} />
            </Modal>
          )}

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your Custom Philosophers</h2>
              <div className="text-sm text-gray-600">{npcs.length} philosophers</div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-transparent"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {npcs.map(npc => (
                  <div key={npc.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="p-3 flex gap-3">
                      <div className="relative">
                        <div className="w-[170px] h-[170px] rounded-lg overflow-hidden ring-1 ring-gray-200">
                          {npc.portrait_url || portraitMap[npc.id] ? (
                            <img
                              src={getRelativePortraitUrl(portraitMap[npc.id] || npc.portrait_url || '')}
                              alt={npc.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = '/Profile.png'; }}
                            />
                          ) : (
                            <img src="/Profile.png" alt={`${npc.name} placeholder`} className="w-full h-full object-cover" />
                          )}
                          {loadingPortrait === npc.id && (
                            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-transparent"></div>
                            </div>
                          )}
                        </div>
                        {portraitError[npc.id] && (
                          <div className="mt-2 text-sm text-red-600">{portraitError[npc.id]}</div>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col">
                        <h3 className="font-semibold text-gray-900">{npc.name}</h3>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-3">{npc.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {npc.concepts.map((concept, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs">{concept}</span>
                          ))}
                        </div>
                        <div className="mt-auto flex gap-2 pt-3">
                          <button className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50" aria-label="Edit philosopher">
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50" aria-label="Delete philosopher">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && npcs.length === 0 && (
              <div className="text-center py-10">
                <p className="text-gray-600 mb-4">You haven't created any custom philosophers yet.</p>
                <button onClick={() => setShowModal(true)} className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">
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