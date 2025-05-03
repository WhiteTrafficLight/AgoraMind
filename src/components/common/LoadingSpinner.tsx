'use client';

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  color = '#3b82f6' 
}) => {
  const getSizeClass = () => {
    switch (size) {
      case 'small': return 'w-5 h-5 border-2';
      case 'large': return 'w-12 h-12 border-4';
      case 'medium':
      default: return 'w-8 h-8 border-3';
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div 
        className={`${getSizeClass()} rounded-full animate-spin`}
        style={{ 
          borderColor: `${color}20`,
          borderTopColor: color 
        }}
      />
    </div>
  );
};

export default LoadingSpinner; 