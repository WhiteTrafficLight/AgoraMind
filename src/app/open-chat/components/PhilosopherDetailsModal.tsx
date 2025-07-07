import React from 'react';
import { Philosopher } from '../types/openChat.types';

interface PhilosopherDetailsModalProps {
  philosopher: Philosopher | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleSelect: (philosopherId: string) => void;
  isSelected: boolean;
}

const PhilosopherDetailsModal: React.FC<PhilosopherDetailsModalProps> = ({
  philosopher,
  isOpen,
  onClose,
  onToggleSelect,
  isSelected
}) => {
  if (!isOpen || !philosopher) {
    return null;
  }

  // 기본 아바타 생성 함수
  const getDefaultAvatar = () => {
    const name = philosopher.name || 'Philosopher';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128&font-size=0.5`;
  };

  // Generate philosopher portrait path from static files
  const getPhilosopherPortraitPath = (philosopherName: string): string => {
    // Map philosopher names to actual file names (using last names mostly)
    const nameMapping: Record<string, string> = {
      'socrates': 'Socrates',
      'plato': 'Plato', 
      'aristotle': 'Aristotle',
      'immanuel kant': 'Kant',
      'kant': 'Kant',
      'friedrich nietzsche': 'Nietzsche',
      'nietzsche': 'Nietzsche',
      'jean-paul sartre': 'Sartre',
      'sartre': 'Sartre',
      'albert camus': 'Camus',
      'camus': 'Camus',
      'simone de beauvoir': 'Beauvoir',
      'beauvoir': 'Beauvoir',
      'karl marx': 'Marx',
      'marx': 'Marx',
      'jean-jacques rousseau': 'Rousseau',
      'rousseau': 'Rousseau',
      'confucius': 'Confucius',
      'laozi': 'Laozi',
      'buddha': 'Buddha',
      'georg wilhelm friedrich hegel': 'Hegel',
      'hegel': 'Hegel',
      'ludwig wittgenstein': 'Wittgenstein',
      'wittgenstein': 'Wittgenstein'
    };
    
    const normalizedName = philosopherName.toLowerCase().trim();
    const fileName = nameMapping[normalizedName];
    
    if (fileName) {
      return `/philosophers_portraits/${fileName}.png`;
    }
    
    // Fallback: use capitalized last word as filename
    const words = philosopherName.split(' ');
    const lastName = words[words.length - 1];
    const capitalizedLastName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
    return `/philosophers_portraits/${capitalizedLastName}.png`;
  };

  const handleToggleSelect = () => {
    onToggleSelect(philosopher.id);
    onClose();
  };

  return (
    <>
      {/* Background overlay */}
      <div 
        className="philosopher-details-modal-overlay"
        onClick={onClose}
      >
        {/* Modal container */}
        <div 
          className="philosopher-details-modal-container"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button 
            className="philosopher-details-close"
            onClick={onClose}
          >
            ✕
          </button>
          
          {/* Header with avatar and basic info */}
          <div className="philosopher-details-header">
            <div className="philosopher-details-avatar">
              <img
                src={philosopher.portrait_url || getPhilosopherPortraitPath(philosopher.name)}
                alt={philosopher.name}
                onError={(e) => {
                  // 이미지 로드 실패 시 기본 아바타로 대체
                  (e.target as HTMLImageElement).src = getDefaultAvatar();
                }}
              />
            </div>
            <div className="philosopher-details-info">
              <h3>{philosopher.name}</h3>
              {(philosopher.period || philosopher.era) && (
                <div className="philosopher-details-meta">
                  {philosopher.school && `${philosopher.school} • `}
                  {philosopher.period || philosopher.era}
                </div>
              )}
            </div>
          </div>
          
          {/* Description */}
          {philosopher.description && (
            <div className="philosopher-details-description">
              {philosopher.description}
            </div>
          )}
          
          {/* Key concepts */}
          {philosopher.key_ideas && philosopher.key_ideas.length > 0 && (
            <div className="philosopher-details-concepts">
              <h4>Key Ideas</h4>
              <div className="philosopher-concepts-list">
                {philosopher.key_ideas.map((concept, index) => (
                  <span key={index} className="philosopher-concept-tag">
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="philosopher-details-actions">
            <button 
              className="philosopher-details-action-button"
              onClick={handleToggleSelect}
            >
              {isSelected ? 'Remove from Chat' : 'Add to Chat'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default PhilosopherDetailsModal; 