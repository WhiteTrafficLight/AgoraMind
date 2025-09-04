import React, { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useOpenChatState } from '../hooks/useOpenChatState';
import DebateTopicsList from './DebateTopicsList';
import CreateChatModal from './CreateChatModal';
import PhilosopherDetailsModal from './PhilosopherDetailsModal';
import { Philosopher, ChatRoom } from '../types/openChat.types';
import { DebateTopic } from '../utils/debateTopics';

const OpenChatContainer: React.FC = () => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const {
    // State
    activeChats,
    isLoading,
    showCreateChatModal,
    username,
    philosophers,
    customNpcs,
    isCreating,
    
    // Actions
    updateState,
    loadChatRooms,
    handleCreateChat,
    handleJoinChat,
  } = useOpenChatState();

  const handleCreateChatClick = () => {
    updateState({ showCreateChatModal: true });
  };

  const handleTopicSelect = (categoryKey: string, topicIndex: number, topic: DebateTopic) => {
    // TODO: Navigate to debate room creation or directly start a debate
    // For now, we'll just log the selection
    console.log('Selected topic:', { categoryKey, topicIndex, topic });
    
    // You could implement navigation here, for example:
    // router.push(`/debate/${categoryKey}/${topicIndex}`);
    // or open a modal to configure the debate
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Philosophical Debate Topics</h1>
          <div className="flex items-center gap-4">
            {/* Create Chat Button */}
            <div className="relative z-10">
              <button 
                onClick={handleCreateChatClick}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                disabled={isCreating}
                aria-label="Create New Chat"
                className="inline-flex items-center justify-center rounded-full p-3 bg-black text-white shadow hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
              >
                <PlusIcon className="h-6 w-6" />
              </button>
              
              {/* Tooltip */}
              <div 
                className={`absolute right-0 mt-2 w-40 rounded-md bg-gray-900 text-white text-xs px-3 py-2 shadow-lg ${showTooltip ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity z-10`}
              >
                Create Custom Debate
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Debate Topics List */}
      <div className="flex-1 overflow-hidden">
        <DebateTopicsList
          onSelectTopic={handleTopicSelect}
          philosophers={philosophers}
          customNpcs={customNpcs}
        />
      </div>
      
      {/* Create Chat Modal */}
      <CreateChatModal
        isOpen={showCreateChatModal}
        onClose={() => updateState({ showCreateChatModal: false })}
        onCreateChat={handleCreateChat}
        isCreating={isCreating}
        philosophers={philosophers}
        customNpcs={customNpcs}
      />
    </div>
  );
};

export default OpenChatContainer; 