import React, { useEffect, useRef } from 'react';
import { useTypingAnimation } from '@/hooks/useTypingAnimation';

interface CitationLike {
  url?: string;
  text?: string;
  title?: string;
}

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
  citations?: CitationLike[];
}

const parseMarkdownToJSX = (text: string, citations: CitationLike[] = []) => {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    const linkText = match[1];
    const linkUrl = match[2];
    
    // citations URL
    let fullUrl = linkUrl;
    if (citations && citations.length > 0) {
      const matchingCitation = citations.find(citation => {
        if (!citation.url) return false;
        
        try {
          const citationDomain = new URL(citation.url).hostname;
          const simplifiedDomain = citationDomain.replace('www.', '');
          const linkDomain = linkUrl.replace('www.', '').replace('https://', '').replace('http://', '');
          
          return simplifiedDomain === linkDomain || 
                 citation.url.includes(linkDomain) ||
                 citation.text === linkText ||
                 citation.title === linkText;
        } catch (e) {
          return citation.url.includes(linkUrl) || 
                 citation.text === linkText ||
                 citation.title === linkText;
        }
      });
      
      if (matchingCitation && matchingCitation.url) {
        fullUrl = matchingCitation.url;
      }
    }
    
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

  useEffect(() => {
    if (autoStart && enabled && text) {
      startTyping();
    }
  }, [autoStart, enabled, text, startTyping]);

  useEffect(() => {
    if (prevTypingRef.current && !isTyping && onTypingComplete) {
      onTypingComplete();
    }
    prevTypingRef.current = isTyping;
  }, [isTyping, onTypingComplete]);

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
      
      {/* CSS animation */}
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