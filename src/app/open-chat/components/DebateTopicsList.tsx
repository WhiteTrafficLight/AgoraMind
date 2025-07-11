import React, { useState } from 'react';
import { ArrowPathIcon, LinkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { getDebateCategories, categoryDisplayConfig, DebateTopic } from '../utils/debateTopics';
import DebateTopicModal from './DebateTopicModal';
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
  
  const debateCategories = getDebateCategories();

  const handleTopicClick = (categoryKey: string, topicIndex: number, topic: DebateTopic) => {
    setSelectedTopic({ topic, categoryKey, topicIndex });
    setShowModal(true);
  };

  const handleStartDebate = (categoryKey: string, topicIndex: number, topic: DebateTopic, userPosition: 'pro' | 'con' | 'neutral') => {
    // Close modal first
    setShowModal(false);
    setSelectedTopic(null);
    
    // Call the original onSelectTopic with additional userPosition info
    onSelectTopic(categoryKey, topicIndex, topic);
    
    // TODO: Pass userPosition to the debate creation logic
    loggers.ui.debug('Starting debate with position:', userPosition);
  };

  const renderContextIcon = (contextType: string) => {
    switch (contextType) {
      case 'url':
        return <LinkIcon style={{ width: '16px', height: '16px', color: '#3b82f6' }} />;
      case 'pdf':
        return <DocumentTextIcon style={{ width: '16px', height: '16px', color: '#ef4444' }} />;
      case 'text':
        return <DocumentTextIcon style={{ width: '16px', height: '16px', color: '#6b7280' }} />;
      default:
        return null;
    }
  };

  const renderTopicCard = (topic: DebateTopic, categoryKey: string, topicIndex: number) => {
    const topicId = `${categoryKey}-${topicIndex}`;

    return (
      <div 
        key={topicId} 
        className="chat-room-card"
        style={{ 
          cursor: 'pointer',
          transition: 'box-shadow 0.2s ease'
        }}
        onClick={() => handleTopicClick(categoryKey, topicIndex, topic)}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '';
        }}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <h4 className="chat-room-card-title" style={{ flex: '1' }}>{topic.title}</h4>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem' 
          }}>
            {topic.context.type && renderContextIcon(topic.context.type)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={{ 
        height: 'calc(100vh - 80px)', // Adjust for header height
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden' 
      }}>
        {/* 4개 섹션 그리드 - 정확히 4등분 */}
        <div style={{ 
          flex: '1', 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gridTemplateRows: '1fr 1fr', 
          gap: '1rem', 
          padding: '1rem', 
          overflow: 'hidden',
          minHeight: '0' // Important for grid overflow
        }}>
          {debateCategories.map(({ key: categoryKey, category }) => {
            const displayConfig = categoryDisplayConfig[categoryKey as keyof typeof categoryDisplayConfig];
            
            return (
              <div 
                key={categoryKey}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '0.5rem', 
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)', 
                  overflow: 'hidden', 
                  height: '100%',
                  minHeight: '0' // Important for flex item overflow
                }}
              >
                {/* 섹션 타이틀 */}
                <div 
                  className={displayConfig?.color || ''}
                  style={{ 
                    flexShrink: '0', 
                    padding: '1rem', // Increased padding for more height
                    borderBottom: '1px solid #e5e7eb', 
                    borderTopLeftRadius: '0.5rem', 
                    borderTopRightRadius: '0.5rem',
                    backgroundColor: !displayConfig?.color ? '#f9fafb' : undefined
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem', // Increased gap for larger image
                    height: '100%' // Ensure full height usage
                  }}>
                    {displayConfig?.image && (
                      <img 
                        src={displayConfig.image}
                        alt={displayConfig.title || category.name}
                        style={{
                          width: '72px', // 3x larger (24px -> 72px)
                          height: '72px',
                          objectFit: 'contain',
                          flexShrink: '0' // Prevent image from shrinking
                        }}
                      />
                    )}
                    <div style={{ 
                      flex: '1',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center' // Vertically center the text content
                    }}>
                      <h3 style={{ 
                        fontWeight: 'bold', 
                        fontSize: '0.875rem', 
                        color: '#1f2937',
                        marginBottom: '0.25rem', // Slightly increased margin for better spacing
                        margin: '0 0 0.25rem 0' // Reset margin and set only bottom
                      }}>
                        {displayConfig?.title || category.name}
                      </h3>
                      {displayConfig?.description && (
                        <p style={{ 
                          fontSize: '0.75rem', 
                          color: '#6b7280',
                          margin: '0', // Remove default margin
                          lineHeight: '1.2' // Tighter line height for better appearance
                        }}>{displayConfig.description}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* 스크롤 가능한 주제 목록 */}
                <div style={{ 
                  flex: '1', 
                  overflowY: 'auto', 
                  padding: '0.5rem',
                  minHeight: '0' // Important for scroll container
                }}>
                  {category.topics.length > 0 ? (
                    category.topics.map((topic, index) => renderTopicCard(topic, categoryKey, index))
                  ) : (
                    <div style={{ 
                      textAlign: 'center', 
                      paddingTop: '2rem', 
                      paddingBottom: '2rem' 
                    }}>
                      <p style={{ 
                        fontSize: '0.75rem', 
                        color: '#9ca3af' 
                      }}>
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

      {/* Debate Topic Modal */}
      <DebateTopicModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedTopic(null);
        }}
        topic={selectedTopic?.topic || null}
        categoryKey={selectedTopic?.categoryKey || ''}
        topicIndex={selectedTopic?.topicIndex || 0}
        onStartDebate={handleStartDebate}
        philosophers={philosophers}
        customNpcs={customNpcs}
      />
    </>
  );
};

export default DebateTopicsList; 