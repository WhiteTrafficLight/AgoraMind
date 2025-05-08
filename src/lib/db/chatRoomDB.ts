import { ObjectId } from 'mongodb';
import clientPromise from './mongodb';
import { ChatRoom, ChatMessage } from '@/lib/ai/chatService';

// DB에 저장되는 채팅룸 타입 (MongoDB 호환)
export interface DBChatRoom {
  _id?: ObjectId;
  roomId: number;
  title: string;
  context?: string;
  participants: {
    users: string[];
    npcs: string[];
  };
  totalParticipants: number;
  lastActivity: string;
  isPublic: boolean;
  dialogueType?: string; // 대화 패턴 타입 추가
  createdAt: Date;
  updatedAt: Date;
}

// 각주 인용 정보를 위한 인터페이스 추가
export interface Citation {
  id: string;       // 각주 ID (예: "1", "2")
  text: string;     // 원문 텍스트
  source: string;   // 출처 (책 이름)
  location?: string; // 위치 정보 (선택사항)
}

// DB에 저장되는 채팅 메시지 타입
export interface DBChatMessage {
  _id?: ObjectId;
  messageId: string;
  roomId: number;
  text: string;
  sender: string;
  isUser: boolean;
  timestamp: Date;
  createdAt: Date;
  citations?: Citation[]; // 인용 정보 배열 추가
}

