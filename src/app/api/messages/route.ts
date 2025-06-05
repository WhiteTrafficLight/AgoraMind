import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

// Define interfaces for our DB objects
interface DBMessage {
  messageId: string;     // 메시지 고유 ID
  roomId: string;        // 방 ID (문자열)
  text: string;
  sender: string;
  isUser: boolean;
  timestamp: Date;
  role?: string;         // 토론에서 역할 (pro, con, moderator)
  senderType?: string;   // 발신자 타입 (npc, user, moderator)
  stage?: string;        // 토론 단계 (opening, pro_argument, etc.)
  citations?: Citation[]; // Add citations field to match the rest of the app
}

// Add Citation interface to match other files
interface Citation {
  id: string;       // 각주 ID (예: "1", "2")
  text: string;     // 원문 텍스트
  source: string;   // 출처 (책 이름)
  location?: string; // 위치 정보 (선택사항)
}

// chatMessages 컬렉션 스키마 (개별 메시지)
const chatMessageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  roomId: {
    type: String,  // Number → String으로 변경
    required: true,
    index: true  // 방별 조회를 위한 인덱스
  },
  text: {
    type: String,
    required: true
  },
  sender: {
    type: String,
    required: true
  },
  isUser: {
    type: Boolean,
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true  // 시간순 정렬을 위한 인덱스
  },
  role: String,        // 토론에서 역할
  senderType: String,  // 발신자 타입 
  stage: String,       // 토론 단계
  citations: [{
    id: String,
    text: String,
    source: String,
    location: String
  }]
}, { 
  timestamps: true  // createdAt, updatedAt 자동 추가
});

