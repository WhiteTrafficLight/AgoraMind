import React, { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useOpenChatState } from '../hooks/useOpenChatState';
import SocketStatusIndicator from './SocketStatusIndicator';
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
    socketConnected,
    username,
    philosophers,
    customNpcs,
    isCreating,
    
    // Actions
    updateState,
    loadChatRooms,
    initializeSocket,
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
      {/* Socket Status */}
      <SocketStatusIndicator 
        connected={socketConnected} 
        onReconnect={initializeSocket}
      />
      
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Philosophical Debate Topics</h1>
          <div className="flex items-center gap-4">
            {/* Create Chat Button */}
            <div className="relative">
              <button 
                onClick={handleCreateChatClick}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                disabled={isCreating}
                className="btn-create-chat"
                aria-label="Create New Chat"
              >
                <PlusIcon className="icon" />
              </button>
              
              {/* Tooltip */}
              <div 
                className={`btn-create-chat-tooltip ${showTooltip ? '' : 'hidden'}`}
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