'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import chatService, { ChatRoom, ChatRoomCreationParams } from '@/lib/ai/chatService';

export default function OpenChatPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showParticipants, setShowParticipants] = useState<number | null>(null);
  const [showCreateChatModal, setShowCreateChatModal] = useState(false);
  const [showJoinConfirmation, setShowJoinConfirmation] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChats, setActiveChats] = useState<ChatRoom[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  // Create chat form state
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newChatContext, setNewChatContext] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(5);
  const [selectedNPCs, setSelectedNPCs] = useState<string[]>([]);
  
  // Load chat rooms on component mount
  useEffect(() => {
    const loadChatRooms = async () => {
      try {
        setIsLoading(true);
        const rooms = await chatService.getChatRooms();
        setActiveChats(rooms);
      } catch (error) {
        console.error('Failed to load chat rooms:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadChatRooms();
  }, []);
  
  // 모달 상태에 따라 body 클래스를 관리하는 useEffect 추가
  useEffect(() => {
    if (showCreateChatModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showCreateChatModal]);
  
  // Sample available NPCs
  const availableNPCs = [
    'Socrates', 'Plato', 'Aristotle', 'Kant', 'Nietzsche', 
    'Sartre', 'Camus', 'Simone de Beauvoir', 'Marx', 'Rousseau',
    'Heidegger', 'Wittgenstein', 'Confucius', 'Lao Tzu', 'Buddha'
  ];
  
  // Filter chats based on search query
  const filteredChats = activeChats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    [...chat.participants.users, ...chat.participants.npcs].some(
      p => p.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Toggle NPC selection
  const toggleNPC = (npc: string) => {
    if (selectedNPCs.includes(npc)) {
      setSelectedNPCs(selectedNPCs.filter(n => n !== npc));
    } else {
      setSelectedNPCs([...selectedNPCs, npc]);
    }
  };

  // Handle chat creation
  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newChatTitle.trim() || selectedNPCs.length === 0) return;
    
    try {
      setIsCreating(true);
      
      const chatParams: ChatRoomCreationParams = {
        title: newChatTitle,
        context: newChatContext,
        maxParticipants,
        npcs: selectedNPCs
      };
      
      const newChat = await chatService.createChatRoom(chatParams);
      
      // Update local chat list
      setActiveChats(prev => [newChat, ...prev]);
      
      // Reset form and close modal
      setNewChatTitle('');
      setNewChatContext('');
      setMaxParticipants(5);
      setSelectedNPCs([]);
      setShowCreateChatModal(false);
      
      // Navigate to the newly created chat
      router.push(`/chat?id=${newChat.id}`);
    } catch (error) {
      console.error('Failed to create chat room:', error);
      alert('Failed to create chat room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle joining a chat
  const handleJoinChat = (chatId: number) => {
    // Navigate to the chat page
    router.push(`/chat?id=${chatId}`);
  };

  // Create New Chat 버튼 클릭 핸들러 수정
  const handleCreateChatClick = () => {
    // 팝업 창 대신 모달을 표시합니다
    setShowCreateChatModal(true);
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Open Philosophical Dialogues</h1>
          <button 
            onClick={handleCreateChatClick}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Create New Chat
          </button>
        </div>
        
        <div className="bg-white border border-black p-4 rounded-md mb-6">
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or participant..."
              className="w-full p-2 border border-black rounded-md"
            />
          </div>
          
          <div className="flex gap-2 mb-4 flex-wrap">
            <button className="bg-black text-white px-3 py-1 rounded-md">All</button>
            <button className="border border-black px-3 py-1 rounded-md hover:bg-gray-100">Active</button>
            <button className="border border-black px-3 py-1 rounded-md hover:bg-gray-100">Recent</button>
            <button className="border border-black px-3 py-1 rounded-md hover:bg-gray-100">Popular</button>
          </div>
        </div>
        
        <div className="space-y-4">
          {isLoading ? (
            <div className="py-20">
              <div className="flex justify-center">
                <div className="animate-spin h-10 w-10 border-4 border-black border-t-transparent rounded-full"></div>
              </div>
              <p className="text-center mt-4 text-gray-500">Loading chats...</p>
            </div>
          ) : filteredChats.length > 0 ? (
            filteredChats.map(chat => (
              <div key={chat.id} className="bg-white border border-black p-4 rounded-md hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center">
                  <div 
                    className="block flex-grow cursor-pointer"
                    onClick={() => setShowJoinConfirmation(typeof chat.id === 'string' ? parseInt(chat.id) : chat.id)}
                  >
                    <h3 className="text-xl font-semibold mb-2">{chat.title}</h3>
                  </div>
                  <div className="flex items-center ml-4">
                    <button 
                      onClick={() => setShowParticipants(showParticipants === (typeof chat.id === 'string' ? parseInt(chat.id) : chat.id) ? null : (typeof chat.id === 'string' ? parseInt(chat.id) : chat.id))}
                      className="flex items-center gap-1 text-gray-600 hover:text-black"
                    >
                      <UserIcon className="h-5 w-5" />
                      <span>{chat.totalParticipants}</span>
                    </button>
                  </div>
                </div>
                
                <div className="text-sm text-gray-500 mt-2">Last activity: {chat.lastActivity}</div>
                
                {/* Participants dropdown */}
                {showParticipants === (typeof chat.id === 'string' ? parseInt(chat.id) : chat.id) && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">Participants</h4>
                      <button onClick={() => setShowParticipants(null)}>
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <h5 className="text-xs font-medium mb-1">Users</h5>
                        <ul className="text-sm">
                          {chat.participants.users.map(user => (
                            <li key={user}>{user}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium mb-1">NPCs</h5>
                        <ul className="text-sm">
                          {chat.participants.npcs.map(npc => (
                            <li key={npc}>{npc}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Join Chat Confirmation */}
                {showJoinConfirmation === (typeof chat.id === 'string' ? parseInt(chat.id) : chat.id) && (
                  <div className="mt-3 p-4 bg-gray-50 rounded-md border border-gray-200">
                    <div className="text-center">
                      <h4 className="font-medium mb-2">Would you like to join this chat?</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        You will join the philosophical discussion on "{chat.title}" with {chat.participants.npcs.join(', ')} and {chat.participants.users.length} other user(s).
                      </p>
                      <div className="flex justify-center gap-3">
                        <button 
                          onClick={() => setShowJoinConfirmation(null)}
                          className="px-4 py-2 border border-black rounded-md hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleJoinChat(typeof chat.id === 'string' ? parseInt(chat.id) : chat.id)}
                          className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800"
                        >
                          Yes, Join Chat
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 bg-white border border-black p-4 rounded-md">
              <p>No chats found matching your search.</p>
            </div>
          )}
        </div>
        
        {/* Create Chat Modal */}
        {showCreateChatModal && (
          <>
            {/* 배경 오버레이 */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-md z-[9000]"
              onClick={() => setShowCreateChatModal(false)}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
            ></div>
            
            {/* 모달 컨테이너 */}
            <div 
              className="fixed w-[95%] sm:w-[90%] md:w-[85%] max-w-[900px] max-h-[90vh] bg-white rounded-3xl z-[9001] overflow-hidden"
              style={{ 
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
                animation: 'modalAppear 0.4s ease-out',
                backgroundColor: 'white',
                isolation: 'isolate'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 모달 헤더 */}
              <div className="px-8 py-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-3xl">
                <h2 className="text-2xl font-bold">Create New Chat</h2>
                <button 
                  onClick={() => setShowCreateChatModal(false)}
                  className="text-gray-500 hover:text-black transition-colors p-2 rounded-full hover:bg-gray-200"
                >
                  <XMarkIcon className="h-8 w-8" />
                </button>
              </div>
              
              {/* 모달 내용 */}
              <div className="p-8 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 90px)' }}>
                <form onSubmit={handleCreateChat}>
                  <div className="mb-6">
                    <label className="block mb-3 font-medium text-lg">Chat Title</label>
                    <input
                      type="text"
                      value={newChatTitle}
                      onChange={(e) => setNewChatTitle(e.target.value)}
                      placeholder="Enter a philosophical topic..."
                      className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div className="mb-6">
                    <label className="block mb-3 font-medium text-lg">Context</label>
                    <textarea
                      value={newChatContext}
                      onChange={(e) => setNewChatContext(e.target.value)}
                      placeholder="Provide some context for the discussion..."
                      className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent h-36"
                    />
                  </div>
                  
                  <div className="mb-6">
                    <label className="block mb-3 font-medium text-lg">Maximum Participants</label>
                    <input
                      type="number"
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                      min="2"
                      max="10"
                      className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>
                  
                  <div className="mb-8">
                    <label className="block mb-3 font-medium text-lg">Select NPCs</label>
                    
                    {/* Selected NPCs display */}
                    {selectedNPCs.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {selectedNPCs.map((npc) => (
                          <div 
                            key={`selected-${npc}`}
                            className="flex items-center bg-black text-white px-3 py-2 rounded-lg"
                          >
                            <span>{npc}</span>
                            <button 
                              type="button"
                              onClick={() => toggleNPC(npc)}
                              className="ml-2 text-white hover:text-gray-200"
                            >
                              <XMarkIcon className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* NPC selection grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-3 border border-gray-300 rounded-xl p-4 bg-gray-50">
                      {availableNPCs.map((npc) => (
                        <div 
                          key={npc}
                          onClick={() => toggleNPC(npc)}
                          className={`border p-4 rounded-xl cursor-pointer text-center transition-all text-lg ${
                            selectedNPCs.includes(npc) 
                              ? 'bg-black text-white border-black font-medium' 
                              : 'bg-white hover:bg-gray-100 border-gray-300'
                          }`}
                        >
                          {npc}
                          {selectedNPCs.includes(npc) && (
                            <span className="ml-2 inline-block">✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* 모달 푸터 */}
                  <div className="mt-8 flex justify-end gap-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateChatModal(false)}
                      className="px-6 py-4 text-lg border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-8 py-4 text-lg bg-black text-white rounded-xl hover:bg-gray-800 transition-colors flex items-center"
                      disabled={!newChatTitle.trim() || selectedNPCs.length === 0 || isCreating}
                    >
                      {isCreating ? (
                        <>
                          <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></span>
                          Creating...
                        </>
                      ) : (
                        'Create Chat'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* 애니메이션을 위한 스타일 추가 */}
      <style jsx global>{`
        @keyframes modalAppear {
          from {
            opacity: 0;
            transform: translate(-50%, -48%) scale(0.92);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        /* 모달이 열렸을 때 본문 스크롤 방지 */
        body.modal-open {
          overflow: hidden;
          position: fixed;
          width: 100%;
          height: 100%;
        }
        
        /* 모달 스타일 보조 */
        .fixed {
          position: fixed !important;
        }
        
        .rounded-3xl {
          border-radius: 1.5rem !important;
        }
        
        .z-9000 {
          z-index: 9000 !important;
        }
        
        .z-9001 {
          z-index: 9001 !important;
        }
        
        /* 모달 백드롭과 컨테이너의 위치와 차례 - Make sure the modal is completely above everything */
        [class*="fixed"] {
          isolation: isolate;
        }
        
        /* Ensure stacking context is properly handled */
        body.modal-open::after {
          content: '';
          position: fixed;
          inset: 0;
          z-index: 8999;
        }
      `}</style>
    </>
  );
}


