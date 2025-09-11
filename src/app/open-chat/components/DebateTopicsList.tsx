import React, { useState } from 'react';
import { ArrowPathIcon, LinkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { getDebateCategories, categoryDisplayConfig, DebateTopic } from '../utils/debateTopics';
import DebateTopicModal from './DebateTopicModal';
import FreeDiscussionTopicModal from './FreeDiscussionTopicModal';
import { loggers } from '@/utils/logger';

interface Philosopher {
  id: string;
  name: string;
  period?: string; 
  nationality?: string;
  description?: string;
  key_concepts?: string[];
  portrait_url?: string;
}

interface DebateTopicsListProps {
  onSelectTopic: (categoryKey: string, topicIndex: number, topic: DebateTopic) => void;
  philosophers?: Philosopher[];
  customNpcs?: Philosopher[];
}

const DebateTopicsList: React.FC<DebateTopicsListProps> = ({
  onSelectTopic,
  philosophers = [],
  customNpcs = []
}) => {
  const [selectedTopic, setSelectedTopic] = useState<{
    topic: DebateTopic;
    categoryKey: string;
    topicIndex: number;
  } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFreeModal, setShowFreeModal] = useState(false);
  
  const debateCategories = getDebateCategories();

  // Determine actual context type to display (only if content exists)
  type TopicContext = { type?: string; content?: string } | undefined;
  const getEffectiveContextType = (context: TopicContext): 'url' | 'text' | '' => {
    if (!context) return '';
    const raw = (context.content || '').trim();
    if (!raw) return '';
    if (context.type === 'url') return 'url';
    if (context.type === 'text') return 'text';
    return '';
  };

  const handleTopicClick = (categoryKey: string, topicIndex: number, topic: DebateTopic) => {
    setSelectedTopic({ topic, categoryKey, topicIndex });
    // Open Free Discussion modal instead of Debate modal
    setShowFreeModal(true);
  };

  const handleStartDebate = (categoryKey: string, topicIndex: number, topic: DebateTopic, userPosition: 'pro' | 'con' | 'neutral') => {
    setShowModal(false);
    setSelectedTopic(null);
    onSelectTopic(categoryKey, topicIndex, topic);
    loggers.ui.debug('Starting debate with position:', userPosition);
  };

  const renderContextIcon = (contextType: string) => {
    switch (contextType) {
      case 'url':
        return <LinkIcon className="h-4 w-4 text-blue-500" />;
      case 'pdf':
        return <DocumentTextIcon className="h-4 w-4 text-red-500" />;
      case 'text':
        return <DocumentTextIcon className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const renderTopicCard = (topic: DebateTopic, categoryKey: string, topicIndex: number) => {
    const topicId = `${categoryKey}-${topicIndex}`;
    const effectiveType = getEffectiveContextType((topic as any).context);

    return (
      <div 
        key={topicId}
        className="relative z-10 cursor-pointer border border-gray-200 rounded-md p-3 bg-white hover:shadow-md transition-shadow"
        onClick={() => handleTopicClick(categoryKey, topicIndex, topic)}
      >
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm text-gray-900 flex-1 truncate">{topic.title}</h4>
          <div className="flex items-center gap-2">
            {effectiveType && renderContextIcon(effectiveType)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="relative z-0 h-[calc(100vh-80px)] flex flex-col overflow-hidden">
        {/* 4개 섹션 그리드 - 정확히 4등분 */}
        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4 p-4 overflow-hidden min-h-0">
          {debateCategories.map(({ key: categoryKey, category }) => {
            const displayConfig = categoryDisplayConfig[categoryKey as keyof typeof categoryDisplayConfig];
            
            return (
              <div 
                key={categoryKey}
                className="flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden h-full min-h-0"
              >
                {/* 섹션 타이틀 */}
                <div 
                  className={`${displayConfig?.color || 'bg-gray-50'} flex-shrink-0 p-4 border-b border-gray-200 rounded-t-lg`}
                >
                  <div className="flex items-center gap-3 h-full">
                    {displayConfig?.image && (
                      <img 
                        src={displayConfig.image}
                        alt={displayConfig.title || category.name}
                        className="w-18 h-18 object-contain flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 flex flex-col justify-center">
                      <h3 className="font-bold text-sm text-gray-800 mb-1">
                        {displayConfig?.title || category.name}
                      </h3>
                      {displayConfig?.description && (
                        <p className="text-xs text-gray-500 leading-tight m-0">
                          {displayConfig.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* 스크롤 가능한 주제 목록 */}
                <div className="flex-1 overflow-y-auto p-2 min-h-0">
                  {category.topics.length > 0 ? (
                    category.topics.map((topic, index) => renderTopicCard(topic, categoryKey, index))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-xs text-gray-400">
                        No topics available for {displayConfig?.title || category.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Free Discussion Topic Modal */}
      <FreeDiscussionTopicModal
        isOpen={showFreeModal}
        onClose={() => {
          setShowFreeModal(false);
          setSelectedTopic(null);
        }}
        topic={selectedTopic?.topic || null}
        philosophers={philosophers}
        customNpcs={customNpcs}
      />
    </>
  );
};

export default DebateTopicsList; 