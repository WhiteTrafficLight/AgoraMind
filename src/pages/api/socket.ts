import type { NextApiRequest, NextApiResponse } from 'next';
import type { Socket } from 'net';
import type { Server as HTTPServer } from 'http';
import { socketCore } from '../../lib/messaging/socket/server/socket-core';
import { freeSocketServer } from '../../lib/messaging/socket/server/free-server';
import { debateSocketServer } from '../../lib/messaging/socket/server/debate-server';
import { JoinRoomData, BaseRoom } from '@/lib/messaging/types/common.types';
import chatRoomDB from '../../lib/db/chatRoomDB';

// Socket 서버 관련 타입 정의
interface NextApiResponseWithSocket extends NextApiResponse {
  socket: Socket & {
    server: HTTPServer & {
      io?: any;
    };
  };
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (res.socket.server.io) {
    console.log('Socket.IO server already running');
    res.end();
    return;
  }

  console.log('🚀 Initializing new Socket.IO server...');
  const io = socketCore.initializeServer(req, res);

  // 소켓 연결 처리
  io.on('connection', (socket) => {
    console.log(`🔗 NEW CONNECTION: ${socket.id} from ${socket.handshake.address}`);
    console.log(`🔗 User-Agent: ${socket.handshake.headers['user-agent']}`);
    console.log(`🔗 Total connections: ${io.engine.clientsCount}`);
    
    socketCore.logConnection(socket.id);
    
    // 소켓 최대 리스너 수 증가 (중복 등록 경고 방지)
    socket.setMaxListeners(50);
    
    // 기본 이벤트 핸들러 등록
    socket.on('join-room', async (data) => {
      const { roomId, username } = data;
      
      if (!roomId || !username) {
        console.error('❌ Missing roomId or username:', { roomId, username });
        return;
      }
      
      console.log(`👤 User ${username} joining room ${roomId}`);
      
      try {
        // 사용자 등록 및 방 입장
        socketCore.addUser(socket.id, username);
        socketCore.addUserToRoom(socket.id, roomId);
        socket.join(roomId);
        
        socketCore.logRoomJoin(username, roomId);
        
        // 방에 있는 다른 사용자들에게 알림
        socket.to(roomId).emit('user-joined', {
          username,
          message: `${username}님이 입장했습니다.`
        });
        
      } catch (error) {
        console.error('❌ Error joining room:', error);
      }
    });

    socket.on('leave-room', async (data) => {
      const { roomId, username } = data;
      
      if (!roomId || !username) {
        console.error('❌ Missing roomId or username for leave-room:', { roomId, username });
        return;
      }
      
      try {
        socketCore.removeUserFromRoom(socket.id, roomId);
        socket.leave(roomId);
        
        socketCore.logRoomLeave(username, roomId);
        
        socket.to(roomId).emit('user-left', {
          username,
          message: `${username}님이 퇴장했습니다.`
        });
        
              } catch (error) {
        console.error('❌ Error leaving room:', error);
      }
    });

    // 핸들러 등록 요청 처리
    socket.on('register-handlers', async (data) => {
      const { roomId } = data;
      
      if (!roomId) {
        console.error('❌ Missing roomId for register-handlers');
              return;
            }
            
      try {
        console.log(`🔍 Looking up room type for room ${roomId}`);
        const room = await chatRoomDB.getChatRoomById(roomId);
        
        if (!room || !room.dialogueType) {
          console.error(`❌ Room ${roomId} not found or missing dialogue type`);
                  return;
                }
                
        console.log(`🔧 Registering ${room.dialogueType} handlers for room ${roomId}`);
        
        // 방 타입에 따라 핸들러 등록
        if (room.dialogueType === 'debate') {
          debateSocketServer.registerHandlers(socket);
        } else if (room.dialogueType === 'free') {
          freeSocketServer.registerHandlers(socket);
        }
        
        console.log(`✅ ${room.dialogueType.toUpperCase()} handlers registered for room ${roomId}`);
        
            } catch (error) {
        console.error(`❌ Error registering handlers for room ${roomId}:`, error);
      }
    });

    // 연결 해제 처리
    socket.on('disconnect', (reason) => {
      socketCore.logDisconnection(socket.id);
      
      const user = socketCore.removeUser(socket.id);
      if (user) {
        // 사용자가 있던 모든 방에 퇴장 알림
        user.rooms.forEach(roomId => {
          socket.to(roomId).emit('user-left', {
            username: user.username,
            message: `${user.username}님이 연결이 끊어졌습니다.`
          });
        });
      }
    });

    // Python 백엔드로부터의 브로드캐스트 요청 처리
    socket.on('broadcast-to-room', (data: { room_id: string, event: string, data: any }) => {
      console.log(`📢 [PYTHON] 브로드캐스트 요청 받음!`);
      console.log(`📢 [PYTHON] 방 ID: ${data.room_id}`);
      console.log(`📢 [PYTHON] 이벤트: ${data.event}`);
      console.log(`📢 [PYTHON] 데이터: ${JSON.stringify(data.data).substring(0, 200)}...`);
      
      // 해당 방에 몇 명이 있는지 확인
      const roomSockets = io.sockets.adapter.rooms.get(data.room_id);
      const clientCount = roomSockets ? roomSockets.size : 0;
      console.log(`📢 [PYTHON] 방 ${data.room_id}에 있는 클라이언트 수: ${clientCount}명`);
      
      // 특정 방에 있는 모든 클라이언트에게 브로드캐스트
      io.to(data.room_id).emit(data.event, data.data);
      
      console.log(`✅ [PYTHON] 브로드캐스트 완료: 방 ${data.room_id}에 ${data.event} 이벤트 ${clientCount}명에게 전송됨`);
    });
  });

  res.end();
} 