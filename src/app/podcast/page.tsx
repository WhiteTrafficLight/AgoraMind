'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Header from '@/components/ui/Header';

// Define podcast interface
interface PodcastParticipant {
  id: string;
  name: string;
}

interface PodcastSegment {
  index: number;
  speaker: string;
  filename: string;
  duration: number;
}

interface Podcast {
  id: string;
  title: string;
  created: string;
  participants: PodcastParticipant[];
  audioPath: string;
  segments: PodcastSegment[];
}

export default function PodcastPage() {
  const { data: session } = useSession();
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPodcast, setCurrentPodcast] = useState<Podcast | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch podcasts on component mount
  useEffect(() => {
    async function fetchPodcasts() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/podcast/list');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch podcasts: ${response.status}`);
        }
        
        const data = await response.json();
        setPodcasts(data.podcasts || []);
      } catch (error) {
        console.error('Error fetching podcasts:', error);
        setError('Failed to load podcasts. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchPodcasts();
  }, []);
  
  // Handle play podcast
  const handlePlayPodcast = (podcast: Podcast) => {
    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    // Set current podcast
    setCurrentPodcast(podcast);
    
    // Create a playlist of audio segments
    if (podcast.segments && podcast.segments.length > 0) {
      const audio = new Audio(podcast.segments[0].filename);
      let currentSegmentIndex = 0;
      
      // Play next segment when current one ends
      audio.addEventListener('ended', () => {
        currentSegmentIndex++;
        if (currentSegmentIndex < podcast.segments.length) {
          audio.src = podcast.segments[currentSegmentIndex].filename;
          audio.play().catch(err => console.error('Error playing audio:', err));
        } else {
          // Playlist finished
          setIsPlaying(false);
        }
      });
      
      // Start playing
      audio.play().catch(err => console.error('Error playing audio:', err));
      setCurrentAudio(audio);
      setIsPlaying(true);
    }
  };
  
  // Stop playing
  const handleStopPodcast = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setIsPlaying(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-bold text-black mb-4">
          Top Podcasts this week
        </h1>
        <p className="text-xl text-gray-600">
          Listen to the most thought-provoking philosophical discussions
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p>Loading podcasts...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-center py-10 text-red-600">
          <p>{error}</p>
        </div>
      )}

      {/* Podcast List */}
      {!isLoading && !error && (
        <div>
          {/* Current playing podcast */}
          {currentPodcast && (
            <div className="mb-10 p-6 bg-gray-50 rounded-lg shadow">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                <div className="w-full md:w-40 h-40 bg-gray-200 rounded-lg flex items-center justify-center relative">
                  {isPlaying ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-lg">
                      <button 
                        onClick={handleStopPodcast}
                        className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-400">Podcast Cover</span>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{currentPodcast.title}</h2>
                  <p className="text-gray-600 mb-4">
                    With {currentPodcast.participants.map(p => p.name).join(', ')}
                  </p>
                  <div className="text-sm text-gray-500 mb-4">
                    Created on {formatDate(currentPodcast.created)}
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handlePlayPodcast(currentPodcast)}
                      className={`px-4 py-2 rounded-full ${isPlaying 
                        ? 'bg-gray-200 text-gray-700' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'} 
                        transition-colors`}
                      disabled={isPlaying}
                    >
                      {isPlaying ? 'Playing...' : 'Play'}
                    </button>
                    {isPlaying && (
                      <button 
                        onClick={handleStopPodcast}
                        className="px-4 py-2 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Podcast Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {podcasts.length > 0 ? (
              podcasts.map((podcast) => (
                <div 
                  key={podcast.id} 
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="relative h-48 bg-gray-200 cursor-pointer" onClick={() => handlePlayPodcast(podcast)}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-white bg-opacity-80 flex items-center justify-center shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2">{podcast.title}</h3>
                    <p className="text-gray-600 mb-4">
                      With {podcast.participants.map(p => p.name).join(', ')}
                    </p>
                    <div className="flex items-center text-sm text-gray-500">
                      <span>{podcast.segments?.length || 0} messages</span>
                      <span className="mx-2">•</span>
                      <span>{formatDate(podcast.created)}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              // Placeholder cards for when no podcasts are available
              <>
                <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative h-48 bg-gray-200">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-gray-400">Podcast Cover</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2">The Nature of Consciousness</h3>
                    <p className="text-gray-600 mb-4">With David Chalmers and Daniel Dennett</p>
                    <div className="flex items-center text-sm text-gray-500">
                      <span>45 min</span>
                      <span className="mx-2">•</span>
                      <span>Philosophy of Mind</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative h-48 bg-gray-200">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-gray-400">Podcast Cover</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2">Ethics in the Digital Age</h3>
                    <p className="text-gray-600 mb-4">With Peter Singer and Martha Nussbaum</p>
                    <div className="flex items-center text-sm text-gray-500">
                      <span>52 min</span>
                      <span className="mx-2">•</span>
                      <span>Ethics</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative h-48 bg-gray-200">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-gray-400">Podcast Cover</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2">Artificial Intelligence & Human Values</h3>
                    <p className="text-gray-600 mb-4">With Nick Bostrom and Eliezer Yudkowsky</p>
                    <div className="flex items-center text-sm text-gray-500">
                      <span>63 min</span>
                      <span className="mx-2">•</span>
                      <span>Philosophy of Technology</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Coming Soon Section */}
      <div className="mt-16 bg-gray-50 rounded-xl p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">More episodes coming soon</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          We're working on bringing you more thought-provoking conversations with the greatest philosophers of all time.
          Stay tuned for weekly updates!
        </p>
      </div>

      <h2 className="text-2xl font-bold mb-6">Generated AI Podcasts</h2>
      
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Philosophy Discussions</h3>
        <p className="text-gray-600 mb-4">
          Explore deep philosophical conversations generated by AI. Each podcast features 
          discussions between renowned philosophers on various topics.
        </p>
        <p className="text-gray-600 mb-4">
          Choose from different philosophical perspectives and let our AI create an 
          engaging dialogue that makes complex ideas accessible and thought-provoking.
        </p>
        <p className="text-gray-600 mb-4">
          Whether you&apos;re interested in ethics, metaphysics, or political philosophy, 
          you&apos;ll find conversations that challenge your thinking and expand your understanding.
        </p>
      </div>
    </div>
  );
} 