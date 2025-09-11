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
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
        onClick={onClose}
      >
        <div
          className="relative w-[92vw] max-w-md sm:max-w-lg max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-200 p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            aria-label="Close"
            className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={onClose}
          >
            ✕
          </button>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full overflow-hidden ring-1 ring-gray-200">
              <img
                src={philosopher.portrait_url || getPhilosopherPortraitPath(philosopher.name)}
                alt={philosopher.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getDefaultAvatar();
                }}
              />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{philosopher.name}</h3>
              {(philosopher.period || philosopher.era) && (
                <div className="text-sm text-gray-600">
                  {philosopher.school && (<span>{philosopher.school} • </span>)}
                  {philosopher.period || philosopher.era}
                </div>
              )}
            </div>
          </div>

          {philosopher.description && (
            <div className="text-sm text-gray-800 mb-4">
              {philosopher.description}
            </div>
          )}

          {philosopher.key_ideas && philosopher.key_ideas.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Key Ideas</h4>
              <div className="flex flex-wrap gap-2">
                {philosopher.key_ideas.map((concept, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 border border-gray-200"
                  >
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <button
              className="w-full inline-flex items-center justify-center rounded-md bg-black text-white px-4 py-2 text-sm font-medium shadow hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
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