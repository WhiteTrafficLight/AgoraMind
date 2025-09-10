import React, { useEffect, useState } from 'react';
import { XMarkIcon, LinkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { DebateTopic } from '../utils/debateTopics';
import { ChatRoomCreationParams, Philosopher } from '../types/openChat.types';
import PhilosopherDetailsModal from './PhilosopherDetailsModal';
import { freeDiscussionService } from '@/lib/api/freeDiscussionService';
import { useRouter } from 'next/navigation';
import { loggers } from '@/utils/logger';
import { useLoadingOverlay } from '@/app/loadingOverlay';

interface FreeDiscussionTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: DebateTopic | null;
  philosophers?: Philosopher[];
  customNpcs?: Philosopher[];
}

const FreeDiscussionTopicModal: React.FC<FreeDiscussionTopicModalProps> = ({
  isOpen,
  onClose,
  topic,
  philosophers = [],
  customNpcs = []
}) => {
  const router = useRouter();
  const overlay = useLoadingOverlay();

  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [selectedPhilosophers, setSelectedPhilosophers] = useState<string[]>([]);
  const [selectedCustomNpcs, setSelectedCustomNpcs] = useState<string[]>([]);

  const [selectedPhilosopherDetails, setSelectedPhilosopherDetails] = useState<Philosopher | null>(null);
  const [showPhilosopherDetails, setShowPhilosopherDetails] = useState(false);

  // Reset selections when modal opens or topic changes
  useEffect(() => {
    if (isOpen) {
      setSelectedPhilosophers([]);
      setSelectedCustomNpcs([]);
    }
  }, [isOpen, topic]);

  const renderContextIcon = (contextType: string) => {
    switch (contextType) {
      case 'url':
        return <LinkIcon className="h-5 w-5 text-blue-600" />;
      case 'pdf':
        return <DocumentTextIcon className="h-5 w-5 text-red-600" />;
      case 'text':
        return <DocumentTextIcon className="h-5 w-5 text-gray-500" />;
      default:
        return null;
    }
  };

  const getPhilosopherPortraitPath = (philosopherName: string): string => {
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

    const words = philosopherName.split(' ');
    const lastName = words[words.length - 1];
    const capitalizedLastName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
    return `/philosophers_portraits/${capitalizedLastName}.png`;
  };

  const togglePhilosopher = (philosopherId: string) => {
    setSelectedPhilosophers(prev => prev.includes(philosopherId)
      ? prev.filter(p => p !== philosopherId)
      : [...prev, philosopherId]
    );
  };

  const toggleCustomNpc = (npcId: string) => {
    setSelectedCustomNpcs(prev => prev.includes(npcId)
      ? prev.filter(p => p !== npcId)
      : [...prev, npcId]
    );
  };

  const loadPhilosopherDetails = async (philosopherId: string) => {
    try {
      const customNpc = customNpcs.find(p => p.id.toLowerCase() === philosopherId.toLowerCase());
      if (customNpc) {
        setSelectedPhilosopherDetails(customNpc);
        setShowPhilosopherDetails(true);
        return;
      }

      const existingPhil = philosophers.find(p => p.id.toLowerCase() === philosopherId.toLowerCase());
      if (existingPhil) {
        setSelectedPhilosopherDetails(existingPhil);
        setShowPhilosopherDetails(true);
        return;
      }

      const response = await fetch('/data/philosophers.json');
      if (response.ok) {
        const data = await response.json();
        const philosopher = data.philosophers.find((p: any) => 
          p.id.toLowerCase() === philosopherId.toLowerCase()
        );
        if (philosopher) {
          setSelectedPhilosopherDetails(philosopher);
          setShowPhilosopherDetails(true);
        } else {
          loggers.ui.error(`Philosopher '${philosopherId}' not found in data`);
        }
      } else {
        loggers.ui.error('Failed to load philosopher data from static file');
      }
    } catch (error) {
      loggers.ui.error('Error fetching philosopher details', error);
    }
  };

  const handleCreateDiscussion = async () => {
    if (isCreating || !topic) return;

    const allSelected = [...selectedPhilosophers, ...selectedCustomNpcs];
    if (allSelected.length === 0) return;

    setIsCreating(true);
    try {
      let finalContext = '';
      if (topic.context.content) {
        if (topic.context.type === 'url') {
          finalContext = `URL: ${topic.context.content}`;
        } else {
          finalContext = topic.context.content;
        }
      }

      const username = (typeof window !== 'undefined' && (sessionStorage.getItem('chat_username') || 'Anonymous')) || 'Anonymous';

      // 1) Create DB room first
      overlay.show('Creating room…');
      const roomResponse = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: topic.title,
          context: finalContext,
          contextUrl: topic.context.type === 'url' ? topic.context.content : undefined,
          maxParticipants: 10,
          npcs: allSelected,
          isPublic: true,
          dialogueType: 'free',
          generateInitialMessage: false,
          username
        } as Partial<ChatRoomCreationParams>)
      });
      if (!roomResponse.ok) throw new Error('Failed to create chat room');
      const dbRoom = await roomResponse.json();

      // 2) Create Free Discussion session on backend
      if (topic.context.type === 'url') {
        overlay.update(
          'Reading and summarizing the context…',
          'When the context is long, it might take some time for philosophers to read it.'
        );
      } else {
        overlay.update('Preparing participants…');
      }
      const session = await freeDiscussionService.createSession({
        topic: topic.title,
        philosophers: allSelected,
        context: finalContext,
        user_info: {
          user_id: username,
          user_name: username
        },
        config: {
          max_turns: 50,
          turn_timeout_seconds: 30,
          min_response_length: 50,
          max_response_length: 500,
          enable_interruptions: true,
          auto_play: false,
          turn_interval: 3.0,
          allow_user_interruption: true,
          playback_speed: 1.0
        }
      } as any);

      // 3) Map session id to room (fire-and-forget)
      overlay.update('Linking room and session…');
      fetch(`/api/rooms?id=${encodeURIComponent(dbRoom.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeDiscussionSessionId: session.session_id })
      }).catch(() => {});

      // 4) Route using session id
      overlay.update('Redirecting to the room…');
      onClose();
      router.push(`/chat?id=${encodeURIComponent(session.session_id)}`);
    } catch (error) {
      loggers.chat.error('Failed to create free discussion session', error);
      alert('Failed to create discussion. Please try again.');
    } finally {
      setIsCreating(false);
      overlay.hide();
    }
  };

  if (!isOpen || !topic) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose}></div>

      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-4xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl z-50 border border-gray-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold">Start Free Discussion</h2>
          <button 
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">{topic.title}</h3>
          </div>

          {topic.context.content && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                {topic.context.type && renderContextIcon(topic.context.type)}
                <h4 className="text-base font-medium text-gray-700">Context</h4>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                {topic.context.type === 'url' ? (
                  <a href={topic.context.content} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all hover:text-blue-700">
                    {topic.context.content}
                  </a>
                ) : (
                  <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {topic.context.content}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-base font-medium text-gray-700 mb-4">Select Participants</h4>

            {customNpcs.length > 0 && (
              <div className="mb-6">
                <h5 className="font-semibold text-gray-800 mb-3">My Custom Philosophers</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {customNpcs.map(npc => (
                    <div
                      key={npc.id}
                      className={`border rounded-lg p-3 transition select-none ${
                        selectedCustomNpcs.includes(npc.id)
                          ? 'ring-2 ring-blue-600 border-blue-600 bg-blue-50'
                          : 'hover:shadow-sm'
                      }`}
                    >
                      <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => toggleCustomNpc(npc.id)}
                      >
                        <img
                          src={npc.portrait_url || getPhilosopherPortraitPath(npc.name)}
                          alt={npc.name}
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(npc.name)}&background=random&size=32`;
                          }}
                        />
                        <span className="text-sm text-gray-800">{npc.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          loadPhilosopherDetails(npc.id);
                          return false;
                        }}
                        className="mt-2 text-xs text-black hover:underline"
                      >
                        View details
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h5 className="font-semibold text-gray-800 mb-3">Classic Philosophers</h5>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {philosophers.map(philosopher => (
                  <div
                    key={philosopher.id}
                    className={`border rounded-lg p-3 transition select-none ${
                      selectedPhilosophers.includes(philosopher.id)
                        ? 'ring-2 ring-blue-600 border-blue-600 bg-blue-50'
                        : 'hover:shadow-sm'
                    }`}
                  >
                    <div
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => togglePhilosopher(philosopher.id)}
                    >
                      <img
                        src={philosopher.portrait_url || getPhilosopherPortraitPath(philosopher.name)}
                        alt={philosopher.name}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(philosopher.name)}&background=random&size=32`;
                        }}
                      />
                      <span className="text-sm text-gray-800">{philosopher.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        loadPhilosopherDetails(philosopher.id);
                        return false;
                      }}
                      className="mt-2 text-xs text-black hover:underline"
                    >
                      View details
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end">
          <button
            onClick={handleCreateDiscussion}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium shadow hover:bg-blue-700 disabled:opacity-50"
            disabled={isCreating || (selectedPhilosophers.length + selectedCustomNpcs.length) === 0}
          >
            {isCreating ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                Creating Discussion...
              </>
            ) : (
              'Start Discussion'
            )}
          </button>
        </div>
      </div>

      <PhilosopherDetailsModal
        philosopher={selectedPhilosopherDetails}
        isOpen={showPhilosopherDetails}
        onClose={() => setShowPhilosopherDetails(false)}
        onToggleSelect={(philosopherId) => {
          // Toggle selection based on existence in either list
          if (selectedPhilosophers.includes(philosopherId)) {
            togglePhilosopher(philosopherId);
          } else if (selectedCustomNpcs.includes(philosopherId)) {
            toggleCustomNpc(philosopherId);
          } else {
            const isCustom = customNpcs.some(npc => npc.id === philosopherId);
            if (isCustom) {
              toggleCustomNpc(philosopherId);
            } else {
              togglePhilosopher(philosopherId);
            }
          }
        }}
        isSelected={selectedPhilosophers.includes(selectedPhilosopherDetails?.id || '') || 
                   selectedCustomNpcs.includes(selectedPhilosopherDetails?.id || '')}
      />
    </>
  );
};

export default FreeDiscussionTopicModal;


