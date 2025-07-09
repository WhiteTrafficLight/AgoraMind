import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  roomId?: string;
  userId?: string;
  onMessage?: (data: any) => void;
  onUserJoined?: (data: any) => void;
  onUserLeft?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

// 전역 소켓 인스턴스 관리
let globalSocket: Socket | null = null;
let connectionCount = 0;

export const useSocket = (options: UseSocketOptions = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [transport, setTransport] = useState('N/A');
  const socketRef = useRef<Socket | null>(null);
  const hasJoinedRoom = useRef(false);

  const {
    roomId,
    userId,
    onMessage,
    onUserJoined,
    onUserLeft,
    onConnect,
    onDisconnect
  } = options;

  // 안정적인 콜백 함수들
  const stableOnMessage = useCallback((data: any) => {
    onMessage?.(data);
  }, [onMessage]);

  const stableOnUserJoined = useCallback((data: any) => {
    onUserJoined?.(data);
  }, [onUserJoined]);

  const stableOnUserLeft = useCallback((data: any) => {
    onUserLeft?.(data);
  }, [onUserLeft]);

  const stableOnConnect = useCallback(() => {
    onConnect?.();
  }, [onConnect]);

  const stableOnDisconnect = useCallback(() => {
    onDisconnect?.();
  }, [onDisconnect]);

  useEffect(() => {
    // 이미 연결된 소켓이 있으면 재사용
    if (globalSocket && globalSocket.connected) {
      console.log('♻️ Reusing existing Socket.IO connection');
      socketRef.current = globalSocket;
      setIsConnected(true);
      setTransport(globalSocket.io.engine.transport.name);
      connectionCount++;
      
      // 방 참여 (roomId와 userId가 있는 경우)
      if (roomId && userId && !hasJoinedRoom.current) {
        globalSocket.emit('join_room', {
          room_id: roomId,
          user_id: userId
        });
        hasJoinedRoom.current = true;
        console.log(`📥 Joining room ${roomId} as ${userId}`);
      }
      
      return;
    }

    // 새로운 연결이 필요한 경우에만 생성
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    
    console.log('🔌 Creating new Socket.IO connection to:', backendUrl);
    
    const socket = io(backendUrl, {
      autoConnect: true,
      transports: ['polling', 'websocket'],
      upgrade: true,
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 3,
      withCredentials: false,
      // Engine.IO 프로토콜 호환성 설정
      forceBase64: false,
      timestampRequests: false
    });

    globalSocket = socket;
    socketRef.current = socket;
    connectionCount++;

    // 연결 상태 이벤트
    socket.on('connect', () => {
      console.log('✅ Socket.IO connected:', socket.id);
      setIsConnected(true);
      setTransport(socket.io.engine.transport.name);
      stableOnConnect();
      
      // 방 참여 (roomId와 userId가 있는 경우)
      if (roomId && userId && !hasJoinedRoom.current) {
        socket.emit('join_room', {
          room_id: roomId,
          user_id: userId
        });
        hasJoinedRoom.current = true;
        console.log(`📥 Joining room ${roomId} as ${userId}`);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket.IO disconnected:', reason);
      setIsConnected(false);
      setTransport('N/A');
      hasJoinedRoom.current = false;
      stableOnDisconnect();
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
      setIsConnected(false);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket.IO reconnected after', attemptNumber, 'attempts');
      hasJoinedRoom.current = false; // 재연결시 방 재참여 허용
    });

    socket.on('reconnect_error', (error) => {
      console.error('❌ Socket.IO reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('❌ Socket.IO reconnection failed');
      globalSocket = null; // 연결 실패시 전역 소켓 초기화
    });

    // 백엔드 이벤트 리스너들
    socket.on('new_message', stableOnMessage);
    socket.on('user_joined', stableOnUserJoined);
    socket.on('user_left', stableOnUserLeft);

    // 방 생성/삭제 이벤트
    socket.on('room_created', (data) => {
      console.log('🏠 Room created:', data);
    });

    socket.on('room_deleted', (data) => {
      console.log('🗑️ Room deleted:', data);
    });

    // 전송 상태 변경 시
    socket.io.engine.on('upgrade', () => {
      setTransport(socket.io.engine.transport.name);
    });

    return () => {
      console.log('🔌 Cleaning up Socket.IO connection');
      connectionCount--;
      
      // 방 떠나기 (roomId와 userId가 있는 경우)
      if (roomId && userId && socket.connected && hasJoinedRoom.current) {
        socket.emit('leave_room', {
          room_id: roomId,
          user_id: userId
        });
        hasJoinedRoom.current = false;
        console.log(`📤 Leaving room ${roomId} as ${userId}`);
      }
      
      // 마지막 연결이면 소켓 해제
      if (connectionCount <= 0) {
        console.log('🔌 Disconnecting global socket (last connection)');
        socket.disconnect();
        globalSocket = null;
        connectionCount = 0;
      }
    };
  }, [roomId, userId]); // 함수 의존성 제거

  // 메시지 전송 함수
  const sendMessage = (message: string, side: string = 'neutral') => {
    if (!socketRef.current || !roomId || !userId) {
      console.error('❌ Cannot send message: missing socket, roomId, or userId');
      return false;
    }

    const messageData = {
      room_id: roomId,
      user_id: userId,
      message,
      side,
      timestamp: new Date().toISOString()
    };

    console.log('📤 Sending message:', messageData);
    socketRef.current.emit('send_message', messageData);
    return true;
  };

  // 방 참여 함수
  const joinRoom = (newRoomId: string, newUserId: string) => {
    if (!socketRef.current) {
      console.error('❌ Cannot join room: socket not connected');
      return false;
    }

    socketRef.current.emit('join_room', {
      room_id: newRoomId,
      user_id: newUserId
    });
    
    console.log(`📥 Joining room ${newRoomId} as ${newUserId}`);
    return true;
  };

  // 방 떠나기 함수
  const leaveRoom = (roomIdToLeave: string, userIdToLeave: string) => {
    if (!socketRef.current) {
      console.error('❌ Cannot leave room: socket not connected');
      return false;
    }

    socketRef.current.emit('leave_room', {
      room_id: roomIdToLeave,
      user_id: userIdToLeave
    });
    
    console.log(`📤 Leaving room ${roomIdToLeave} as ${userIdToLeave}`);
    return true;
  };

  return {
    socket: socketRef.current,
    isConnected,
    transport,
    sendMessage,
    joinRoom,
    leaveRoom
  };
}; 