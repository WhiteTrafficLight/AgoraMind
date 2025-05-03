'use client';

import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'md', 
  color = '#3b82f6' 
}) => {
  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'w-4 h-4 border-2';
      case 'lg': return 'w-10 h-10 border-4';
      case 'md':
      default: return 'w-6 h-6 border-3';
    }
  };

  return (
    <div className="inline-flex items-center justify-center">
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

export default Spinner; 