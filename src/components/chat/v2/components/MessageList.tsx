import React from 'react';
import { ArrowDownCircleIcon } from '@heroicons/react/24/outline';
import TypingMessage from '../../TypingMessage';

interface MessageListProps {
  messages: any[];
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
  const renderMessage = (message: any, index: number) => {
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
                      speed={30}
                      delay={200}
                      enabled={true}
                      showCursor={true}
                      autoStart={true}
                      onTypingComplete={() => handleTypingComplete(message.id)}
                    />
                  ) : (
                    message.text
                  )}
                </div>
              )}
              
              {message.citations && message.citations.length > 0 && (
                <div className="debate-message-citations">
                  <strong>출처:</strong>
                  <ul>
                    {message.citations.map((citation: any, idx: number) => (
                      <li key={idx}>
                        [{citation.id}] {citation.source}
                        {citation.location && ` (${citation.location})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="debate-message-timestamp">
              {new Date(message.timestamp).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
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
          토론이 곧 시작됩니다...
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
                생성중...
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