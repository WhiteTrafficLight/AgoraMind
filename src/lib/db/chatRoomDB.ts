import { ObjectId } from 'mongodb';
import clientPromise from './mongodb';
import { ChatRoom, ChatMessage } from '@/lib/ai/chatService';

// DB에 저장되는 채팅룸 타입 (MongoDB 호환)
export interface DBChatRoom {
  _id?: ObjectId;
  roomId: string;
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
  // 찬반토론을 위한 필드 추가
  pro?: string[]; // 찬성측 참여자들 (NPC IDs와 사용자)
  con?: string[]; // 반대측 참여자들 (NPC IDs와 사용자)
  neutral?: string[]; // 중립 참여자들 (NPC IDs와 사용자)
  moderator?: {
    style_id?: string;
    style?: string;
  }; // 모더레이터 스타일 정보
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
  roomId: string;
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
  async getChatRoomById(id: string): Promise<ChatRoom | null> {
    try {
      if (!id) {
        console.error('getChatRoomById: Null or undefined ID provided');
        return null;
      }
      
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB || 'agoramind');
      
      // ID를 문자열로 변환 (공백 제거)
      const roomId = String(id).trim();
      console.log(`DB 조회: ID ${id} (${typeof id})를 문자열 "${roomId}"로 변환하여 쿼리`);
      
      // 빈 문자열 검증
      if (!roomId) {
        console.error(`DB 조회: 빈 ID 문자열 "${roomId}"`);
        return null;
      }
      
      // DB에서 쿼리 수행
      console.log(`DB 쿼리: { roomId: "${roomId}" }`);
      const room = await db.collection<DBChatRoom>('chatRooms').findOne({ roomId });
      
      if (!room) {
        console.log(`검색 결과: 없음 (ID "${roomId}")`);
        return null;
      }
      
      console.log(`DB에서 룸 찾음: ID "${room.roomId}" (타입: 문자열)`);
      
      // 이 채팅룸의 메시지들 가져오기
      const messages = await db.collection<DBChatMessage>('chatMessages')
        .find({ roomId })
        .sort({ timestamp: 1 })
        .toArray();
      
      const transformedRoom = this.transformRoomFromDB(room, messages);
      
      // ID가 문자열임을 보장
      transformedRoom.id = String(transformedRoom.id);
      console.log(`DB 조회 결과: 룸 변환 완료, ID "${transformedRoom.id}" (${typeof transformedRoom.id})`);
      
      return transformedRoom;
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
      
      // room.id가 이미 설정되어 있으면 그것을 사용, 없으면 자동 생성
      let roomId: string;
      
      if (room.id) {
        // 파이썬 백엔드에서 제공된 room_id 사용
        roomId = String(room.id).trim();
        console.log(`제공된 room_id 사용: "${roomId}"`);
      } else {
        // 자동 증가 ID 구현 - 문자열 타입으로 변경
        let nextNumber = 1;
        
        try {
          // 기존 숫자 패턴의 최대 ID 찾기 (기존 데이터 호환성을 위해)
          const existingRooms = await db.collection<DBChatRoom>('chatRooms')
            .find({})
            .toArray();
          
          // 숫자 형태의 ID들 중 최대값 찾기
          const numericIds = existingRooms
            .map(r => r.roomId)
            .filter(id => /^\d+$/.test(id)) // 순수 숫자만
            .map(id => parseInt(id))
            .filter(num => !isNaN(num));
          
          if (numericIds.length > 0) {
            nextNumber = Math.max(...numericIds) + 1;
            console.log(`최대 숫자 ID 기반으로 새 ID 생성: ${nextNumber}`);
          } else {
            console.log(`숫자 ID가 없어 첫 ID 생성: ${nextNumber}`);
          }
          
          roomId = String(nextNumber);
            
          try {
            // 카운터 컬렉션을 별도로 정의하여 타입 문제 해결
            interface CounterDoc {
              _id: string;
              seq: number;
            }
            
            // 타입을 명시적으로 지정하여 타입 오류 해결
            const countersCollection = db.collection<CounterDoc>('counters');
            await countersCollection.findOneAndUpdate(
                { _id: 'roomId' },
              { $set: { seq: nextNumber } },
              { upsert: true }
              );
            console.log(`카운터를 안전하게 업데이트/생성: ${nextNumber}`);
        } catch (counterError) {
            // 카운터 오류는 무시 - ID 생성 로직은 이미 완료됨
            console.warn('카운터 업데이트 중 오류 (무시됨):', counterError);
          }
        } catch (idGenerationError) {
          console.error('ID 생성 오류:', idGenerationError);
          
          // 극단적인 오류 상황에서는 타임스탬프 기반 ID 사용
          roomId = `ROOM_${Date.now()}`;
          console.log(`타임스탬프 기반 대체 ID 생성: "${roomId}"`);
        }
      }
      
      console.log(`새 채팅방에 할당된 ID: "${roomId}"`);
      
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
      
      // 찬반토론 필드 추가 (있는 경우만)
      if (room.pro) dbRoom.pro = room.pro;
      if (room.con) dbRoom.con = room.con;
      if (room.neutral) dbRoom.neutral = room.neutral;
      
      // 모더레이터 정보 추가 (있는 경우만)
      if (room.moderator) dbRoom.moderator = room.moderator;
      
      console.log(`💾 DB 저장 전 채팅방 데이터: ${JSON.stringify({ roomId, title: room.title, dialogueType: room.dialogueType })}`);
      
      if (room.dialogueType === 'debate') {
        console.log(`💾 찬반토론 모드 감지: dialogueType=${room.dialogueType}`);
        console.log(`💾 기존 pro, con, neutral 필드 사용`);
        if (room.pro) console.log(`💾 Pro: ${room.pro.join(', ')}`);
        if (room.con) console.log(`💾 Con: ${room.con.join(', ')}`);
        if (room.neutral) console.log(`💾 Neutral: ${room.neutral.join(', ')}`);
      }

      // 중복 체크를 위해 먼저 해당 roomId로 기존 방이 있는지 확인
      const existingRoom = await db.collection<DBChatRoom>('chatRooms').findOne({ roomId });
      if (existingRoom) {
        console.warn(`경고: roomId "${roomId}"가 이미 존재합니다. 기존 방을 반환합니다.`);
        return this.transformRoomFromDB(existingRoom, []);
      }

      const result = await db.collection<DBChatRoom>('chatRooms').insertOne(dbRoom);
      console.log(`💾 채팅룸이 ID "${roomId}"로 저장됨, dialogueType: ${room.dialogueType}`);

      // 방금 생성된 채팅룸 반환
      const createdRoom = await db.collection<DBChatRoom>('chatRooms').findOne({ roomId });
      if (!createdRoom) {
        throw new Error('Failed to create chat room');
      }

      return this.transformRoomFromDB(createdRoom, []);
    } catch (error) {
      console.error('Database error in createChatRoom:', error);
      throw error;
    }
  }

  // 메시지 추가
  async addMessage(roomId: string, message: ChatMessage): Promise<boolean> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB || 'agoramind');
      
      // ID를 문자열로 변환
      const normalizedRoomId = String(roomId).trim();
      console.log(`메시지 저장: ID ${roomId}를 문자열 "${normalizedRoomId}"로 변환`);
      
      // 빈 문자열 검증
      if (!normalizedRoomId) {
        console.error(`메시지 저장: 유효하지 않은 채팅방 ID: ${roomId}`);
        return false;
      }
      
      // 채팅룸 존재 확인
      const room = await db.collection<DBChatRoom>('chatRooms').findOne({ roomId: normalizedRoomId });
      
      if (!room) {
        console.error(`채팅룸 "${normalizedRoomId}" 메시지 추가 실패: 룸 없음`);
        return false;
      }
      
      // 메시지 객체 생성
      const dbMessage: DBChatMessage = {
        messageId: message.id,
        roomId: normalizedRoomId,
        text: message.text,
        sender: message.sender,
        isUser: message.isUser,
        timestamp: new Date(message.timestamp),
        createdAt: new Date(),
        citations: message.citations
      };
      
      // 메시지 저장
      await db.collection<DBChatMessage>('chatMessages').insertOne(dbMessage);
      
      // 채팅룸 마지막 활동 시간 업데이트
      await db.collection<DBChatRoom>('chatRooms').updateOne(
        { roomId: normalizedRoomId },
        { 
          $set: { 
            lastActivity: 'Just now',
            updatedAt: new Date()
          }
        }
      );
      
      return true;
    } catch (error) {
      console.error(`메시지 추가 실패 (room ${roomId}):`, error);
      return false;
    }
  }

  // 채팅룸 정보 업데이트
  async updateChatRoom(roomId: string, updates: Partial<ChatRoom>): Promise<boolean> {
    try {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB || 'agoramind');
      
      // ID를 문자열로 변환
      const normalizedRoomId = String(roomId).trim();
      
      // 업데이트할 필드 구성
      const updateFields: Partial<DBChatRoom> = {};
      
      if (updates.title) updateFields.title = updates.title;
      if (updates.context) updateFields.context = updates.context;
      if (updates.participants) updateFields.participants = updates.participants;
      if (updates.isPublic !== undefined) updateFields.isPublic = updates.isPublic;
      
      // 항상 업데이트 시간 갱신
      updateFields.updatedAt = new Date();
      
      const result = await db.collection<DBChatRoom>('chatRooms').updateOne(
        { roomId: normalizedRoomId },
        { $set: updateFields }
      );
      
      return result.matchedCount > 0;
    } catch (error) {
      console.error(`채팅룸 업데이트 실패 (room ${roomId}):`, error);
      return false;
    }
  }

  // DB 형식에서 앱 형식으로 변환
  private transformRoomsFromDB(dbRooms: DBChatRoom[]): ChatRoom[] {
    return dbRooms.map(room => ({
      id: room.roomId, // roomId를 그대로 문자열로 사용
      title: room.title,
      context: room.context,
      participants: room.participants,
      totalParticipants: room.totalParticipants,
      lastActivity: room.lastActivity,
      isPublic: room.isPublic,
      dialogueType: room.dialogueType || 'free', // Add dialogueType with default of 'free'
      pro: room.pro, // 찬성측 참여자
      con: room.con, // 반대측 참여자
      neutral: room.neutral, // 중립 참여자
      moderator: room.moderator, // 모더레이터 정보 추가
      messages: [] // 모든 룸의 메시지를 로드하지 않음 (필요할 때만 로드)
    }));
  }

  // DB 형식에서 앱 형식으로 변환 (메시지 포함)
  private transformRoomFromDB(dbRoom: DBChatRoom, dbMessages: DBChatMessage[]): ChatRoom {
    return {
      id: dbRoom.roomId, // roomId를 그대로 문자열로 사용
      title: dbRoom.title,
      context: dbRoom.context,
      participants: dbRoom.participants,
      totalParticipants: dbRoom.totalParticipants || 0,
      lastActivity: dbRoom.lastActivity || 'Unknown',
      isPublic: typeof dbRoom.isPublic === 'boolean' ? dbRoom.isPublic : true,
      dialogueType: dbRoom.dialogueType || 'free', // 대화 패턴 타입 추가
      pro: dbRoom.pro, // 찬성측 참여자
      con: dbRoom.con, // 반대측 참여자
      neutral: dbRoom.neutral, // 중립 참여자
      moderator: dbRoom.moderator, // 모더레이터 정보 추가
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