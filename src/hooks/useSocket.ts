import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { loggers } from '@/utils/logger';
import { API_BASE_URL } from '@/lib/api/baseUrl';

// Socket payloads are server-shaped; each consumer narrows the handler
// arg to its expected event payload. Using `any` here is intentional —
// `unknown` would force every caller to re-narrow, and a generic
// parameter on the option type doesn't help because each handler is
// independent. See .claude/skills/typescript: any is acceptable at
// system boundaries when narrowing happens at the call site.
/* eslint-disable @typescript-eslint/no-explicit-any -- See note above. */
interface UseSocketOptions {
  roomId?: string;
  userId?: string;
  onMessage?: (data: any) => void | Promise<void>;
  onUserJoined?: (data: any) => void;
  onUserLeft?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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

  /* eslint-disable @typescript-eslint/no-explicit-any -- socket payload shapes vary by event; consumers narrow at use site. */
  const stableOnMessage = useCallback((data: any) => {
    onMessage?.(data);
  }, [onMessage]);

  const stableOnUserJoined = useCallback((data: any) => {
    onUserJoined?.(data);
  }, [onUserJoined]);

  const stableOnUserLeft = useCallback((data: any) => {
    onUserLeft?.(data);
  }, [onUserLeft]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const stableOnConnect = useCallback(() => {
    onConnect?.();
  }, [onConnect]);

  const stableOnDisconnect = useCallback(() => {
    onDisconnect?.();
  }, [onDisconnect]);

  useEffect(() => {
    if (globalSocket && globalSocket.connected) {
      loggers.socket.debug('Reusing existing Socket.IO connection');
      socketRef.current = globalSocket;
      setIsConnected(true);
      setTransport(globalSocket.io.engine.transport.name);
      connectionCount++;
      
      // (roomId userId )
      if (roomId && userId && !hasJoinedRoom.current) {
        globalSocket.emit('join_room', {
          room_id: roomId,
          user_id: userId
        });
        hasJoinedRoom.current = true;
        loggers.socket.info(`room join: ${roomId} (user: ${userId})`);
      }
      
      return;
    }

    loggers.socket.info('Creating new Socket.IO connection', { url: API_BASE_URL });

    const socket = io(API_BASE_URL, {
      autoConnect: true,
      transports: ['polling', 'websocket'],
      upgrade: true,
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 3,
      withCredentials: false,
      // Engine.IO
      forceBase64: false,
      timestampRequests: false
    });

    globalSocket = socket;
    socketRef.current = socket;
    connectionCount++;

    socket.on('connect', () => {
      loggers.socket.info('Socket.IO connected successfully', { socketId: socket.id });
      setIsConnected(true);
      setTransport(socket.io.engine.transport.name);
      stableOnConnect();
      
      // (roomId userId )
      if (roomId && userId && !hasJoinedRoom.current) {
        socket.emit('join_room', {
          room_id: roomId,
          user_id: userId
        });
        hasJoinedRoom.current = true;
        loggers.socket.info(`room join: ${roomId} (user: ${userId})`);
      }
    });

    socket.on('disconnect', (reason) => {
      loggers.socket.warn('Socket.IO disconnected', { reason });
      setIsConnected(false);
      setTransport('N/A');
      hasJoinedRoom.current = false;
      stableOnDisconnect();
    });

    socket.on('connect_error', (error) => {
      loggers.socket.error('Socket.IO connection error', error);
      setIsConnected(false);
    });

    socket.on('reconnect', (attemptNumber) => {
      loggers.socket.info(`Socket.IO reconnected successfully (attempt: ${attemptNumber})`);
      hasJoinedRoom.current = false;
    });

    socket.on('reconnect_error', (error) => {
      loggers.socket.error('Socket.IO reconnection error', error);
    });

    socket.on('reconnect_failed', () => {
      loggers.socket.error('Socket.IO reconnection failed');
      globalSocket = null;
    });

    socket.on('new_message', stableOnMessage);
    socket.on('user_joined', stableOnUserJoined);
    socket.on('user_left', stableOnUserLeft);

    socket.on('room_created', (data) => {
      loggers.socket.info('Chat room created', data);
    });

    socket.on('room_deleted', (data) => {
      loggers.socket.info('Chat room deleted', data);
    });

    socket.io.engine.on('upgrade', () => {
      setTransport(socket.io.engine.transport.name);
    });

    return () => {
      loggers.socket.debug('Cleaning up Socket.IO connection');
      connectionCount--;
      
      // (roomId userId )
      if (roomId && userId && socket.connected && hasJoinedRoom.current) {
        socket.emit('leave_room', {
          room_id: roomId,
          user_id: userId
        });
        hasJoinedRoom.current = false;
        loggers.socket.info(`Leaving room: ${roomId} (user: ${userId})`);
      }
      
      if (connectionCount <= 0) {
        loggers.socket.info('Last connection released - shutting down global socket');
        socket.disconnect();
        globalSocket = null;
        connectionCount = 0;
      }
    };
  }, [roomId, userId]);
  const sendMessage = (message: string, side: string = 'neutral') => {
    if (!socketRef.current || !roomId || !userId) {
      loggers.socket.error('Cannot send message: socket, roomId or userId missing', {
        hasSocket: !!socketRef.current,
        roomId,
        userId
      });
      return false;
    }

    const messageData = {
      room_id: roomId,
      user_id: userId,
      message,
      side,
      timestamp: new Date().toISOString()
    };

    loggers.socket.debug('Sending message', { roomId, userId, messageLength: message.length });
    socketRef.current.emit('send_message', messageData);
    return true;
  };

  const joinRoom = (newRoomId: string, newUserId: string) => {
    if (!socketRef.current) {
      loggers.socket.error('Cannot join room: socket not connected');
      return false;
    }

    socketRef.current.emit('join_room', {
      room_id: newRoomId,
      user_id: newUserId
    });
    
    loggers.socket.info(`room join: ${newRoomId} (user: ${newUserId})`);
    return true;
  };

  const leaveRoom = (roomIdToLeave: string, userIdToLeave: string) => {
    if (!socketRef.current) {
      loggers.socket.error('Cannot leave room: socket not connected');
      return false;
    }

    socketRef.current.emit('leave_room', {
      room_id: roomIdToLeave,
      user_id: userIdToLeave
    });
    
    loggers.socket.info(`Leaving room: ${roomIdToLeave} (user: ${userIdToLeave})`);
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
