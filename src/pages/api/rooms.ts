import type { NextApiRequest, NextApiResponse } from 'next';
import type { Socket as NetSocket } from 'net';
import type { Server as HttpServer } from 'http';
import type { Server as SocketIOServer } from 'socket.io';
import { ChatRoom, ChatRoomCreationParams } from '@/lib/ai/chatService';
import chatRoomDB from '@/lib/db/chatRoomDB';

// Socket 서버 관련 타입 정의
interface SocketServer extends HttpServer {
  io?: SocketIOServer;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithIO extends NextApiResponse {
  socket: SocketWithIO;
}

// 디버그 모드 설정 - 로깅 제어용
const DEBUG = false;

// 로그 출력 함수 - 디버그 모드에서만 출력
function log(...args: any[]) {
  if (DEBUG) {
    console.log(...args);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseWithIO
) {
  // 중요한 로그만 유지하고 나머지는 디버그 모드로 제어
  if (req.method === 'POST') {
    console.log('API 요청 받음:', req.method, req.url);
  } else {
    log('API 요청 받음:', req.method, req.url);
  }

  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET 요청 - 모든 채팅룸 반환
  if (req.method === 'GET') {
    try {
      console.log('GET 요청 처리 - 쿼리:', req.query);
      
      // ID로 특정 채팅룸 필터링
      const { id } = req.query;
      if (id) {
        console.log(`ID ${id}로 채팅룸 검색 중`);
        // 배열인 경우 첫 번째 값만 사용
        const roomId = Array.isArray(id) ? id[0] : id;
        
        // 문자열인 경우 숫자로 변환 시도
        const numericRoomId = !isNaN(Number(roomId)) ? Number(roomId) : roomId;
        
        // 데이터베이스에서 채팅룸 조회
        const room = await chatRoomDB.getChatRoomById(numericRoomId);
        console.log('검색 결과:', room ? '찾음' : '없음');
        
        // 아이디 일치 여부 확인
        if (room && String(room.id) !== String(numericRoomId)) {
          console.error(`❌ 잘못된 방 ID: 요청=${numericRoomId}, 반환=${room.id}`);
          return res.status(200).json(null);
        }
        
        if (room) {
          console.log(`채팅룸 ${roomId} 정보:`, {
            title: room.title,
            messagesCount: room.messages?.length || 0,
            lastMessageFrom: room.messages && room.messages.length > 0 
              ? room.messages[room.messages.length - 1].sender 
              : 'none'
          });
        }
        
        return res.status(200).json(room || null);
      }

      // 모든 채팅룸 가져오기
      const allRooms = await chatRoomDB.getAllChatRooms();
      
      // 중복 ID 제거 - 동일한 ID의 첫 번째 채팅방만 유지
      const uniqueRooms = allRooms.reduce((acc: ChatRoom[], room: ChatRoom) => {
        const exists = acc.some((r: ChatRoom) => String(r.id) === String(room.id));
        if (!exists) {
          acc.push(room);
        } else {
          console.warn(`중복 채팅룸 ID 발견: ${room.id}, ${room.title}`);
        }
        return acc;
      }, [] as ChatRoom[]);
      
      // 필터링 로직 (예: 공개/비공개 방 필터링)
      const { isPublic } = req.query;
      let filteredRooms = uniqueRooms;

      if (isPublic !== undefined) {
        const publicOnly = isPublic === 'true';
        filteredRooms = filteredRooms.filter(room => room.isPublic === publicOnly);
      }

      return res.status(200).json(filteredRooms);
    } catch (error) {
      console.error('Error getting chat rooms:', error);
      return res.status(500).json({ error: 'Failed to get chat rooms' });
    }
  }

  // POST 요청 - 새 채팅룸 생성
  if (req.method === 'POST') {
    try {
      console.log('POST 요청 처리 - 채팅룸 생성');
      
      const params = req.body as ChatRoomCreationParams;
      log('요청 본문:', params);

      // 유효성 검사
      if (!params.title || !params.title.trim()) {
        console.log('오류: 제목 없음');
        return res.status(400).json({ error: 'Chat room title is required' });
      }

      if (!params.npcs || !Array.isArray(params.npcs) || params.npcs.length === 0) {
        console.log('오류: NPC 없음');
        return res.status(400).json({ error: 'At least one philosopher (NPC) is required' });
      }

      // 현재 사용자 (요청에서 제공되거나 기본값 사용)
      const currentUser = params.currentUser || 'User123';

      // 새 채팅룸 객체 생성
      const newRoom: ChatRoom = {
        id: Date.now().toString(),
        title: params.title,
        context: params.context || '',
        participants: {
          users: [currentUser],
          npcs: [...params.npcs]
        },
        totalParticipants: 1 + params.npcs.length,
        lastActivity: 'Just now',
        messages: [],
        isPublic: params.isPublic !== false
      };

      // 채팅룸 데이터베이스에 저장
      const createdRoom = await chatRoomDB.createChatRoom(newRoom);

      console.log(`✅ Chat room created with ID: ${createdRoom.id}, title: "${createdRoom.title}"`);
      
      // Socket.IO 이벤트 발생 (서버에 Socket.IO 인스턴스가 있는 경우)
      if (res.socket.server.io) {
        console.log('Broadcasting room-created event');
        res.socket.server.io.emit('room-created', createdRoom);
      } else {
        console.warn('Socket.IO server not available, could not broadcast room-created event');
      }

      return res.status(201).json(createdRoom);
    } catch (error) {
      console.error('Error creating chat room:', error);
      return res.status(500).json({ error: 'Failed to create chat room' });
    }
  }

  // PUT 요청 - 채팅룸 업데이트 (메시지 추가 등)
  if (req.method === 'PUT') {
    try {
      console.log('PUT 요청 처리 - 채팅룸 업데이트');
      
      // id 또는 roomId 파라미터 중 하나를 사용
      const roomId = req.query.id || req.query.roomId;
      
      if (!roomId) {
        return res.status(400).json({ error: 'Room ID is required' });
      }
      
      const roomIdStr = Array.isArray(roomId) ? roomId[0] : roomId;
      console.log(`룸 업데이트 요청: ID ${roomIdStr}`);
      
      // 채팅룸 존재 여부 확인
      const room = await chatRoomDB.getChatRoomById(roomIdStr);
      if (!room) {
        console.log(`방을 찾을 수 없음: ${roomIdStr}`);
        return res.status(404).json({ error: 'Chat room not found' });
      }
      
      const updates = req.body;
      console.log(`Updating room ${roomIdStr} with:`, updates);
      
      // 메시지 추가 처리
      if (updates.message) {
        const { message } = updates;
        console.log(`새 메시지 추가: ${message.sender}의 메시지, ID: ${message.id}`);
        console.log(`📋 메시지 전체 데이터: ${JSON.stringify(message)}`);
        
        // 디버깅: citations 필드 확인
        if (message.citations) {
          console.log(`📚 인용 정보 포함됨: ${JSON.stringify(message.citations)}`);
        } else {
          console.log(`⚠️ 인용 정보 없음 (citations 필드: ${message.citations})`);
        }
        
        // 클라이언트에서 오는 메시지 객체가 citations 필드를 가지고 있지만 
        // undefined로 설정된 경우를 처리
        if (message.hasOwnProperty('citations') && message.citations === undefined) {
          console.log(`⚠️ citations 필드가 undefined로 설정됨, 삭제 중...`);
          delete message.citations;
        }
        
        // 클라이언트 상태에서 citations가 빈 배열이나 null인 경우도 처리
        if (message.citations && Array.isArray(message.citations) && message.citations.length === 0) {
          console.log(`⚠️ citations가 빈 배열임, 삭제 중...`);
          delete message.citations;
        }
        
        const success = await chatRoomDB.addMessage(roomIdStr, message);
        
        if (success) {
          console.log(`룸 ${roomIdStr}에 ${message.sender}의 새 메시지 추가됨`);
          
          // Socket.IO 이벤트 발생 (서버에 Socket.IO 인스턴스가 있는 경우)
          if (res.socket.server.io) {
            console.log('Broadcasting message-added event');
            // 메시지와 함께 roomId도 전송하여 클라이언트에서 올바르게 처리할 수 있도록 함
            const socketData = {
              roomId: roomIdStr,
              message: message
            };
            console.log(`🔄 Socket.IO 브로드캐스트 데이터: ${JSON.stringify(socketData)}`);
            res.socket.server.io.to(roomIdStr).emit('new-message', socketData);
            console.log(`✅ 브로드캐스트 완료 - 방 ID: ${roomIdStr}, 메시지 ID: ${message.id}`);
          } else {
            console.warn(`❌ Socket.IO 서버가 초기화되지 않아 브로드캐스트할 수 없음`);
          }
        } else {
          console.log(`중복 메시지 건너뜀, ID: ${message.id}`);
        }
      }
      
      // 참여자 업데이트 처리
      if (updates.participants) {
        await chatRoomDB.updateChatRoom(roomIdStr, { 
          participants: {
            ...room.participants,
            ...updates.participants
          }
        });
        
        // 총 참여자 수 업데이트
        const updatedRoom = await chatRoomDB.getChatRoomById(roomIdStr);
        if (updatedRoom) {
          await chatRoomDB.updateChatRoom(roomIdStr, { 
            totalParticipants: 
              updatedRoom.participants.users.length + 
              updatedRoom.participants.npcs.length
          });
        }
      }
      
      // 업데이트된 채팅룸 반환
      const updatedRoom = await chatRoomDB.getChatRoomById(roomIdStr);
      return res.status(200).json({
        success: true,
        room: updatedRoom
      });
    } catch (error) {
      console.error('Error updating chat room:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to update chat room' 
      });
    }
  }

  // 지원하지 않는 메서드
  return res.status(405).json({ error: 'Method not supported' });
}

// 철학자 환영 메시지 생성 함수
function getInitialPrompt(topic: string, context?: string): string {
  // 환영 메시지 생성 제거 - 백엔드 API에서 생성된 메시지만 사용
  return "";
  
  /* 기존 코드 주석 처리
  const greetings = [
    `Welcome! I'm excited to discuss "${topic}".`,
    `Greetings! I look forward to exploring "${topic}" together.`,
    `Let's begin our philosophical inquiry into "${topic}".`,
    `I'm pleased to join this dialogue on "${topic}".`
  ];
  
  const contextAddition = context 
    ? ` Considering the context: "${context}", I think we have much to explore.` 
    : '';
  
  const questions = [
    'What aspects of this topic interest you the most?',
    'What are your initial thoughts on this subject?',
    'Is there a particular angle you would like to approach this from?',
    'Shall we begin by defining some key terms related to this topic?'
  ];
  
  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
  
  return `${randomGreeting}${contextAddition} ${randomQuestion}`;
  */
} 