import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ContextPanelProps {
  context: string;
  topic: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  context,
  topic,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-white border-l border-gray-200 shadow-lg z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Discussion Context</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
        >
          <XMarkIcon className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Topic */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Topic</h4>
          <p className="text-sm text-gray-900 bg-gray-50 rounded p-3">
            {topic}
          </p>
        </div>

        {/* Context */}
        {context && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Background Context</h4>
            <div className="text-sm text-gray-700 bg-blue-50 rounded p-3 whitespace-pre-wrap">
              {context}
            </div>
          </div>
        )}

        {/* Key Points */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Discussion Guidelines</h4>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">•</span>
              Philosophers will explore different perspectives on the topic
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">•</span>
              Each speaker builds upon previous contributions
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">•</span>
              You can interrupt at any time to add your thoughts
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">•</span>
              The discussion adapts based on engagement and topic evolution
            </li>
          </ul>
        </div>

        {/* Tips */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Tips for Engagement</h4>
          <div className="bg-yellow-50 rounded p-3 text-sm text-gray-700">
            <p className="mb-2">
              🎯 Ask challenging questions to deepen the discussion
            </p>
            <p className="mb-2">
              🤔 Share personal perspectives to enrich the dialogue
            </p>
            <p>
              ⚡ Use the playback controls to adjust the pace to your preference
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
