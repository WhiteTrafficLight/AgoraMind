import React, { useRef, useEffect } from 'react';
import { TimelineMarker, PhilosopherTurn } from '@/app/open-chat/types/freeDiscussion.types';

interface FreeDiscussionTimelineProps {
  turns: PhilosopherTurn[];
  currentTurn: number;
  onSeek: (turn: number) => void;
  view: 'compact' | 'expanded';
  philosopherColors: Record<string, string>;
}

export const FreeDiscussionTimeline: React.FC<FreeDiscussionTimelineProps> = ({
  turns,
  currentTurn,
  onSeek,
  view,
  philosopherColors,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [hoveredTurn, setHoveredTurn] = React.useState<number | null>(null);

  // Auto-scroll to current turn
  useEffect(() => {
    if (timelineRef.current && currentTurn > 0) {
      const currentElement = timelineRef.current.querySelector(`[data-turn="${currentTurn}"]`);
      if (currentElement) {
        currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTurn]);

  const getMarkerSize = (turn: PhilosopherTurn) => {
    if (turn.turnNumber === currentTurn) return 'w-4 h-4';
    if (turn.isUserTurn) return 'w-3 h-3';
    return 'w-2.5 h-2.5';
  };

  const getMarkerStyle = (turn: PhilosopherTurn) => {
    const color = philosopherColors[turn.philosopher] || '#6B7280';
    const isCurrent = turn.turnNumber === currentTurn;
    const isHovered = turn.turnNumber === hoveredTurn;
    
    return {
      backgroundColor: color,
      transform: isCurrent || isHovered ? 'scale(1.2)' : 'scale(1)',
      boxShadow: isCurrent ? `0 0 0 4px ${color}20` : 'none',
      border: turn.isUserTurn ? '2px solid white' : 'none',
    };
  };

  if (view === 'compact') {
    return (
      <div className="w-full px-4 py-2">
        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
          {/* Progress track */}
          <div 
            className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${(currentTurn / turns.length) * 100}%` }}
          />
          
          {/* Markers */}
          <div className="absolute inset-0 flex items-center">
            {turns.map((turn) => (
              <button
                key={turn.turnNumber}
                data-turn={turn.turnNumber}
                onClick={() => onSeek(turn.turnNumber)}
                className="absolute transform -translate-x-1/2 cursor-pointer"
                style={{ 
                  left: `${(turn.turnNumber / turns.length) * 100}%`,
                }}
                onMouseEnter={() => setHoveredTurn(turn.turnNumber)}
                onMouseLeave={() => setHoveredTurn(null)}
              >
                <div 
                  className={`${getMarkerSize(turn)} rounded-full transition-all duration-200`}
                  style={getMarkerStyle(turn)}
                />
                
                {/* Tooltip */}
                {hoveredTurn === turn.turnNumber && (
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    {turn.philosopher}
                    <div className="text-gray-300 text-[10px]">Turn {turn.turnNumber}</div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div 
      ref={timelineRef}
      className="w-full max-h-40 overflow-y-auto px-4 py-2 bg-gray-50 rounded-lg"
    >
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-300" />
        
        {/* Turn entries */}
        {turns.map((turn, index) => {
          const isCurrent = turn.turnNumber === currentTurn;
          const isPast = turn.turnNumber < currentTurn;
          
          return (
            <div
              key={turn.turnNumber}
              data-turn={turn.turnNumber}
              className={`relative flex items-start gap-3 py-2 cursor-pointer transition-all ${
                isCurrent ? 'bg-blue-50 -mx-4 px-4 rounded' : ''
              }`}
              onClick={() => onSeek(turn.turnNumber)}
            >
              {/* Marker */}
              <div className="relative z-10 flex-shrink-0 mt-1">
                <div
                  className={`${getMarkerSize(turn)} rounded-full transition-all duration-200`}
                  style={getMarkerStyle(turn)}
                />
              </div>
              
              {/* Content */}
              <div className={`flex-1 ${isPast && !isCurrent ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className={`font-medium text-sm ${isCurrent ? 'text-blue-700' : ''}`}>
                    {turn.philosopher}
                  </span>
                  <span className="text-xs text-gray-500">
                    Turn {turn.turnNumber}
                  </span>
                  {turn.isUserTurn && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      You
                    </span>
                  )}
                </div>
                
                {turn.preview && (
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                    {turn.preview}
                  </p>
                )}
                
                {turn.relevanceScore && turn.relevanceScore > 0.7 && (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                    <span className="text-[10px] text-gray-500">High relevance</span>
                  </div>
                )}
              </div>
              
              {/* Connector to next */}
              {index < turns.length - 1 && (
                <div className="absolute left-6 top-8 bottom-0 w-0.5 bg-gray-300" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

