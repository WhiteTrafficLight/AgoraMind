import { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { Socket as NetSocket } from 'net';

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

// 채팅방 스키마 정의
const chatRoomSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.Mixed, required: true },
  title: { type: String, required: true },
  participants: {
    users: [String],
    npcs: [String]
  },
  messages: [{
    id: String,
    text: String,
    sender: String,
    isUser: Boolean,
    timestamp: Date
  }],
  lastActivity: { type: Date, default: Date.now }
});

// 파이썬 백엔드 URL - 환경 변수에서 가져오거나 기본값 사용
const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_API_URL || 'http://localhost:8000';

export default async function handler(req: NextApiRequest, res: NextApiResponseWithIO) {
  console.log(`🔄 [API] /api/dialogue/auto 요청 받음: ${req.method}`);
  
  if (req.method !== 'POST') {
    console.warn(`❌ [API] 잘못된 메서드: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 요청 본문 유효성 검사
  const { roomId, topic, participants, rounds = 3 } = req.body;
  console.log(`🔄 [API] 요청 파라미터:`, { roomId, topic, participants, rounds });

  if (!roomId || !participants || !Array.isArray(participants) || participants.length < 2) {
    console.error(`❌ [API] 잘못된 요청 파라미터`, { roomId, participants });
    return res.status(400).json({ 
      error: '잘못된 요청입니다. roomId와 최소 2명 이상의 participants가 필요합니다.' 
    });
  }

  try {
    console.log(`🤖 [API] 채팅방 ${roomId}에서 ${participants.length}명의 NPC 간 자동 대화 요청`);
    console.log(`🤖 [API] 참여자: ${participants.join(', ')}`);
    console.log(`🤖 [API] 주제: ${topic || '없음'}`);
    console.log(`🤖 [API] 라운드 수: ${rounds}`);

    // 파이썬 백엔드의 다이얼로그 생성 API 호출
    const apiEndpoint = `${BACKEND_API_URL}/api/dialogue/generate`;
    console.log(`🔄 [API] 파이썬 백엔드 API 호출: ${apiEndpoint}`);
    
    const dialogueResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        participants: participants,
        topic: topic || 'philosophical discussion',
        rounds: rounds
      })
    }).catch(err => {
      console.error(`❌ [API] 파이썬 백엔드 연결 실패:`, err.message);
      throw new Error(`Python 백엔드 연결 실패: ${err.message}`);
    });

    if (!dialogueResponse) {
      throw new Error('Python 백엔드에서 응답이 없습니다.');
    }

    console.log(`🔄 [API] Python 백엔드 응답 상태: ${dialogueResponse.status}`);
    
    if (!dialogueResponse.ok) {
      const errorText = await dialogueResponse.text().catch(() => '응답 내용을 읽을 수 없습니다.');
      console.error(`❌ [API] 백엔드 API 오류 (${dialogueResponse.status}):`, errorText);
      throw new Error(`Backend API error (${dialogueResponse.status}): ${errorText}`);
    }

    const dialogueData = await dialogueResponse.json();
    console.log(`✅ [API] Python 백엔드에서 ${dialogueData.exchanges?.length || 0}개의 대화 교환 수신`);
    
    // Log the actual content of exchanges
    if (dialogueData.exchanges && dialogueData.exchanges.length > 0) {
      console.log(`✅ [API] 교환 내용 로그:`);
      dialogueData.exchanges.forEach((exchange: { speaker: string; content: string }, idx: number) => {
        console.log(`   ${idx+1}. ${exchange.speaker}: ${exchange.content.substring(0, 100)}${exchange.content.length > 100 ? '...' : ''}`);
      });
    }

    // 채팅 메시지 생성
    const messages = [];
    const timestamp = new Date();

    if (dialogueData.exchanges && dialogueData.exchanges.length > 0) {
      // 각 대화 교환을 메시지로 변환
      for (let i = 0; i < dialogueData.exchanges.length; i++) {
        const exchange = dialogueData.exchanges[i];
        
        // 메시지 생성 시간을 약간씩 다르게 설정 (순서대로 표시하기 위함)
        const msgTimestamp = new Date(timestamp.getTime() + (i * 1000));
        
        messages.push({
          id: `auto-${uuidv4().substring(0, 8)}`,
          text: exchange.content,
          sender: exchange.speaker,
          isUser: false,
          timestamp: msgTimestamp
        });
      }

      // MongoDB에 연결
      console.log(`🔄 [API] MongoDB 연결 중...`);
      await connectDB();
      
      // Get MongoDB connection and debug available collections
      const client = await mongoose.connection.getClient();
      const db = client.db(process.env.MONGODB_DB || 'agoramind');
      const collections = await db.listCollections().toArray();
      console.log(`🔄 [API] MongoDB 컬렉션 목록:`, collections.map(c => c.name));

      // 채팅방 모델 가져오기
      const ChatRoomModel = mongoose.models.chatRooms || 
        mongoose.model('chatRooms', chatRoomSchema, 'chatRooms');
      
      console.log(`🔄 [API] 채팅방 모델 초기화됨, 컬렉션명: chatRooms`);

      // 채팅방 찾기
      console.log(`🔄 [API] 채팅방 ID ${roomId} 조회 중...`);
      // Convert roomId to support both string and number formats
      const numericRoomId = !isNaN(Number(roomId)) ? Number(roomId) : roomId;
      const stringRoomId = String(roomId);
      
      // Try to find the room with either format
      const chatRoom = await ChatRoomModel.findOne({
        $or: [
          { roomId: numericRoomId },
          { roomId: stringRoomId }
        ]
      });
      
      if (!chatRoom) {
        console.error(`❌ [API] 채팅방 ID ${roomId}를 찾을 수 없음`);
        // Get all rooms to debug
        const allRooms = await ChatRoomModel.find({}, { roomId: 1, title: 1 });
        console.error(`❌ [API] 존재하는 모든 채팅방:`, JSON.stringify(allRooms.map(r => ({ 
          id: r.roomId, 
          title: r.title,
          type: typeof r.roomId
        }))));
        throw new Error(`Chat room with ID ${roomId} not found`);
      }

      // 새 메시지를 채팅방에 추가
      console.log(`🔄 [API] 채팅방에 ${messages.length}개의 메시지 추가 중...`);
      console.log(`🔄 [API] 채팅방 객체 구조:`, {
        id: chatRoom.id || chatRoom._id,
        roomId: chatRoom.roomId, 
        messagesBeforeCount: chatRoom.messages?.length || 0,
        hasMessagesArray: Array.isArray(chatRoom.messages)
      });
      
      // 메시지 배열이 없으면 생성
      if (!chatRoom.messages) {
        console.log('⚠️ [API] 채팅방에 messages 배열이 없어 새로 생성합니다.');
        chatRoom.messages = [];
      }
      
      // 각 메시지 추가 및 로깅
      for (const message of messages) {
        console.log(`🔄 [API] 메시지 추가: ID=${message.id}, 화자=${message.sender}`);
        chatRoom.messages.push(message);
      }
      
      // 채팅방 업데이트
      chatRoom.lastActivity = new Date();
      
      try {
        // 변경 사항 저장
        await chatRoom.save();
        console.log(`✅ [API] 채팅방 저장 완료. 최종 메시지 수: ${chatRoom.messages.length}`);
        
        // 저장 후 DB에서 다시 확인
        const updatedRoom = await ChatRoomModel.findOne({ roomId: chatRoom.roomId });
        if (updatedRoom) {
          console.log(`✅ [API] DB 확인 - 최종 메시지 수: ${updatedRoom.messages?.length || 0}`);
        }
        
        // Socket.IO가 초기화되어 있으면 메시지를 브로드캐스트
        if (res.socket?.server?.io) {
          console.log(`🔄 [API] Socket.IO를 통해 새 메시지 ${messages.length}개 브로드캐스트...`);
          
          // 각 메시지를 소켓을 통해 전송
          for (const message of messages) {
            console.log(`🔄 [API] Socket 이벤트 전송: new-message, 룸 ${roomId}, 화자 ${message.sender}`);
            res.socket.server.io.to(String(roomId)).emit('new-message', {
              roomId: String(roomId),
              message
            });
            
            // 약간의 딜레이를 둠 (메시지가 순서대로 도착하도록)
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          console.log(`✅ [API] Socket 브로드캐스트 완료`);
        } else {
          console.log(`⚠️ [API] Socket.IO 서버가 초기화되지 않아 실시간 업데이트를 보낼 수 없습니다.`);
        }
      } catch (saveError) {
        console.error(`❌ [API] 채팅방 저장 중 오류 발생:`, saveError);
        
        // 직접 MongoDB 수정 시도
        try {
          console.log(`🔄 [API] updateOne으로 메시지 직접 추가 시도...`);
          const updateResult = await db.collection('chatRooms').updateOne(
            { roomId: chatRoom.roomId },
            { 
              $push: { 'messages': { $each: messages } },
              $set: { lastActivity: new Date() }
            } as any // Type casting to avoid TypeScript error with MongoDB operators
          );
          console.log(`✅ [API] 직접 업데이트 결과:`, updateResult);
        } catch (directUpdateError) {
          console.error(`❌ [API] 직접 업데이트 중 오류:`, directUpdateError);
          throw saveError; // 원래 오류 다시 throw
        }
      }
      
      console.log(`✅ [API] ${messages.length}개의 자동 대화 메시지를 데이터베이스에 저장 완료`);
    } else {
      console.warn(`⚠️ [API] 생성된 대화 교환이 없습니다.`);
    }

    // 클라이언트에 응답
    console.log(`✅ [API] 클라이언트에 응답: ${messages.length}개 메시지`);
    return res.status(200).json({
      success: true,
      roomId,
      messages,
      topic: dialogueData.topic || topic,
      exchanges: dialogueData.exchanges || []
    });
  } catch (error) {
    console.error('❌ [API] 자동 대화 생성 오류:', error);
    return res.status(500).json({ 
      error: `자동 대화 생성 실패: ${error instanceof Error ? error.message : String(error)}` 
    });
  }
} 