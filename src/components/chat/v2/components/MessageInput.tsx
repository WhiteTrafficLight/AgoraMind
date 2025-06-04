import React from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';

interface MessageInputProps {
  messageText: string;
  setMessageText: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isUserTurn: boolean;
  isInputDisabled: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  isGeneratingResponse: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({
  messageText,
  setMessageText,
  onSubmit,
  isUserTurn,
  isInputDisabled,
  inputRef,
  isGeneratingResponse
}) => {
  
  // Enter 키 처리
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isInputDisabled) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className={`debate-input-container ${isUserTurn ? 'user-turn' : ''}`}>
      <form onSubmit={onSubmit} className="debate-input-form">
        <textarea
          ref={inputRef}
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={
            isUserTurn 
              ? "지금은 당신의 차례입니다. 메시지를 입력하세요." 
              : "다음 버튼을 눌러 대화를 계속하세요."
          }
          className={`debate-input-field ${
            isUserTurn ? 'user-turn' : 'disabled'
          }`}
          disabled={isInputDisabled}
        />
        
        <button
          type="submit"
          disabled={!messageText.trim() || isInputDisabled}
          className={`debate-send-button ${
            isUserTurn && messageText.trim() ? 'user-turn' : ''
          }`}
        >
          <PaperAirplaneIcon style={{ height: '20px', width: '20px' }} />
        </button>
      </form>
      
      {!isUserTurn && !isGeneratingResponse && (
        <div className="debate-turn-message">
          현재 다른 참가자의 발언 차례입니다. 당신의 차례가 되면 알려드립니다.
        </div>
      )}
    </div>
  );
};

export default MessageInput; 