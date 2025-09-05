import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ConversationSummary } from '@/app/open-chat/types/freeDiscussion.types';

interface StatsPanelProps {
  stats: ConversationSummary['speaker_stats'];
  engagementScore: number;
  currentTurn: number;
  maxTurns: number;
  isOpen: boolean;
  onClose: () => void;
  philosopherColors: Record<string, string>;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  stats,
  engagementScore,
  currentTurn,
  maxTurns,
  isOpen,
  onClose,
  philosopherColors,
}) => {
  if (!isOpen) return null;

  const totalMessages = Object.values(stats).reduce((sum, stat) => sum + stat.message_count, 0);
  const totalWords = Object.values(stats).reduce((sum, stat) => sum + stat.total_words, 0);

  const getSpeakerPercentage = (messageCount: number) => {
    return totalMessages > 0 ? (messageCount / totalMessages) * 100 : 0;
  };

  return (
    <div className="absolute top-0 left-0 h-full w-80 bg-white border-r border-gray-200 shadow-lg z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Conversation Statistics</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
        >
          <XMarkIcon className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Overall Stats */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Overall Progress</h4>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Conversation Progress</span>
                <span className="font-medium">{Math.round((currentTurn / maxTurns) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentTurn / maxTurns) * 100}%` }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Engagement Level</span>
                <span className="font-medium">{Math.round(engagementScore * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    engagementScore > 0.7 ? 'bg-green-500' : 
                    engagementScore > 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${engagementScore * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Speaker Stats */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Speaker Participation</h4>
          <div className="space-y-3">
            {Object.entries(stats).map(([speaker, stat]) => {
              const percentage = getSpeakerPercentage(stat.message_count);
              const color = philosopherColors[speaker] || '#6B7280';
              
              return (
                <div key={speaker}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium" style={{ color }}>
                      {speaker}
                    </span>
                    <span className="text-gray-500">
                      {stat.message_count} turns ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: color 
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {stat.total_words} words • Avg: {Math.round(stat.total_words / stat.message_count)} words/turn
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Summary</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Total Turns</span>
              <div className="font-semibold text-lg">{currentTurn}</div>
            </div>
            <div>
              <span className="text-gray-500">Total Words</span>
              <div className="font-semibold text-lg">{totalWords}</div>
            </div>
            <div>
              <span className="text-gray-500">Avg Turn Length</span>
              <div className="font-semibold text-lg">
                {totalMessages > 0 ? Math.round(totalWords / totalMessages) : 0}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Active Speakers</span>
              <div className="font-semibold text-lg">{Object.keys(stats).length}</div>
            </div>
          </div>
        </div>

        {/* Engagement Indicators */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Engagement Indicators</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Topic Coherence</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i <= Math.round(engagementScore * 5) ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Response Diversity</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i <= 4 ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Argument Depth</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i <= 3 ? 'bg-purple-500' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

