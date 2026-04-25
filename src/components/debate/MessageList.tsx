import React from 'react';
import { ArrowDownCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import TypingMessage from '@/components/chat/TypingMessage';
import { loggers } from '@/utils/logger';
import type { ChatMessage, Citation, RagSource } from '@/types/debate';

interface CitationLike {
  url?: string;
  text?: string;
  title?: string;
}

interface MessageListProps {
  messages: ChatMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  isUserTurn: boolean;
  typingMessageIds: Set<string>;
  getNameFromId: (id: string, isUser: boolean) => string;
  getProfileImage: (id: string, isUser: boolean) => string;
  isUserParticipant: (id: string) => boolean;
  handleTypingComplete: (messageId: string) => void;
  showNextButton: boolean;
  onRequestNext: () => void;
  isGeneratingNext: boolean;
}

// 마크다운 링크를 JSX로 변환하는 함수
const parseMarkdownToJSX = (text: string, citations: CitationLike[] = []) => {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = linkRegex.exec(text)) !== null) {
    // 링크 앞의 텍스트
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    const linkText = match[1];
    const linkUrl = match[2];
    
    // citations 배열에서 매칭되는 완전한 URL 찾기
    let fullUrl = linkUrl;
    if (citations && citations.length > 0) {
      // 도메인이나 제목으로 매칭 시도
      const matchingCitation = citations.find(citation => {
        if (!citation.url) return false;
        
        // URL에서 도메인 추출하여 비교
        try {
          const citationDomain = new URL(citation.url).hostname;
          const simplifiedDomain = citationDomain.replace('www.', '');
          const linkDomain = linkUrl.replace('www.', '').replace('https://', '').replace('http://', '');
          
          return simplifiedDomain === linkDomain || 
                 citation.url.includes(linkDomain) ||
                 citation.text === linkText ||
                 citation.title === linkText;
        } catch (e) {
          // URL 파싱 실패 시 문자열 비교
          return citation.url.includes(linkUrl) || 
                 citation.text === linkText ||
                 citation.title === linkText;
        }
      });
      
      if (matchingCitation) {
        fullUrl = matchingCitation.url;
      }
    }
    
    // 링크 요소
    parts.push(
      <a
        key={key++}
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="citation-link"
        style={{
          color: '#3b82f6',
          textDecoration: 'underline',
          cursor: 'pointer',
          fontWeight: '500'
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        title={fullUrl !== linkUrl ? `Link to: ${fullUrl}` : undefined}
      >
        {linkText}
      </a>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // 마지막 텍스트
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
};

const MessageList: React.FC<MessageListProps> = ({
  messages,
  messagesEndRef,
  isUserTurn,
  typingMessageIds,
  getNameFromId,
  getProfileImage,
  isUserParticipant,
  handleTypingComplete,
  showNextButton,
  onRequestNext,
  isGeneratingNext
}) => {
  const renderRagTooltip = (message: ChatMessage) => {
    // RAG information logging
    loggers.rag.debug('RAG Tooltip data', {
      rag_used: message.rag_used,
      rag_source_count: message.rag_source_count,
      rag_sources: message.rag_sources,
      citations: message.citations,
      hasRagSources: message.rag_sources && message.rag_sources.length > 0,
      hasCitations: message.citations && message.citations.length > 0
    });

    // citations가 있으면 citations 사용, 없으면 기존 rag_sources 사용 (하위 호환성)
    const hasCitations = message.citations && message.citations.length > 0;
    const hasRagSources = message.rag_sources && message.rag_sources.length > 0;
    
    if (!message.rag_used || (!hasCitations && !hasRagSources)) {
      return null;
    }

    const handleSourceClick = (source: RagSource | Citation) => {
      loggers.rag.info('Source clicked', source);
      
      if (hasCitations) {
        // citations 구조: { title, url }
        if (source.url && source.url.startsWith('http')) {
          try {
            window.open(source.url, '_blank', 'noopener,noreferrer');
          } catch (error) {
            loggers.rag.error('Failed to open URL', error);
          }
        }
      } else {
        // 기존 rag_sources 구조 처리 (하위 호환성)
        if (source.type === 'web' && source.metadata?.url) {
          try {
            window.open(source.metadata.url, '_blank', 'noopener,noreferrer');
          } catch (error) {
            loggers.rag.error('Failed to open web URL', error);
          }
        } else if (source.type === 'context' && source.metadata?.file_path) {
          loggers.rag.info('Context file accessed', { filePath: source.metadata.file_path });
        }
      }
    };

    const isClickable = (source: RagSource | Citation) => {
      if (hasCitations) {
        return source.url && source.url.startsWith('http');
      } else {
        return (source.type === 'web' && source.metadata?.url) || 
               (source.type === 'context' && source.metadata?.file_path);
      }
    };

    const sourceCount = hasCitations ? message.citations.length : message.rag_source_count;
    const sources = hasCitations ? message.citations : message.rag_sources;

    return (
      <div className="debate-rag-indicator">
        <div className="debate-rag-icon" title={`RAG 검색 결과 ${sourceCount}개 활용`}>
          <InformationCircleIcon style={{ height: '16px', width: '16px' }} />
          <span className="debate-rag-count">{sourceCount}</span>
        </div>
        <div className="debate-rag-tooltip">
          <div className="debate-rag-tooltip-header">
            Sources ({sourceCount})
          </div>
          <div className="debate-rag-tooltip-content">
            {sources.slice(0, 3).map((source: RagSource | Citation, idx: number) => (
              <div 
                key={idx} 
                className={`debate-rag-source-item ${isClickable(source) ? 'clickable' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSourceClick(source);
                }}
                onMouseDown={(e) => {
                  // 마우스 다운 시에도 이벤트 전파 방지
                  e.preventDefault();
                  e.stopPropagation();
                }}
                title={isClickable(source) ? 'Click to open source' : ''}
                style={{ 
                  userSelect: 'none',
                  ...(isClickable(source) && { cursor: 'pointer' })
                }}
              >
                {hasCitations ? (
                  // Citations 구조 렌더링
                  <>
                    <div className="debate-rag-source-type">
                      🌐 Web Citation
                    </div>
                    <div className="debate-rag-source-content">
                      <div className="debate-citation-title">
                        {source.title || 'Untitled'}
                      </div>
                      {source.url && (
                        <div className="debate-citation-url">
                          {source.url.length > 60 ? `${source.url.substring(0, 60)}...` : source.url}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  // 기존 rag_sources 구조 렌더링 (하위 호환성)
                  <>
                    <div className="debate-rag-source-type">
                      {source.type === 'web' ? '🌐 Web' : 
                       source.type === 'context' ? '📄 Context' :
                       source.type === 'dialogue' ? '💬 Dialogue' :
                       source.type === 'philosopher' ? '🧠 Philosopher' : '📚 Source'}
                    </div>
                    <div className="debate-rag-source-content">
                      {source.content ? source.content.substring(0, 100) : 'No content available'}...
                    </div>
                    {source.relevance_score && (
                      <div className="debate-rag-source-score">
                        Relevance: {(source.relevance_score * 100).toFixed(1)}%
                      </div>
                    )}
                    {!source.relevance_score && source.relevance && (
                      <div className="debate-rag-source-score">
                        Relevance: {(source.relevance * 100).toFixed(1)}%
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            {sources.length > 3 && (
              <div className="debate-rag-more">
                +{sources.length - 3} more
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMessage = (message: ChatMessage, index: number) => {
    const isUser = isUserParticipant(message.sender);
    const senderName = getNameFromId(message.sender, isUser);
    const avatar = getProfileImage(message.sender, isUser);
    const isCurrentUserTurn = isUserTurn && isUser;
    const isTempWaitingMessage = message.id.startsWith('temp-waiting-');
    const isGeneratingMessage = message.isGenerating === true;
    
    return (
      <div 
        key={message.id} 
        className={`debate-message ${isCurrentUserTurn ? 'user-turn' : ''}`}
        style={{ animationDelay: `${index * 0.1}s` }}
      >
        <div className="debate-message-content">
          <div className="debate-message-avatar">
            <img src={avatar} alt={senderName} />
          </div>
          
          <div className="debate-message-body">
            <div className={`debate-message-sender ${message.role === 'moderator' ? 'moderator' : ''}`}>
              {senderName}
              {message.role === 'moderator' && (
                <span className="debate-moderator-badge">MODERATOR</span>
              )}
              {renderRagTooltip(message)}
            </div>
            
            <div className={`debate-message-text ${
              message.role === 'moderator' ? 'moderator' :
              isUser ? 'user' : 'system'
            } ${isTempWaitingMessage ? 'temp-waiting' : ''} ${isGeneratingMessage ? 'generating' : ''}`}>
              {isTempWaitingMessage ? (
                <div className="debate-message-waiting-dots">
                  <div className="debate-waiting-dots">
                    <div className="debate-waiting-dot" />
                    <div className="debate-waiting-dot" />
                    <div className="debate-waiting-dot" />
                  </div>
                  {message.text}
                </div>
              ) : isGeneratingMessage ? (
                <div className="debate-message-generating">
                  <div className="debate-generating-dots">
                    <div className="debate-generating-dot" />
                    <div className="debate-generating-dot" />
                    <div className="debate-generating-dot" />
                    <div className="debate-generating-dot" />
                    <div className="debate-generating-dot" />
                  </div>
                  <span className="debate-generating-text">thinking</span>
                </div>
              ) : (
                <div>
                  {typingMessageIds.has(message.id) ? (
                    <TypingMessage
                      text={message.text}
                      speed={10}
                      delay={200}
                      enabled={true}
                      showCursor={true}
                      autoStart={true}
                      onTypingComplete={() => handleTypingComplete(message.id)}
                      citations={message.citations}
                    />
                  ) : (
                    parseMarkdownToJSX(message.text, message.citations)
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="debate-messages-container">
      {messages && messages.length > 0 ? (
        messages.map((message, index) => renderMessage(message, index))
      ) : (
        <div className="debate-no-messages">
          Please click the &ldquo;Next&rdquo; button to begin the debate.
        </div>
      )}
      
      {showNextButton && (
        <div className="debate-next-button-container">
          <button
            type="button"
            onClick={onRequestNext}
            disabled={isGeneratingNext}
            className="debate-next-button"
          >
            {isGeneratingNext ? (
              <>
                <div className="loading-spinner" />
                Generating...
              </>
            ) : (
              <>
                <ArrowDownCircleIcon style={{ height: '18px', width: '18px' }} />
                Next
              </>
            )}
          </button>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList; 