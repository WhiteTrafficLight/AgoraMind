import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { loggers } from '@/utils/logger';

// Define interfaces  our DB objects
interface DBMessage {
  messageId: string;
  roomId: string;
  text: string;
  sender: string;
  isUser: boolean;
  timestamp: Date;
  role?: string;  // (pro, con, moderator)
  senderType?: string;  // (npc, user, moderator)
  stage?: string;  // (opening, pro_argument, etc.)
  citations?: Citation[]; // Add citations field to match the rest of the app
}

// Add Citation interface to match other files
interface Citation {
  id: string;
  text: string;
  source: string;
  location?: string;
}

// chatMessages ( )
const chatMessageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  roomId: {
    type: String,  // Number → String
    required: true,
    index: true
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
    index: true
  },
  role: String,
  senderType: String,
  stage: String,
  citations: [{
    id: String,
    text: String,
    source: String,
    location: String
  }]
}, { 
  timestamps: true  // createdAt, updatedAt
});

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
    
    // roomId
    const normalizedRoomId = String(roomId).trim();
    if (!normalizedRoomId) {
      return NextResponse.json(
        { error: 'Invalid roomId format' },
        { status: 400 }
      );
    }
    
    loggers.chat.info(`🔍 [GET] Loading messages  room "${normalizedRoomId}"`);
    
    await connectDB();
    
    // chatMessages
    const ChatMessageModel = mongoose.models.chatMessages || 
                           mongoose.model('chatMessages', chatMessageSchema, 'chatMessages');
    
    const messages = await ChatMessageModel.find({ roomId: normalizedRoomId })
      .sort({ timestamp: 1 })
      .lean();
    
    loggers.chat.info(`✅ [GET] Found ${messages.length} messages  room "${normalizedRoomId}"`);
    
    return NextResponse.json({
      success: true,
      messages: messages,
      count: messages.length
    });
    
  } catch (error) {
    loggers.chat.error('❌ [GET] Error loading messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    loggers.chat.info('🔄 Processing message POST request');
    
    const body = await req.json();
    const { roomId, message, isInitial = false } = body;
    
    loggers.chat.info(`Message details - RoomID: ${roomId}, IsInitial: ${isInitial}`);
    loggers.chat.info(`Sender: ${message?.sender}, Length: ${message?.text?.length || 0}`);
    
    if (!roomId) {
      loggers.chat.error('❌ Missing required field: roomId');
      return NextResponse.json(
        { error: 'Missing required field: roomId' },
        { status: 400 }
      );
    }
    
    if (!message || !message.text || !message.sender) {
      loggers.chat.error('❌ Missing required message fields:', message);
      return NextResponse.json(
        { error: 'Message must include text and sender' },
        { status: 400 }
      );
    }
    
    // Empty message validation
    if (!message.text.trim()) {
      loggers.chat.error('❌ Empty message rejected');
      return NextResponse.json(
        { error: 'Empty messages are not allowed' },
        { status: 400 }
      );
    }

    await connectDB();
    
    loggers.chat.info('[DEBUG] MongoDB connection status:');
    loggers.chat.info('🔍 [DEBUG] - DB Name:', mongoose.connection.db?.databaseName);
    loggers.chat.info('🔍 [DEBUG] - Connection State:', mongoose.connection.readyState);
    
    // chatMessages
    const ChatMessageModel = mongoose.models.chatMessages || 
                           mongoose.model('chatMessages', chatMessageSchema, 'chatMessages');

    if (mongoose.connection && mongoose.connection.db) {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      loggers.chat.info('[DEBUG] Available collections:', collectionNames.join(', '));
    }

    // roomId
    const normalizedRoomId = String(roomId).trim();
    if (!normalizedRoomId) {
      loggers.chat.error('❌ Invalid roomId format:', roomId);
      return NextResponse.json(
        { error: 'Invalid roomId format' },
        { status: 400 }
      );
    }

    const existingMessage = await ChatMessageModel.findOne({ messageId: message.id });
    if (existingMessage) {
      loggers.chat.info(`⚠️ Duplicate message ID detected: ${message.id}, skipping save`);
      return NextResponse.json({ 
        success: true, 
        message: 'Message already exists, no changes made'
      });
    }

    const timestamp = typeof message.timestamp === 'string' 
      ? new Date(message.timestamp) 
      : (message.timestamp || new Date());

    const newMessage: DBMessage = {
      messageId: message.id,
      roomId: normalizedRoomId,
      text: message.text,
      sender: message.sender,
      isUser: message.isUser,
      timestamp,
      role: message.role,
      senderType: message.senderType,
      stage: message.stage
    };
    
    if (message.citations && Array.isArray(message.citations) && message.citations.length > 0) {
      loggers.chat.info('📚 Citations data found:', JSON.stringify(message.citations));
      newMessage.citations = message.citations;
    }
    
    loggers.chat.info('[DEBUG] Message to save:');
    loggers.chat.info('🔍 [DEBUG] - MessageID:', newMessage.messageId);
    loggers.chat.info('🔍 [DEBUG] - RoomID:', newMessage.roomId);
    loggers.chat.info('🔍 [DEBUG] - Sender:', newMessage.sender);
    loggers.chat.info('🔍 [DEBUG] - Role:', newMessage.role);
    loggers.chat.info('🔍 [DEBUG] - SenderType:', newMessage.senderType);
    loggers.chat.info('🔍 [DEBUG] - Stage:', newMessage.stage);

    // chatMessages
    try {
      const savedMessage = await ChatMessageModel.create(newMessage);
      loggers.chat.info(`✅ Message saved to chatMessages collection with _id: ${savedMessage._id}`);
      
      loggers.chat.info('[VERIFY] Verifying in DB immediately after save...');
      const verifyMessage = await ChatMessageModel.findOne({ messageId: message.id });
      if (verifyMessage) {
        loggers.chat.info('[VERIFY] Message save verified');
        loggers.chat.info('🔍 [VERIFY] - _id:', verifyMessage._id);
        loggers.chat.info('🔍 [VERIFY] - messageId:', verifyMessage.messageId);
        loggers.chat.info('🔍 [VERIFY] - roomId:', verifyMessage.roomId);
        loggers.chat.info('🔍 [VERIFY] - role:', verifyMessage.role);
        loggers.chat.info('🔍 [VERIFY] - senderType:', verifyMessage.senderType);
        loggers.chat.info('🔍 [VERIFY] - stage:', verifyMessage.stage);
      } else {
        loggers.chat.error('[VERIFY] Message not found after save!');
      }
      
      const totalMessages = await ChatMessageModel.countDocuments({ roomId: normalizedRoomId });
      loggers.chat.info(`📊 room "${normalizedRoomId}"'s total message count: ${totalMessages}items`);
      
    } catch (dbError) {
      loggers.chat.error('chatMessages save error:', dbError);
      throw dbError;
    }
    
    loggers.chat.info(`✅ Message saved to chatMessages collection  room "${normalizedRoomId}"`);

    return NextResponse.json({ 
      success: true, 
      message: 'Message saved successfully to chatMessages collection'
    });
    
  } catch (error) {
    loggers.chat.error('❌ Error processing message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 