'use server';

import chatService, { ChatRoomCreationParams } from '@/lib/ai/chatService';

interface CreateChatParams {
  title: string;
  context: string;
  npcs: string[];
  maxParticipants: number;
}

export async function createNewChat(params: CreateChatParams) {
  try {
    const chatParams: ChatRoomCreationParams = {
      title: params.title,
      context: params.context,
      maxParticipants: params.maxParticipants,
      npcs: params.npcs
    };
    
    const newChat = await chatService.createChatRoom(chatParams);
    return newChat;
  } catch (error) {
    console.error('Failed to create chat room:', error);
    throw error;
  }
} 