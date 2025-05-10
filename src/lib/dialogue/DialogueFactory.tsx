/**
 * 대화 형식에 맞는 UI 컴포넌트를 생성하는 팩토리
 */

import React from 'react';
import { ChatRoom, ChatMessage } from '../ai/chatService';
import ChatUI from '@/components/chat/ChatUI';
import CircularChatUI from '@/components/chat/CircularChatUI';
import DebateChatUI from '@/components/chat/DebateChatUI';
import DialogueController from './DialogueController';

/**
 * 대화 형식 팩토리 - 채팅방 타입에 따라 적절한 UI를 반환
 */
class DialogueUIFactory {
  /**
   * 채팅방 정보를 기반으로 적절한 대화 UI 컴포넌트 반환
   * @param room 채팅방 정보
   * @param props 컴포넌트에 전달할 추가 props
   */
  static createDialogueUI(
    room: ChatRoom,
    props: {
      messages: ChatMessage[];
      onSendMessage: (message: string) => void;
      onRefresh?: () => void;
      isLoading?: boolean;
      isGeneratingResponse?: boolean;
      username?: string;
      onEndChat?: () => void;
      controller?: DialogueController;
      npcDetails?: any[];
    }
  ): React.ReactNode {
    // 대화 타입에 따라 다른 컴포넌트 반환
    const dialogueType = room.dialogueType || 'standard';
    console.log(`Creating UI for dialogue type: ${dialogueType}`);
    
    switch (dialogueType) {
      case 'debate':
        // 찬반토론 UI
        return (
          <DebateChatUI
            room={room}
            messages={props.messages}
            npcDetails={props.npcDetails || []}
            onSendMessage={props.onSendMessage}
            onRefresh={props.onRefresh || (() => {})}
            isLoading={props.isLoading || false}
            isGeneratingResponse={props.isGeneratingResponse || false}
            username={props.username}
            onEndChat={props.onEndChat}
          />
        );
        
      case 'circular':
        // 원형 대화 UI
        return (
          <CircularChatUI
            chatId={room.id}
            chatTitle={room.title}
            participants={room.participants}
            initialMessages={props.messages}
            onBack={props.onEndChat}
          />
        );
        
      case 'standard':
      default:
        // 기본 대화 UI
        return (
          <ChatUI
            chatId={room.id.toString()}
            chatTitle={room.title}
            participants={room.participants}
            initialMessages={props.messages}
            onBack={props.onEndChat}
          />
        );
    }
  }
}

export default DialogueUIFactory; 