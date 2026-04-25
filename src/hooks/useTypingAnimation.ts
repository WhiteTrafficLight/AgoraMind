import { useState, useEffect, useRef } from 'react';

interface UseTypingAnimationOptions {
  text: string;
  speed?: number;
  delay?: number;
  enabled?: boolean;
}

interface UseTypingAnimationReturn {
  displayedText: string;
  isTyping: boolean;
  startTyping: () => void;
  resetTyping: () => void;
}

export const useTypingAnimation = ({
  text,
  speed = 20,
  delay = 0,
  enabled = true
}: UseTypingAnimationOptions): UseTypingAnimationReturn => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startTyping = () => {
    if (!enabled || hasStarted) return;
    
    setHasStarted(true);
    setIsTyping(true);
    setDisplayedText('');

    if (delay > 0) {
      timeoutRef.current = setTimeout(() => {
        beginTyping();
      }, delay);
    } else {
      beginTyping();
    }
  };

  const beginTyping = () => {
    let index = 0;
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    intervalRef.current = setInterval(() => {
      if (index < text.length) {
        // 현재 위치에서 링크 시작 확인
        const remainingText = text.slice(index);
        const linkMatch = remainingText.match(linkRegex);
        
        if (linkMatch && remainingText.indexOf(linkMatch[0]) === 0) {
          // 링크 전체를 한번에 추가
          index += linkMatch[0].length;
        } else {
          // 일반 텍스트는 한 글자씩
          index++;
        }
        
        setDisplayedText(text.slice(0, index));
      } else {
        setIsTyping(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, speed);
  };

  const resetTyping = () => {
    setDisplayedText('');
    setIsTyping(false);
    setHasStarted(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // 컴포넌트 언마운트 시 클리어
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // 텍스트가 변경되면 리셋. !enabled 케이스는 아래 return 문에서
  // displayedText 대신 text를 직접 반환해 처리하므로 setState 불필요.
  /* eslint-disable react-hooks/set-state-in-effect -- legacy reset-on-prop-change pattern; behavior-preserving refactor needs full hook overhaul. */
  useEffect(() => {
    if (enabled) {
      resetTyping();
    }
  }, [text, enabled]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return {
    displayedText: enabled ? displayedText : text,
    isTyping,
    startTyping,
    resetTyping
  };
}; 