// 방별, 시간순 조회를 위한 복합 인덱스
chatMessageSchema.index({ roomId: 1, timestamp: 1 });

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');
    const action = searchParams.get('action');
    
    if (action !== 'getMessages') {
      return NextResponse.json(
        { error: 'Invalid action. Use action=getMessages' },
        { status: 400 }
      );
    }
    
    if (!roomId) {
      return NextResponse.json(
        { error: 'Missing required parameter: roomId' },
        { status: 400 }
      );
    }
    
    // roomId를 문자열로 정규화
    const normalizedRoomId = String(roomId).trim();
    if (!normalizedRoomId) {
      return NextResponse.json(
        { error: 'Invalid roomId format' },
        { status: 400 }
      );
    }
    
    console.log(`🔍 [GET] Loading messages for room "${normalizedRoomId}"`);
    
    // MongoDB 연결
    await connectDB();
    
    // chatMessages 컬렉션 모델 생성
    const ChatMessageModel = mongoose.models.chatMessages || 
                           mongoose.model('chatMessages', chatMessageSchema, 'chatMessages');
    
    // 해당 방의 메시지들을 시간순으로 조회
    const messages = await ChatMessageModel.find({ roomId: normalizedRoomId })
      .sort({ timestamp: 1 })  // 시간순 정렬
      .lean();  // 성능 최적화
    
    console.log(`✅ [GET] Found ${messages.length} messages for room "${normalizedRoomId}"`);
    
    return NextResponse.json({
      success: true,
      messages: messages,
      count: messages.length
    });
    
  } catch (error) {
    console.error('❌ [GET] Error loading messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('🔄 Processing message POST request');
    
    // 요청 바디 파싱
    const body = await req.json();
    const { roomId, message, isInitial = false } = body;
    
    console.log(`Message details - RoomID: ${roomId}, IsInitial: ${isInitial}`);
    console.log(`Sender: ${message?.sender}, Length: ${message?.text?.length || 0}`);
    
    // 유효성 검사 - 필수 필드 확인
    if (!roomId) {
      console.error('❌ Missing required field: roomId');
      return NextResponse.json(
        { error: 'Missing required field: roomId' },
        { status: 400 }
      );
    }
    
    if (!message || !message.text || !message.sender) {
      console.error('❌ Missing required message fields:', message);
      return NextResponse.json(
        { error: 'Message must include text and sender' },
        { status: 400 }
      );
    }
    
    // Empty message validation
    if (!message.text.trim()) {
      console.error('❌ Empty message rejected');
      return NextResponse.json(
        { error: 'Empty messages are not allowed' },
        { status: 400 }
      );
    }

    // MongoDB 연결
    await connectDB();
    
    // 디버깅: 실제 DB 연결 상태 확인
    console.log('🔍 [DEBUG] MongoDB 연결 상태:');
    console.log('🔍 [DEBUG] - DB Name:', mongoose.connection.db?.databaseName);
    console.log('🔍 [DEBUG] - Connection State:', mongoose.connection.readyState);
    
    // chatMessages 컬렉션 모델 생성
    const ChatMessageModel = mongoose.models.chatMessages || 
                           mongoose.model('chatMessages', chatMessageSchema, 'chatMessages');

    // 컬렉션 목록 확인
    if (mongoose.connection && mongoose.connection.db) {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      console.log('🔍 [DEBUG] 사용 가능한 컬렉션들:', collectionNames.join(', '));
    }

    // roomId를 문자열로 정규화
    const normalizedRoomId = String(roomId).trim();
    if (!normalizedRoomId) {
      console.error('❌ Invalid roomId format:', roomId);
      return NextResponse.json(
        { error: 'Invalid roomId format' },
        { status: 400 }
      );
    }

    // 중복 메시지 확인
    const existingMessage = await ChatMessageModel.findOne({ messageId: message.id });
    if (existingMessage) {
      console.log(`⚠️ Duplicate message ID detected: ${message.id}, skipping save`);
      return NextResponse.json({ 
        success: true, 
        message: 'Message already exists, no changes made'
      });
    }

    // 타임스탬프 처리
    const timestamp = typeof message.timestamp === 'string' 
      ? new Date(message.timestamp) 
      : (message.timestamp || new Date());

    // 새로운 메시지 객체 구성
    const newMessage: DBMessage = {
      messageId: message.id,
      roomId: normalizedRoomId,
      text: message.text,
      sender: message.sender,
      isUser: message.isUser,
      timestamp,
      role: message.role,           // 토론 역할
      senderType: message.senderType, // 발신자 타입  
      stage: message.stage          // 토론 단계
    };
    
    // 인용 정보가 있으면 포함
    if (message.citations && Array.isArray(message.citations) && message.citations.length > 0) {
      console.log('📚 Citations data found:', JSON.stringify(message.citations));
      newMessage.citations = message.citations;
    }
    
    // 디버깅: 저장할 메시지 내용 확인
    console.log('🔍 [DEBUG] 저장할 메시지 객체:');
    console.log('🔍 [DEBUG] - MessageID:', newMessage.messageId);
    console.log('🔍 [DEBUG] - RoomID:', newMessage.roomId);
    console.log('🔍 [DEBUG] - Sender:', newMessage.sender);
    console.log('🔍 [DEBUG] - Role:', newMessage.role);
    console.log('🔍 [DEBUG] - SenderType:', newMessage.senderType);
    console.log('🔍 [DEBUG] - Stage:', newMessage.stage);

    // chatMessages 컬렉션에 개별 메시지로 저장
    try {
      const savedMessage = await ChatMessageModel.create(newMessage);
      console.log(`✅ Message saved to chatMessages collection with _id: ${savedMessage._id}`);
      
      // 저장 후 즉시 확인
      console.log('🔍 [VERIFY] 저장 후 즉시 DB에서 확인 중...');
      const verifyMessage = await ChatMessageModel.findOne({ messageId: message.id });
      if (verifyMessage) {
        console.log('🔍 [VERIFY] ✅ 메시지 저장 확인됨');
        console.log('🔍 [VERIFY] - _id:', verifyMessage._id);
        console.log('🔍 [VERIFY] - messageId:', verifyMessage.messageId);
        console.log('🔍 [VERIFY] - roomId:', verifyMessage.roomId);
        console.log('🔍 [VERIFY] - role:', verifyMessage.role);
        console.log('🔍 [VERIFY] - senderType:', verifyMessage.senderType);
        console.log('🔍 [VERIFY] - stage:', verifyMessage.stage);
      } else {
        console.error('❌ [VERIFY] 저장 후 메시지를 찾을 수 없음!');
      }
      
      // 해당 방의 총 메시지 수 확인
      const totalMessages = await ChatMessageModel.countDocuments({ roomId: normalizedRoomId });
      console.log(`📊 방 "${normalizedRoomId}"의 총 메시지 수: ${totalMessages}개`);
      
    } catch (dbError) {
      console.error('❌ chatMessages 저장 오류:', dbError);
      throw dbError;
    }
    
    console.log(`✅ Message saved to chatMessages collection for room "${normalizedRoomId}"`);

    return NextResponse.json({ 
      success: true, 
      message: 'Message saved successfully to chatMessages collection'
    });
    
  } catch (error) {
    console.error('❌ Error processing message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 