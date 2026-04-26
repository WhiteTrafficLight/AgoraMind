import React from 'react';
import { PlayIcon, PauseIcon, ForwardIcon, BackwardIcon } from '@heroicons/react/24/solid';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface PlaybackControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  playbackSpeed: number;
  currentTurn: number;
  maxTurns: number;
  isProcessing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (speed: number) => void;
  onToggleAutoPlay: () => void;
  autoPlay: boolean;
  onNextTurn?: () => void;
}

const SPEED_OPTIONS = [0.5, 1.0, 1.5, 2.0];

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  isPaused,
  playbackSpeed,
  currentTurn,
  maxTurns,
  isProcessing,
  onPlay,
  onPause,
  onSpeedChange,
  onToggleAutoPlay,
  autoPlay,
  onNextTurn,
}) => {
  const [showSpeedMenu, setShowSpeedMenu] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [position, setPosition] = React.useState<{ x: number; y: number }>({ x: 16, y: 120 });
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    // Initialize near bottom-left on mount
    if (typeof window !== 'undefined') {
      const initialY = Math.max(80, window.innerHeight - 180);
      setPosition({ x: 16, y: initialY });
    }
  }, []);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      // Clamp within viewport
      const padding = 8;
      const maxX = (typeof window !== 'undefined') ? window.innerWidth - padding - 260 : newX; // approx width
      const maxY = (typeof window !== 'undefined') ? window.innerHeight - padding - 80 : newY; // approx height
      setPosition({
        x: Math.max(padding, Math.min(newX, maxX)),
        y: Math.max(padding, Math.min(newY, maxY)),
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handlePlayPause = () => {
    if (isPaused) {
      onPlay();
    } else {
      onPause();
    }
  };

  const handleSpeedSelect = (speed: number) => {
    onSpeedChange(speed);
    setShowSpeedMenu(false);
  };

  const progressPercentage = maxTurns > 0 ? (currentTurn / maxTurns) * 100 : 0;

  const handleDragStart = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setIsDragging(true);
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleDragStart}
      className={`fixed z-50 bg-white/90 supports-[backdrop-filter]:backdrop-blur border border-gray-200 rounded-xl shadow-lg p-3 md:p-4 flex items-center gap-3 md:gap-4 pointer-events-auto overflow-visible ${isDragging ? 'cursor-grabbing' : 'cursor-move'}`}
      style={{ left: position.x, top: position.y }}
    >
      {/* Play/Pause Button */}
      <button
        onClick={handlePlayPause}
        disabled={isProcessing}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm ${
          isProcessing 
            ? 'bg-gray-200 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isPaused ? (
          <PlayIcon className="h-5 w-5 ml-0.5" />
        ) : (
          <PauseIcon className="h-5 w-5" />
        )}
      </button>

      {/* Progress Bar */}
      <div className="flex-1 min-w-[220px]">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>Turn {currentTurn}</span>
          <span>{Math.round(progressPercentage)}%</span>
          <span>of {maxTurns}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300 shadow-inner"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Speed Control */}
      <div className="relative">
        <button
          onClick={() => setShowSpeedMenu(!showSpeedMenu)}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm"
        >
          {playbackSpeed}x
          {showSpeedMenu ? (
            <ChevronUpIcon className="h-3 w-3" />
          ) : (
            <ChevronDownIcon className="h-3 w-3" />
          )}
        </button>
        
        {showSpeedMenu && (
          <div className="absolute bottom-full mb-2 left-0 bg-white rounded-md shadow-lg ring-1 ring-black/5 border border-gray-200 py-1 min-w-[120px] z-50">
            {SPEED_OPTIONS.map(speed => (
              <button
                key={speed}
                onClick={() => handleSpeedSelect(speed)}
                className={`w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 transition-colors rounded-md ${
                  speed === playbackSpeed ? 'bg-blue-50 text-blue-600 font-medium' : ''
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Auto-play Toggle */}
      <button
        onClick={onToggleAutoPlay}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm ${
          autoPlay 
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Auto
      </button>

      {/* Skip / Next Controls */}
      <div className="flex items-center gap-1">
        <button
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm"
          title="Previous turn"
          disabled={currentTurn <= 1}
        >
          <BackwardIcon className="h-4 w-4 text-gray-600" />
        </button>
        <button
          onClick={() => onNextTurn && onNextTurn()}
          className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm text-sm font-medium flex items-center gap-1"
          title="Next turn"
          disabled={isProcessing || currentTurn >= maxTurns}
        >
          <ForwardIcon className="h-4 w-4 text-gray-600" />
          <span>Next</span>
        </button>
      </div>
    </div>
  );
};