// 채팅룸 DB 접근 클래스
class ChatRoomDB {
  // 모든 채팅룸 가져오기
  async getAllChatRooms(): Promise<ChatRoom[]> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB || 'agoramind');
      
      const rooms = await db.collection<DBChatRoom>('chatRooms')
        .find({})
        .sort({ updatedAt: -1 })
        .toArray();

      const roomsFromDB = this.transformRoomsFromDB(rooms);
      
      // 중복 ID 방지를 위해 ID별로 유니크한 채팅방만 반환
      const uniqueIdMap = new Map<string, ChatRoom>();
      
      for (const room of roomsFromDB) {
        const idKey = String(room.id);
        // Map에 없는 경우만 추가 (이미 있으면 중복으로 건너뜀)
        if (!uniqueIdMap.has(idKey)) {
          uniqueIdMap.set(idKey, room);
        }
      }
      
      return Array.from(uniqueIdMap.values());
    } catch (error) {
      console.error('Database error in getAllChatRooms:', error);
      throw error;
    }
  }

  // ID로 채팅룸 가져오기
  async getChatRoomById(id: string | number): Promise<ChatRoom | null> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB || 'agoramind');
      
      const roomId = typeof id === 'string' ? parseInt(id) : id;
      const room = await db.collection<DBChatRoom>('chatRooms').findOne({ roomId });
      
      if (!room) return null;
      
      // 이 채팅룸의 메시지들 가져오기
      const messages = await db.collection<DBChatMessage>('chatMessages')
        .find({ roomId })
        .sort({ timestamp: 1 })
        .toArray();
      
      return this.transformRoomFromDB(room, messages);
    } catch (error) {
      console.error(`Database error in getChatRoomById(${id}):`, error);
      throw error;
    }
  }

  // 새 채팅룸 생성
  async createChatRoom(room: ChatRoom): Promise<ChatRoom> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB || 'agoramind');
      
      // 자동 증가 ID 구현 - 수정된 부분
      let roomId = 1;
      
      try {
        // 기존 카운터를 먼저 확인
        const counterDoc = await db.collection('counters').findOne({ _id: 'roomId' });
        
        if (counterDoc) {
          // 카운터가 있으면 증가시키기
          const updatedCounter = await db.collection('counters').findOneAndUpdate(
            { _id: 'roomId' },
            { $inc: { seq: 1 } },
            { returnDocument: 'after' }
          );
          
          if (updatedCounter.value) {
            roomId = updatedCounter.value.seq;
            console.log(`카운터 증가됨: ${roomId}`);
          } else {
            // 업데이트된 값이 없으면 새로 생성
            await db.collection('counters').insertOne({ _id: 'roomId', seq: 1 });
            console.log('카운터 초기화: 1');
          }
        } else {
          // 카운터가 없으면 생성
          await db.collection('counters').insertOne({ _id: 'roomId', seq: 1 });
          console.log('카운터 생성: 1');
        }
        
        // 이미 해당 ID의 채팅방이 있는지 확인
        const existingRoom = await db.collection<DBChatRoom>('chatRooms').findOne({ roomId });
        if (existingRoom) {
          // 충돌 발생 - 최대 ID + 1 사용
          const maxIdRoom = await db.collection<DBChatRoom>('chatRooms')
            .find({})
            .sort({ roomId: -1 })
            .limit(1)
            .toArray();
          
          if (maxIdRoom.length > 0 && maxIdRoom[0].roomId) {
            roomId = maxIdRoom[0].roomId + 1;
            
            // 카운터도 업데이트
            await db.collection('counters').updateOne(
              { _id: 'roomId' },
              { $set: { seq: roomId } }
            );
            
            console.log(`ID 충돌 해결: 새 ID = ${roomId}`);
          }
        }
      } catch (counterError) {
        console.error('카운터 생성 실패:', counterError);
        
        // 카운터 실패 시 최대 ID + 1 사용
        try {
          const maxIdRoom = await db.collection<DBChatRoom>('chatRooms')
            .find({})
            .sort({ roomId: -1 })
            .limit(1)
            .toArray();
          
          if (maxIdRoom.length > 0 && maxIdRoom[0].roomId) {
            roomId = maxIdRoom[0].roomId + 1;
            console.log(`최대 ID 기반 생성: ${roomId}`);
          }
        } catch (maxIdError) {
          console.error('최대 ID 조회 실패:', maxIdError);
          // 기본값 유지 (roomId = 1)
        }
      }
      
      console.log(`새 채팅방에 할당된 ID: ${roomId}`);
      
      // DB에 저장할 채팅룸 객체 변환
      const dbRoom: DBChatRoom = {
        roomId,
        title: room.title,
        context: room.context,
        participants: room.participants,
        totalParticipants: room.totalParticipants,
        lastActivity: room.lastActivity,
        isPublic: room.isPublic,
        dialogueType: room.dialogueType || 'free', // 대화 패턴 타입 추가, 기본값은 자유토론
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // 채팅룸 저장
      await db.collection('chatRooms').insertOne(dbRoom);
      
      // 초기 메시지가 있으면 저장
      if (room.messages && room.messages.length > 0) {
        const dbMessages = room.messages.map(msg => ({
          messageId: msg.id,
          roomId,
          text: msg.text,
          sender: msg.sender,
          isUser: msg.isUser,
          timestamp: new Date(msg.timestamp),
          createdAt: new Date()
        }));
        
        await db.collection('chatMessages').insertMany(dbMessages);
      }
      
      // ID가 포함된 완성된 채팅룸 반환
      return {
        ...room,
        id: roomId
      };
    } catch (error) {
      console.error('Database error in createChatRoom:', error);
      throw error;
    }
  }

  // 메시지 추가
  async addMessage(roomId: string | number, message: ChatMessage): Promise<boolean> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB || 'agoramind');
      
      const numericRoomId = typeof roomId === 'string' ? parseInt(roomId) : roomId;
      
      // 채팅룸 존재 여부 확인
      const room = await db.collection<DBChatRoom>('chatRooms').findOne({ roomId: numericRoomId });
      if (!room) {
        console.error(`Room not found: ${roomId}`);
        return false;
      }
      
      // 중복 메시지 체크
      const existingMessage = await db.collection<DBChatMessage>('chatMessages').findOne({
        messageId: message.id,
        roomId: numericRoomId
      });
      
      if (existingMessage) {
        console.log(`Duplicate message: ${message.id}`);
        return false;
      }
      
      console.log("📝 저장할 메시지 객체:", message); 
      
      // 인용 정보 확인 및 로깅
      if (message.citations) {
        console.log("📚 저장할 인용 정보:", JSON.stringify(message.citations));
      } else {
        console.log("⚠️ 인용 정보 없음");
      }
      
      // 메시지 저장 - citations 필드 처리 개선
      const dbMessage: DBChatMessage = {
        messageId: message.id,
        roomId: numericRoomId,
        text: message.text,
        sender: message.sender,
        isUser: message.isUser,
        timestamp: new Date(message.timestamp),
        createdAt: new Date()
      };
      
      // citations 필드가 있고 배열인 경우에만 포함
      if (message.citations && Array.isArray(message.citations)) {
        // 명시적으로 필요한 필드만 복사하여 타입 안전성 보장
        dbMessage.citations = message.citations.map(citation => ({
          id: citation.id,
          source: citation.source,
          text: citation.text,
          location: citation.location
        }));
        console.log("📚 인용 정보를 DB에 저장합니다:", JSON.stringify(dbMessage.citations));
      }
      
      console.log("📝 DB에 저장할 최종 메시지:", JSON.stringify(dbMessage));
      
      // 메시지 저장 전 최종 확인
      if (!dbMessage.messageId || !dbMessage.text) {
        console.error("❌ 필수 필드 누락 - 메시지 저장 실패");
        return false;
      }
      
      await db.collection('chatMessages').insertOne(dbMessage);
      
      // 채팅룸 최종 활동 시간 업데이트
      await db.collection('chatRooms').updateOne(
        { roomId: numericRoomId },
        { 
          $set: { 
            lastActivity: 'Just now',
            updatedAt: new Date()
          }
        }
      );
      
      return true;
    } catch (error) {
      console.error(`Database error in addMessage(${roomId}):`, error);
      return false;
    }
  }

  // 채팅룸 정보 업데이트
  async updateChatRoom(roomId: string | number, updates: Partial<ChatRoom>): Promise<boolean> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB || 'agoramind');
      
      const numericRoomId = typeof roomId === 'string' ? parseInt(roomId) : roomId;
      
      // 필요한 필드만 업데이트 (MongoDB 문서 형식으로 변환)
      const updateFields: Record<string, any> = {};
      
      if (updates.title) updateFields.title = updates.title;
      if (updates.context) updateFields.context = updates.context;
      if (updates.participants) updateFields.participants = updates.participants;
      if (updates.totalParticipants) updateFields.totalParticipants = updates.totalParticipants;
      if (updates.isPublic !== undefined) updateFields.isPublic = updates.isPublic;
      
      // 업데이트 시간 추가
      updateFields.updatedAt = new Date();
      
      const result = await db.collection('chatRooms').updateOne(
        { roomId: numericRoomId },
        { $set: updateFields }
      );
      
      return result.modifiedCount > 0;
    } catch (error) {
      console.error(`Database error in updateChatRoom(${roomId}):`, error);
      return false;
    }
  }

  // DB 형식에서 앱 형식으로 변환
  private transformRoomsFromDB(dbRooms: DBChatRoom[]): ChatRoom[] {
    return dbRooms.map(room => ({
      id: room.roomId,
      title: room.title,
      context: room.context,
      participants: room.participants,
      totalParticipants: room.totalParticipants,
      lastActivity: room.lastActivity,
      isPublic: room.isPublic,
      messages: [] // 모든 룸의 메시지를 로드하지 않음 (필요할 때만 로드)
    }));
  }

  // DB 형식에서 앱 형식으로 변환 (메시지 포함)
  private transformRoomFromDB(dbRoom: DBChatRoom, dbMessages: DBChatMessage[]): ChatRoom {
    return {
      id: dbRoom.roomId,
      title: dbRoom.title,
      context: dbRoom.context,
      participants: dbRoom.participants,
      totalParticipants: dbRoom.totalParticipants || 0,
      lastActivity: dbRoom.lastActivity || 'Unknown',
      isPublic: typeof dbRoom.isPublic === 'boolean' ? dbRoom.isPublic : true,
      dialogueType: dbRoom.dialogueType || 'free', // 대화 패턴 타입 추가
      messages: dbMessages.map(msg => ({
        id: msg.messageId,
        text: msg.text,
        sender: msg.sender,
        isUser: msg.isUser,
        timestamp: msg.timestamp,
        citations: msg.citations // 인용 정보 추가
      }))
    };
  }
}

// 싱글톤 인스턴스 생성
const chatRoomDB = new ChatRoomDB();
export default chatRoomDB; 