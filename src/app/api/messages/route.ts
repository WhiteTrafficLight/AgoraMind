import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

// Define interfaces for our DB objects
interface DBMessage {
  id: string;
  text: string;
  sender: string;
  isUser: boolean;
  timestamp: Date;
  citations?: Citation[]; // Add citations field to match the rest of the app
}

// Add Citation interface to match other files
interface Citation {
  id: string;       // 각주 ID (예: "1", "2")
  text: string;     // 원문 텍스트
  source: string;   // 출처 (책 이름)
  location?: string; // 위치 정보 (선택사항)
}

interface DBChatRoom {
  roomId: number | string;
  title: string;
  messages: DBMessage[];
  lastActivity: string;
  updatedAt: Date;
  [key: string]: any; // Allow for other fields
}

// Create models for direct access
const chatRoomSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.Mixed, // Can be String or Number
    required: true
  },
  title: String,
  messages: [{
    id: String,
    text: String,
    sender: String,
    isUser: Boolean,
    timestamp: Date,
    citations: [{ // Add citations array to schema
      id: String,
      text: String,
      source: String,
      location: String
    }]
  }],
  lastActivity: String,
  updatedAt: Date
}, { strict: false }); // Allow other fields not defined in schema

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
    
    // Empty message validation - but be more lenient with initial messages
    if (!message.text.trim()) {
      console.error('❌ Empty message rejected');
      return NextResponse.json(
        { error: 'Empty messages are not allowed' },
        { status: 400 }
      );
    }
    
    // Welcome message validation - reject if it starts with "Welcome to"
    // But be lenient with initial messages that might need to start with a more conversational tone
    if (!isInitial && message.text.toLowerCase().trim().startsWith('welcome to')) {
      console.error('❌ Welcome message rejected');
      return NextResponse.json(
        { error: 'Welcome messages are not allowed' },
        { status: 400 }
      );
    }
    
    // Debate messages can come from "Moderator" or "System", so we only reject if sender is exactly "System"
    // and the message is not a debate-related message
    if (message.sender === 'System' && !message.role && !message.isSystemMessage) {
      console.error('❌ System message rejected');
      return NextResponse.json(
        { error: 'System messages are not allowed' },
        { status: 400 }
      );
    }
    
    console.log(`🔄 Saving message to room ${roomId}`);
    console.log(`Message: ${message.text.substring(0, 100)}${message.text.length > 100 ? '...' : ''}`);
    console.log(`Sender: ${message.sender}, isInitial: ${isInitial}`);

    // MongoDB 연결
    await connectDB();
    
    // Create models with collections we need
    const ChatRoomModel = mongoose.models.chatRooms || 
                       mongoose.model('chatRooms', chatRoomSchema, 'chatRooms');

    // 직접 chatRooms 컬렉션 사용 (Mongoose 모델 대신)
    // IMPORTANT: This matches how rooms API accesses the DB
    const possibleIds = [
      roomId,                         // Original (could be string or number)
      String(roomId),                 // String conversion
      !isNaN(Number(roomId)) ? Number(roomId) : null  // Number conversion if valid
    ].filter(Boolean); // Remove null values
    
    console.log(`🔍 Trying to find room with roomId (direct DB access): ${possibleIds.join(', ')}`);
    
    // Try to find the room with any of the possible ID formats
    let room: DBChatRoom | null = null;
    
    // Try each possible ID format
    for (const id of possibleIds) {
      const foundRoom = await ChatRoomModel.findOne({ roomId: id }).lean();
      if (foundRoom) {
        room = foundRoom as unknown as DBChatRoom;
        console.log(`✅ Found room with roomId ${id} using mongoose model`);
        break;
      }
    }
    
    // Alternative approach if collection name is different
    if (!room) {
      // Check directly in MongoDB if the collection exists
      if (mongoose.connection && mongoose.connection.db) {
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        console.log('Available collections:', collectionNames.join(', '));
        
        // Try alternative collections if chatRooms not found
        if (collectionNames.includes('chat_rooms')) {
          console.log('Trying chat_rooms collection...');
          for (const id of possibleIds) {
            const ChatRooms2 = mongoose.model('chat_rooms', chatRoomSchema, 'chat_rooms');
            const foundRoom = await ChatRooms2.findOne({ roomId: id }).lean();
            if (foundRoom) {
              room = foundRoom as unknown as DBChatRoom;
              console.log(`✅ Found room with roomId ${id} in chat_rooms collection`);
              break;
            }
          }
        }
      } else {
        console.log('Mongoose connection not fully established');
      }
    }
    
    // Still not found
    if (!room) {
      console.error(`❌ Chat room not found with any format of roomId: ${roomId}`);
      
      // List all available rooms for debugging
      let debugRooms;
      try {
        debugRooms = await ChatRoomModel.find({}).lean();
        console.log(`Available rooms: ${debugRooms.length}`);
        debugRooms.forEach((r: any) => console.log(`Room ID: ${r.roomId}, Title: ${r.title}`));
      } catch (err) {
        console.error('Error listing rooms:', err);
      }
      
      return NextResponse.json({ error: 'Chat room not found' }, { status: 404 });
    }

    // 메시지 필드가 없으면 초기화
    if (!room.messages) {
      room.messages = [];
      console.log('Initialized empty messages array for room');
    }

    // 메시지 ID 중복 확인
    const isDuplicate = room.messages.some((msg: DBMessage) => msg.id === message.id);
    if (isDuplicate) {
      console.log(`⚠️ Duplicate message ID detected: ${message.id}, skipping save`);
      return NextResponse.json({ 
        success: true, 
        message: 'Message already exists, no changes made'
      });
    }

    // 타임스탬프 처리 (문자열이면 Date 객체로 변환)
    const timestamp = typeof message.timestamp === 'string' 
      ? new Date(message.timestamp) 
      : message.timestamp;

    // 메시지 객체 구성
    const newMessage: DBMessage = {
      id: message.id,
      text: message.text,
      sender: message.sender,
      isUser: message.isUser,
      timestamp
    };
    
    // 인용 정보가 있으면 포함
    if (message.citations && Array.isArray(message.citations) && message.citations.length > 0) {
      console.log('📚 Citations data found:', JSON.stringify(message.citations));
      newMessage.citations = message.citations;
    }

    // isInitial 플래그가 true이면 기존 메시지 삭제 (welcome 메시지 교체)
    if (isInitial) {
      // 초기 메시지 전 처리 로그
      console.log(`Before initial message processing, room has ${room.messages.length} messages`);
      
      // Welcome 메시지 제거 (System 메시지 또는 이전 철학자 메시지)
      const originalCount = room.messages.length;
      room.messages = room.messages.filter((msg: DBMessage) => {
        // System 메시지 제거
        if (msg.sender === 'System') {
          console.log('Removing System message');
          return false;
        }
        
        // "Welcome to" 시작하는 메시지 제거
        if (msg.text && msg.text.toLowerCase().startsWith('welcome to')) {
          console.log('Removing message starting with "Welcome to"');
          return false;
        }
        
        // 첫 메시지가 NPC 메시지이면서 isUser가 false인 경우 제거
        if (room.messages.indexOf(msg) === 0 && !msg.isUser) {
          console.log('Removing first NPC message (non-user)');
          return false;
        }
        
        return true;
      });
      
      // 필터링 결과 로그
      console.log(`Removed ${originalCount - room.messages.length} messages during initial message processing`);
    }

    // 메시지 추가 및 마지막 활동 시간 업데이트
    room.messages.push(newMessage);
    room.lastActivity = new Date().toISOString();
    room.updatedAt = new Date();
    
    console.log(`Added new message from ${newMessage.sender}, room now has ${room.messages.length} messages`);

    // 저장 - Mongoose 업데이트
    try {
      const updateResult = await ChatRoomModel.updateOne(
        { roomId: room.roomId },
        { 
          $set: { 
            messages: room.messages,
            lastActivity: room.lastActivity,
            updatedAt: room.updatedAt
          } 
        }
      );
      
      console.log(`MongoDB update result: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`);
      
      if (updateResult.matchedCount === 0) {
        console.warn('⚠️ No documents matched the update query');
      }
    } catch (dbError) {
      console.error('❌ MongoDB update error:', dbError);
      throw dbError;
    }
    
    console.log(`✅ Message saved to room ${roomId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Message saved successfully'
    });
  } catch (error) {
    console.error('❌ Error processing message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 