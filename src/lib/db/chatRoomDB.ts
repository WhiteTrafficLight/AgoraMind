import { ObjectId } from 'mongodb';
import { getMongoClient } from './mongodb';
import { ChatRoom, ChatMessage } from '@/lib/ai/chatService';
import { loggers } from '@/utils/logger';

// DB (MongoDB )
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
  dialogueType?: string;
  freeDiscussionSessionId?: string;
  pro?: string[];  // (NPC IDs )
  con?: string[];  // (NPC IDs )
  neutral?: string[];  // (NPC IDs )
  moderator?: {
    style_id?: string;
    style?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Citation {
  id: string;
  text: string;
  source: string;
  location?: string;
}

export interface DBChatMessage {
  _id?: ObjectId;
  messageId: string;
  roomId: string;
  text: string;
  sender: string;
  isUser: boolean;
  timestamp: Date;
  createdAt: Date;
  citations?: Citation[];
}

class ChatRoomDB {
  async getAllChatRooms(): Promise<ChatRoom[]> {
    try {
      const client = await getMongoClient();
      const db = client.db(process.env.MONGODB_DB || 'agoramind');
      
      const rooms = await db.collection<DBChatRoom>('chatRooms')
        .find({})
        .sort({ updatedAt: -1 })
        .toArray();

      const roomsFromDB = this.transformRoomsFromDB(rooms);
      
      const uniqueIdMap = new Map<string, ChatRoom>();
      
      for (const room of roomsFromDB) {
        const idKey = String(room.id);
        // Map ( )
        if (!uniqueIdMap.has(idKey)) {
          uniqueIdMap.set(idKey, room);
        }
      }
      
      const uniqueRoomIds = Array.from(uniqueIdMap.values()).map(room => room.id);
      loggers.db.debug('Retrieved unique chat room IDs from database', {
        totalRooms: rooms.length,
        uniqueRooms: uniqueRoomIds.length,
        roomIds: uniqueRoomIds
      });
      
      return Array.from(uniqueIdMap.values());
    } catch (error) {
      loggers.db.error('Database error in getAllChatRooms', error);
      throw error;
    }
  }

  async getChatRoomById(id: string): Promise<ChatRoom | null> {
    try {
      if (!id) {
        loggers.db.error('getChatRoomById called with null or undefined ID');
        return null;
      }
      
      const client = await getMongoClient();
      const db = client.db(process.env.MONGODB_DB || 'agoramind');
      
      const roomId = String(id).trim();
      loggers.db.debug('Database query - converting ID to string', { 
        originalId: id, 
        originalType: typeof id, 
        normalizedId: roomId 
      });
      
      if (!roomId) {
        loggers.db.error('Database query failed - empty ID string', { roomId });
        return null;
      }
      
      loggers.db.debug('Executing database query', { query: { roomId } });
      const room = await db.collection<DBChatRoom>('chatRooms').findOne({ roomId });
      
      if (!room) {
        loggers.db.debug('No room found in database', { roomId });
        return null;
      }
      
      loggers.db.info('Retrieved username from database', { username: room.roomId });
      
      const messages = await db.collection<DBChatMessage>('chatMessages')
        .find({ roomId })
        .sort({ timestamp: 1 })
        .toArray();
      
      const transformedRoom = this.transformRoomFromDB(room, messages);
      
      transformedRoom.id = String(transformedRoom.id);
      loggers.db.debug('Database query completed - room transformation finished', {
        roomId: transformedRoom.id,
        roomIdType: typeof transformedRoom.id,
        messageCount: messages.length
      });
      
      return transformedRoom;
    } catch (error) {
      loggers.db.error('Database error in getChatRoomById', { id, error });
      throw error;
    }
  }

  async createChatRoom(room: ChatRoom): Promise<ChatRoom> {
    try {
      const client = await getMongoClient();
      const db = client.db(process.env.MONGODB_DB || 'agoramind');
      
      // room.id ,
      let roomId: string;
      
      if (room.id) {
        // room_id
        roomId = String(room.id).trim();
        loggers.db.debug('Using provided room_id', { roomId });
      } else {
        let nextNumber = 1;
        
        try {
          const existingRooms = await db.collection<DBChatRoom>('chatRooms')
            .find({})
            .toArray();
          
          const numericIds = existingRooms
            .map(r => r.roomId)
            .filter(id => /^\d+$/.test(id))
            .map(id => parseInt(id))
            .filter(num => !isNaN(num));
          
          if (numericIds.length > 0) {
            nextNumber = Math.max(...numericIds) + 1;
            loggers.db.debug('Generated new ID based on maximum numeric ID', { nextNumber });
          } else {
            loggers.db.debug('No numeric IDs found, generating first ID', { nextNumber });
          }
          
          roomId = String(nextNumber);
            
          try {
            interface CounterDoc {
              _id: string;
              seq: number;
            }
            
            const countersCollection = db.collection<CounterDoc>('counters');
            await countersCollection.findOneAndUpdate(
                { _id: 'roomId' },
              { $set: { seq: nextNumber } },
              { upsert: true }
              );
            loggers.db.debug('Counter safely updated/created', { nextNumber });
        } catch (counterError) {
            loggers.db.warn('Counter update error (ignored)', counterError);
          }
        } catch (idGenerationError) {
          loggers.db.error('ID generation error', idGenerationError);
          
          roomId = `ROOM_${Date.now()}`;
          loggers.db.debug('Generated timestamp-based fallback ID', { roomId });
        }
      }
      
      loggers.db.debug('Assigned ID to new chat room', { roomId });
      
      const dbRoom: DBChatRoom = {
        roomId,
        title: room.title,
        context: room.context,
        participants: room.participants,
        totalParticipants: room.totalParticipants,
        lastActivity: room.lastActivity,
        isPublic: room.isPublic,
        dialogueType: room.dialogueType || 'free',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      if (room.pro) dbRoom.pro = room.pro;
      if (room.con) dbRoom.con = room.con;
      if (room.neutral) dbRoom.neutral = room.neutral;
      
      if (room.moderator) dbRoom.moderator = room.moderator;
      
      loggers.db.debug('Chat room data before database save', {
        roomId,
        title: room.title,
        dialogueType: room.dialogueType,
        participantCount: room.totalParticipants
      });
      
      if (room.dialogueType === 'debate') {
        loggers.db.info('Debate mode detected during save', { dialogueType: room.dialogueType });
        loggers.db.debug('Using existing pro, con, neutral fields');
        if (room.pro) loggers.db.debug('Pro participants', { pro: room.pro });
        if (room.con) loggers.db.debug('Con participants', { con: room.con });
        if (room.neutral) loggers.db.debug('Neutral participants', { neutral: room.neutral });
      }

      // roomId
      const existingRoom = await db.collection<DBChatRoom>('chatRooms').findOne({ roomId });
      if (existingRoom) {
        loggers.db.warn('Room ID already exists, returning existing room', { roomId });
        return this.transformRoomFromDB(existingRoom, []);
      }

      const result = await db.collection<DBChatRoom>('chatRooms').insertOne(dbRoom);
      loggers.db.info('Chat room saved to database', {
        roomId,
        dialogueType: room.dialogueType,
        insertedId: result.insertedId
      });

      const createdRoom = await db.collection<DBChatRoom>('chatRooms').findOne({ roomId });
      if (!createdRoom) {
        throw new Error('Failed to create chat room');
      }

      return this.transformRoomFromDB(createdRoom, []);
    } catch (error) {
      loggers.db.error('Database error in createChatRoom', error);
      throw error;
    }
  }

  async addMessage(roomId: string, message: ChatMessage): Promise<boolean> {
    try {
      const client = await getMongoClient();
      const db = client.db(process.env.MONGODB_DB || 'agoramind');
      
      const normalizedRoomId = String(roomId).trim();
      loggers.db.debug('Adding message to room', {
        originalRoomId: roomId,
        normalizedRoomId,
        messageId: message.id,
        sender: message.sender
      });
      
      if (!normalizedRoomId) {
        loggers.db.error('Invalid chat room ID for message save', { roomId });
        return false;
      }
      
      const room = await db.collection<DBChatRoom>('chatRooms').findOne({ roomId: normalizedRoomId });
      
      if (!room) {
        loggers.db.error('Failed to add message - room not found', { roomId: normalizedRoomId });
        return false;
      }
      
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
      
      await db.collection<DBChatMessage>('chatMessages').insertOne(dbMessage);
      
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
      loggers.db.error('Failed to add message', { roomId, messageId: message.id, error });
      return false;
    }
  }

  async updateChatRoom(roomId: string, updates: Partial<ChatRoom>): Promise<boolean> {
    try {
      const client = await getMongoClient();
      const db = client.db(process.env.MONGODB_DB || 'agoramind');
      
      const normalizedRoomId = String(roomId).trim();
      
      const updateFields: Partial<DBChatRoom> = {};
      
      if (updates.title) updateFields.title = updates.title;
      if (updates.context) updateFields.context = updates.context;
      if (updates.participants) updateFields.participants = updates.participants;
      if (updates.isPublic !== undefined) updateFields.isPublic = updates.isPublic;
      if (updates.freeDiscussionSessionId) updateFields.freeDiscussionSessionId = updates.freeDiscussionSessionId;
      
      updateFields.updatedAt = new Date();
      
      const result = await db.collection<DBChatRoom>('chatRooms').updateOne(
        { roomId: normalizedRoomId },
        { $set: updateFields }
      );
      
      return result.matchedCount > 0;
    } catch (error) {
      loggers.db.error('Failed to update chat room', { roomId, error });
      return false;
    }
  }

  private transformRoomsFromDB(dbRooms: DBChatRoom[]): ChatRoom[] {
    return dbRooms.map(room => ({
      id: room.roomId,  // roomId
      title: room.title,
      context: room.context,
      participants: room.participants,
      totalParticipants: room.totalParticipants,
      lastActivity: room.lastActivity,
      isPublic: room.isPublic,
      dialogueType: room.dialogueType || 'free', // Add dialogueType with default of 'free'
      freeDiscussionSessionId: room.freeDiscussionSessionId,
      pro: room.pro,
      con: room.con,
      neutral: room.neutral,
      moderator: room.moderator,
      messages: []
    }));
  }

  private transformRoomFromDB(dbRoom: DBChatRoom, dbMessages: DBChatMessage[]): ChatRoom {
    return {
      id: dbRoom.roomId,  // roomId
      title: dbRoom.title,
      context: dbRoom.context,
      participants: dbRoom.participants,
      totalParticipants: dbRoom.totalParticipants || 0,
      lastActivity: dbRoom.lastActivity || 'Unknown',
      isPublic: typeof dbRoom.isPublic === 'boolean' ? dbRoom.isPublic : true,
      dialogueType: dbRoom.dialogueType || 'free',
      freeDiscussionSessionId: dbRoom.freeDiscussionSessionId,
      pro: dbRoom.pro,
      con: dbRoom.con,
      neutral: dbRoom.neutral,
      moderator: dbRoom.moderator,
      messages: dbMessages.map(msg => ({
        id: msg.messageId,
        text: msg.text,
        sender: msg.sender,
        isUser: msg.isUser,
        timestamp: msg.timestamp,
        citations: msg.citations
      }))
    };
  }
}

const chatRoomDB = new ChatRoomDB();
export default chatRoomDB; 