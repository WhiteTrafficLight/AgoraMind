import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

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
    
    console.log(`🔍 [GET] Loading messages  room "${normalizedRoomId}"`);
    
    await connectDB();
    
    // chatMessages
    const ChatMessageModel = mongoose.models.chatMessages || 
                           mongoose.model('chatMessages', chatMessageSchema, 'chatMessages');
    
    const messages = await ChatMessageModel.find({ roomId: normalizedRoomId })
      .sort({ timestamp: 1 })
      .lean();
    
    console.log(`✅ [GET] Found ${messages.length} messages  room "${normalizedRoomId}"`);
    
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
    
    const body = await req.json();
    const { roomId, message, isInitial = false } = body;
    
    console.log(`Message details - RoomID: ${roomId}, IsInitial: ${isInitial}`);
    console.log(`Sender: ${message?.sender}, Length: ${message?.text?.length || 0}`);
    
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

    await connectDB();
    
    console.log('[DEBUG] MongoDB connection status:');
    console.log('🔍 [DEBUG] - DB Name:', mongoose.connection.db?.databaseName);
    console.log('🔍 [DEBUG] - Connection State:', mongoose.connection.readyState);
    
    // chatMessages
    const ChatMessageModel = mongoose.models.chatMessages || 
                           mongoose.model('chatMessages', chatMessageSchema, 'chatMessages');

    if (mongoose.connection && mongoose.connection.db) {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      console.log('[DEBUG] Available collections:', collectionNames.join(', '));
    }

    // roomId
    const normalizedRoomId = String(roomId).trim();
    if (!normalizedRoomId) {
      console.error('❌ Invalid roomId format:', roomId);
      return NextResponse.json(
        { error: 'Invalid roomId format' },
        { status: 400 }
      );
    }

    const existingMessage = await ChatMessageModel.findOne({ messageId: message.id });
    if (existingMessage) {
      console.log(`⚠️ Duplicate message ID detected: ${message.id}, skipping save`);
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
      console.log('📚 Citations data found:', JSON.stringify(message.citations));
      newMessage.citations = message.citations;
    }
    
    console.log('[DEBUG] Message to save:');
    console.log('🔍 [DEBUG] - MessageID:', newMessage.messageId);
    console.log('🔍 [DEBUG] - RoomID:', newMessage.roomId);
    console.log('🔍 [DEBUG] - Sender:', newMessage.sender);
    console.log('🔍 [DEBUG] - Role:', newMessage.role);
    console.log('🔍 [DEBUG] - SenderType:', newMessage.senderType);
    console.log('🔍 [DEBUG] - Stage:', newMessage.stage);

    // chatMessages
    try {
      const savedMessage = await ChatMessageModel.create(newMessage);
      console.log(`✅ Message saved to chatMessages collection with _id: ${savedMessage._id}`);
      
      console.log('[VERIFY] Verifying in DB immediately after save...');
      const verifyMessage = await ChatMessageModel.findOne({ messageId: message.id });
      if (verifyMessage) {
        console.log('[VERIFY] Message save verified');
        console.log('🔍 [VERIFY] - _id:', verifyMessage._id);
        console.log('🔍 [VERIFY] - messageId:', verifyMessage.messageId);
        console.log('🔍 [VERIFY] - roomId:', verifyMessage.roomId);
        console.log('🔍 [VERIFY] - role:', verifyMessage.role);
        console.log('🔍 [VERIFY] - senderType:', verifyMessage.senderType);
        console.log('🔍 [VERIFY] - stage:', verifyMessage.stage);
      } else {
        console.error('[VERIFY] Message not found after save!');
      }
      
      const totalMessages = await ChatMessageModel.countDocuments({ roomId: normalizedRoomId });
      console.log(`📊 room "${normalizedRoomId}"'s total message count: ${totalMessages}items`);
      
    } catch (dbError) {
      console.error('chatMessages save error:', dbError);
      throw dbError;
    }
    
    console.log(`✅ Message saved to chatMessages collection  room "${normalizedRoomId}"`);

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