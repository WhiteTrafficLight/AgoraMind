import React, { useEffect, useRef } from 'react';
import { useTypingAnimation } from '@/hooks/useTypingAnimation';

interface TypingMessageProps {
  text: string;
  speed?: number;
  delay?: number;
  enabled?: boolean;
  showCursor?: boolean;
  autoStart?: boolean;
  onTypingComplete?: () => void;
  className?: string;
  style?: React.CSSProperties;
  citations?: any[];
}

// 마크다운 링크를 JSX로 변환하는 함수
const parseMarkdownToJSX = (text: string, citations: any[] = []) => {
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

const TypingMessage: React.FC<TypingMessageProps> = ({
  text,
  speed = 20,
  delay = 0,
  enabled = true,
  showCursor = true,
  autoStart = true,
  onTypingComplete,
  className = '',
  style = {},
  citations = []
}) => {
  const { displayedText, isTyping, startTyping } = useTypingAnimation({
    text,
    speed,
    delay,
    enabled
  });
  
  const prevTypingRef = useRef(isTyping);

  // 자동 시작
  useEffect(() => {
    if (autoStart && enabled && text) {
      startTyping();
    }
  }, [autoStart, enabled, text, startTyping]);

  // 타이핑 완료 콜백
  useEffect(() => {
    if (prevTypingRef.current && !isTyping && onTypingComplete) {
      onTypingComplete();
    }
    prevTypingRef.current = isTyping;
  }, [isTyping, onTypingComplete]);

  // 표시할 텍스트를 파싱
  const finalText = enabled ? displayedText : text;
  const parsedContent = parseMarkdownToJSX(finalText, citations);

  return (
    <span className={className} style={style}>
      {parsedContent}
      {showCursor && isTyping && (
        <span 
          style={{
            display: 'inline-block',
            width: '2px',
            height: '1.2em',
            backgroundColor: 'currentColor',
            marginLeft: '2px',
            animation: 'blink 1s infinite'
          }}
        />
      )}
      
      {/* CSS 애니메이션 정의 */}
      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </span>
  );
};

export default TypingMessage; 