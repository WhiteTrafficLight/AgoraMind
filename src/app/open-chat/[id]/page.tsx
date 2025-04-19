import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ChatUI from '@/components/chat/ChatUI';
import chatService from '@/lib/ai/chatService';
import { ChatRoom, ChatMessage } from '@/lib/ai/chatService';
import socketClient from '@/lib/socket/socketClient';
import LoadingSpinner from '@/components/common/LoadingSpinner';

// For TypeScript global augmentation - assuming this is added to a *.d.ts file in your project
declare global {
  interface Window {
    _debug?: {
      socketClient?: any;
      chatId?: string | number;
      username?: string;
      roomJoined?: boolean;
      [key: string]: any;
    };
  }
}

// Initialize socket
useEffect(() => {
  if (typeof window === 'undefined') return;
  
  async function initSocket() {
    try {
      console.log('📡 채팅방 소켓 초기화 시작...');
      // 전역 변수 초기화
      if (!window._debug) window._debug = {};
      
      // 소켓 클라이언트 초기화 준비
      const socketClientInstance = socketClient;
      window._debug.socketClient = socketClientInstance;
      
      // 정확한 소켓 연결 설정
      const username = localStorage.getItem('username') || 'Guest' + Math.floor(Math.random() * 1000);
      console.log('📡 사용자명:', username);
      
      // 이미 연결된 상태인지 확인
      if (socketClientInstance.isConnected()) {
        console.log('📡 소켓이 이미 연결되어 있음, 재사용합니다.');
      } else {
        console.log('📡 소켓 연결 시작...');
        await socketClientInstance.init(username);
        console.log('📡 소켓 초기화 완료');
      }
      
      // 방 접속 시도
      console.log(`📡 채팅방 입장 시도: ${params.id}`);
      const joined = socketClientInstance.joinRoom(params.id);
      console.log('📡 방 입장 결과:', joined ? '성공' : '실패');
      
      // 디버깅 정보 갱신
      window._debug.chatId = params.id;
      window._debug.username = username;
      window._debug.roomJoined = joined;
      
      setSocketInitialized(true);
    } catch (error) {
      console.error('📡 소켓 초기화 오류:', error);
      
      // 오류 상태 표시
      setSocketError('Socket connection failed');
      setSocketInitialized(true); // 초기화는 완료됨 (실패했지만)
    }
  }
  
  initSocket();
}, [params.id]); 