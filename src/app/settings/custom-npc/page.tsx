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
    <div className="custom-npc-container">
      <main className="custom-npc-main">
        <div className="custom-npc-content">
          <h1 className="custom-npc-title">Custom Philosophers</h1>
          
          <p className="custom-npc-description first">
            Create your own AI philosopher with unique perspectives and approaches. 
            You can customize their personality, philosophical stance, and debate style.
          </p>
          <p className="custom-npc-description">
            Your custom philosophers will be available in all your conversations and can 
            interact with the built-in historical philosophers. Whether you want to create 
            a modern thinker, blend different philosophical traditions, or explore entirely 
            new perspectives, the choice is yours.
          </p>
          <p className="custom-npc-description note">
            <strong>Note:</strong> Custom NPCs are currently in beta. You can create and 
            edit them, but some advanced features like detailed philosophical analysis 
            and cross-referencing with historical texts are still being developed.
          </p>
          <p className="custom-npc-description tip">
            <strong>Tip:</strong> For best results, provide detailed descriptions of your 
            philosopher&apos;s views, their approach to ethical questions, and how they might 
            respond to contemporary issues.
          </p>
          
          {/* Create New Philosopher Button */}
          <div className="custom-npc-create-section">
            <button 
              onClick={() => setShowModal(true)} 
              className="custom-npc-create-button"
            >
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
            <div className="custom-npc-list-header">
              <h2 className="custom-npc-list-title">Your Custom Philosophers</h2>
              <div className="custom-npc-count">{npcs.length} philosophers</div>
            </div>
            
            {isLoading ? (
              <div className="custom-npc-loading">
                <div className="custom-npc-spinner"></div>
              </div>
            ) : (
              <div className="custom-npc-grid">
                {npcs.map(npc => (
                  <div key={npc.id} className="custom-npc-card">
                    <div className="custom-npc-card-content">
                      {/* Portrait or spinner */}
                      <div className="custom-npc-portrait-section">
                        <div className="custom-npc-portrait-container">
                          {npc.portrait_url || portraitMap[npc.id] ? (
                            <div className="custom-npc-portrait-wrapper">
                              <img
                                src={getRelativePortraitUrl(portraitMap[npc.id] || npc.portrait_url || '')}
                                alt={npc.name}
                                width={170} 
                                height={170}
                                className="custom-npc-portrait-image"
                                onError={(e) => {
                                  console.error(`Image load error for ${npc.id}:`, e);
                                  (e.target as HTMLImageElement).src = '/Profile.png';
                                }}
                              />
                            </div>
                          ) : (
                            <img
                              src="/Profile.png"
                              alt={`${npc.name} placeholder`}
                              width={170}
                              height={170}
                              className="custom-npc-portrait-placeholder"
                            />
                          )}
                          {loadingPortrait === npc.id && (
                            <div className="custom-npc-portrait-loading">
                              <div className="custom-npc-portrait-loading-spinner"></div>
                            </div>
                          )}
                        </div>
                        {portraitError[npc.id] && (
                          <div className="custom-npc-portrait-error">
                            {portraitError[npc.id]}
                          </div>
                        )}
                      </div>
                      
                      <div className="custom-npc-info-section">
                        <h3 className="custom-npc-name">{npc.name}</h3>
                        <p className="custom-npc-description-text">{npc.description}</p>
                        <div className="custom-npc-concepts">
                          {npc.concepts.map((concept, idx) => (
                            <span key={idx} className="custom-npc-concept-tag">
                              {concept}
                            </span>
                          ))}
                        </div>
                        <div className="custom-npc-actions">
                          <button 
                            className="custom-npc-action-button"
                            aria-label="Edit philosopher"
                          >
                            <PencilIcon className="custom-npc-edit-icon" />
                          </button>
                          <button 
                            className="custom-npc-action-button"
                            aria-label="Delete philosopher"
                          >
                            <TrashIcon className="custom-npc-delete-icon" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {!isLoading && npcs.length === 0 && (
              <div className="custom-npc-empty-state">
                <p className="custom-npc-empty-text">
                  You haven't created any custom philosophers yet.
                </p>
                <button 
                  onClick={() => setShowModal(true)}
                  className="custom-npc-empty-button"
                >
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