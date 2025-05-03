'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ChatUI from '@/components/chat/ChatUI';
import chatService from '@/lib/ai/chatService';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function ChatRoom() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatRoom, setChatRoom] = useState<any>(null);
  const chatId = params?.id as string;

  useEffect(() => {
    const loadChatRoom = async () => {
      if (!chatId) return;
      
      try {
        setLoading(true);
        console.log('Loading chat room with ID:', chatId);

        // Get chat room details
        const roomData = await chatService.getChatRoomById(chatId);
        
        if (!roomData) {
          console.error('Chat room not found:', chatId);
          setError('Chat room not found');
          setLoading(false);
          return;
        }
        
        console.log('Chat room loaded:', roomData);
        setChatRoom(roomData);
      } catch (error) {
        console.error('Error loading chat room:', error);
        setError('Failed to load chat room');
      } finally {
        setLoading(false);
      }
    };

    loadChatRoom();
  }, [chatId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-xl font-semibold text-red-600 mb-4">Error</h2>
        <p className="text-gray-700 mb-6">{error}</p>
        <button
          onClick={() => router.push('/open-chat')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Return to Chat List
        </button>
      </div>
    );
  }

  if (!chatRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-4">
          <h2 className="text-xl font-semibold mb-2">Chat room not found</h2>
          <p className="text-gray-700 mb-6">The chat room you're looking for might have been deleted or never existed.</p>
          <button
            onClick={() => router.push('/open-chat')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Return to Chat List
          </button>
        </div>
      </div>
    );
  }

  return (
    <ChatUI 
      chatId={chatId}
      chatTitle={chatRoom.title || 'Unnamed Chat'}
      participants={chatRoom.participants || { users: [], npcs: [] }}
      initialMessages={chatRoom.messages || []}
    />
  );
} 