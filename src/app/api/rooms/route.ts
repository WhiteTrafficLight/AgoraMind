import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { ChatRoom, ChatRoomCreationParams, ChatMessage } from '@/lib/ai/chatService';
import chatRoomDB from '@/lib/db/chatRoomDB';
import { loggers } from '@/utils/logger';
import { apiUrl, ENDPOINTS } from '@/lib/api/endpoints';
import connectDB from '@/lib/mongodb';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = <T>(body: T, init: ResponseInit = {}): NextResponse =>
  NextResponse.json(body, { ...init, headers: { ...corsHeaders, ...(init.headers || {}) } });

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const isPublic = searchParams.get('isPublic');

    if (id) {
      loggers.api.debug('Searching for chat room by ID', { id });
      const normalizedRoomId = String(id).trim();
      const room = await chatRoomDB.getChatRoomById(normalizedRoomId);

      if (room && String(room.id) !== String(normalizedRoomId)) {
        loggers.api.error('Invalid room ID mismatch', {
          requested: normalizedRoomId,
          returned: room.id,
        });
        return json(null);
      }

      if (room) {
        loggers.api.debug('Chat room info', {
          roomId: id,
          title: room.title,
          messagesCount: room.messages?.length || 0,
          lastMessageFrom:
            room.messages && room.messages.length > 0
              ? room.messages[room.messages.length - 1].sender
              : 'none',
        });
      }

      return json(room || null);
    }

    const allRooms = await chatRoomDB.getAllChatRooms();

    const uniqueRooms = allRooms.reduce((acc: ChatRoom[], room: ChatRoom) => {
      const exists = acc.some((r: ChatRoom) => String(r.id) === String(room.id));
      if (!exists) {
        acc.push(room);
      } else {
        loggers.api.warn('Duplicate chat room ID found', { id: room.id, title: room.title });
      }
      return acc;
    }, [] as ChatRoom[]);

    let filteredRooms = uniqueRooms;
    if (isPublic !== null) {
      const publicOnly = isPublic === 'true';
      filteredRooms = filteredRooms.filter((room) => room.isPublic === publicOnly);
    }

    return json(filteredRooms);
  } catch (error) {
    loggers.api.error('Error getting chat rooms', error);
    return json({ error: 'Failed to get chat rooms' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    loggers.api.info('Processing POST request - creating chat room');

    const params = (await request.json()) as ChatRoomCreationParams;
    loggers.api.debug('Request body', {
      title: params.title,
      dialogueType: params.dialogueType,
      npcCount: params.npcs?.length || 0,
    });

    if (params.dialogueType === 'debate') {
      loggers.api.info('Debate mode detected');
      loggers.api.debug('NPC positions', params.npcPositions);
      loggers.api.debug('User debate role', { userDebateRole: params.userDebateRole });
    }

    if (!params.title || !params.title.trim()) {
      loggers.api.error('Title missing in request');
      return json({ error: 'Chat room title is required' }, { status: 400 });
    }

    if (!params.npcs || !Array.isArray(params.npcs) || params.npcs.length === 0) {
      loggers.api.error('NPCs missing in request');
      return json({ error: 'At least one philosopher (NPC) is required' }, { status: 400 });
    }

    let currentUser: string = params.username || params.currentUser || '';

    if (!currentUser) {
      try {
        const origin = request.headers.get('origin') || 'http://localhost:3000';
        const userResponse = await fetch(`${origin}/api/user/profile`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          currentUser =
            userData.username || userData.name || `User_${Math.floor(Math.random() * 10000)}`;
          loggers.api.info('Retrieved username from user profile', { username: currentUser });
        } else {
          throw new Error('User profile not found');
        }
      } catch (error) {
        loggers.api.warn('Failed to get user profile, generating random name', error);
        currentUser = `User_${Math.floor(Math.random() * 10000)}`;
      }
    }

    const newRoom: ChatRoom = {
      id: `ROOM_${Date.now()}`,
      title: params.title,
      context: params.context || '',
      participants: {
        users: [currentUser],
        npcs: [...params.npcs],
      },
      totalParticipants: 1 + params.npcs.length,
      lastActivity: 'Just now',
      messages: [],
      isPublic: params.isPublic !== false,
      dialogueType: params.dialogueType || 'free',
      moderator: params.moderator,
    };

    if (params.dialogueType === 'debate' && params.npcPositions) {
      loggers.api.debug('Setting up debate information');
      newRoom.pro = [];
      newRoom.con = [];
      newRoom.neutral = [];

      for (const npcId of params.npcs) {
        const position = params.npcPositions[npcId];
        if (position === 'pro') {
          newRoom.pro.push(npcId);
        } else if (position === 'con') {
          newRoom.con.push(npcId);
        } else {
          newRoom.neutral.push(npcId);
        }
      }

      if (params.userDebateRole === 'pro') {
        newRoom.pro.push(currentUser);
      } else if (params.userDebateRole === 'con') {
        newRoom.con.push(currentUser);
      } else {
        newRoom.neutral.push(currentUser);
      }

      loggers.api.debug('Final participant assignments', {
        pro: newRoom.pro,
        con: newRoom.con,
        neutral: newRoom.neutral,
      });

      if (params.dialogueType === 'debate' && params.generateInitialMessage) {
        try {
          loggers.api.info('Starting moderator message generation request to Python API');
          const proNpcIds = newRoom.pro || [];
          const conNpcIds = newRoom.con || [];

          const npcNames: Record<string, string> = {};
          const allNpcIds = [...new Set([...proNpcIds, ...conNpcIds])].filter(
            (id) => id !== currentUser,
          );

          for (const npcId of allNpcIds) {
            try {
              const isUuid = npcId.length > 30 && npcId.includes('-');
              if (isUuid) {
                try {
                  await connectDB();
                  const npcCollection = mongoose.connection.collection('npcs');
                  const customNpc = await npcCollection.findOne({ backend_id: npcId });
                  if (customNpc) {
                    npcNames[npcId] = customNpc.name;
                    continue;
                  }
                } catch (dbError) {
                  loggers.api.error('MongoDB error during NPC lookup', dbError);
                }
              }

              const defaultNames: Record<string, string> = {
                socrates: 'Socrates',
                plato: 'Plato',
                aristotle: 'Aristotle',
                kant: 'Immanuel Kant',
                hegel: 'Georg Wilhelm Friedrich Hegel',
                nietzsche: 'Friedrich Nietzsche',
                marx: 'Karl Marx',
                sartre: 'Jean-Paul Sartre',
                camus: 'Albert Camus',
                beauvoir: 'Simone de Beauvoir',
                confucius: 'Confucius',
                heidegger: 'Martin Heidegger',
                wittgenstein: 'Ludwig Wittgenstein',
              };

              if (npcId.toLowerCase() in defaultNames) {
                npcNames[npcId] = defaultNames[npcId.toLowerCase()];
              } else {
                npcNames[npcId] = npcId.charAt(0).toUpperCase() + npcId.slice(1);
              }
            } catch (error) {
              loggers.api.error('Error fetching NPC details', { npcId, error });
            }
          }

          const requestData = {
            room_id: String(newRoom.id),
            title: params.title,
            context: params.context || '',
            pro_npcs: proNpcIds.filter((id) => id !== currentUser),
            con_npcs: conNpcIds.filter((id) => id !== currentUser),
            user_ids: [currentUser],
            user_side: params.userDebateRole || 'neutral',
            moderator_style: params.moderator?.style || 'Jamie the Host',
            moderator_style_id: params.moderator?.style_id || '0',
          };

          const apiResponse = await fetch(apiUrl(ENDPOINTS.chat.createDebateRoom), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData),
          });

          if (apiResponse.ok) {
            const responseData = await apiResponse.json();
            if (responseData.status === 'success') {
              loggers.api.info('DebateDialogue instance created and auto-progression started');
              newRoom.id = responseData.room_id;
              newRoom.debate_info = responseData.debate_info;
            } else {
              throw new Error(
                `Python API response error: ${responseData.message || 'Unknown error'}`,
              );
            }
          } else {
            const errorText = await apiResponse.text();
            loggers.api.error('Python API request failed', {
              status: apiResponse.status,
              statusText: apiResponse.statusText,
              errorMessage: errorText,
            });
            throw new Error(
              `Python API request failed: ${apiResponse.status} ${apiResponse.statusText}`,
            );
          }
        } catch (error) {
          loggers.api.error('Error during moderator opening message generation', error);
        }
      }
    }

    const createdRoom = await chatRoomDB.createChatRoom(newRoom);
    loggers.api.info('Chat room created', {
      id: createdRoom.id,
      title: createdRoom.title,
      dialogueType: createdRoom.dialogueType || 'not set',
    });

    return json(createdRoom, { status: 201 });
  } catch (error) {
    loggers.api.error('Error creating chat room', error);
    return json({ error: 'Failed to create chat room' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    loggers.api.info('Processing PUT request - updating chat room');

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('id') || searchParams.get('roomId');

    if (!roomId) {
      return json({ error: 'Room ID is required' }, { status: 400 });
    }

    const roomIdStr = String(roomId);
    const room = await chatRoomDB.getChatRoomById(roomIdStr);
    if (!room) {
      loggers.api.warn('Room not found for update', { roomId: roomIdStr });
      return json({ error: 'Chat room not found' }, { status: 404 });
    }

    const updates = (await request.json()) as Partial<ChatRoom> & {
      freeDiscussionSessionId?: string;
      message?: ChatMessage;
    };

    if (updates.freeDiscussionSessionId) {
      await chatRoomDB.updateChatRoom(roomIdStr, {} as ChatRoom);
    }

    if (updates.message) {
      const { message } = updates;

      if (Object.prototype.hasOwnProperty.call(message, 'citations') && message.citations === undefined) {
        delete message.citations;
      }
      if (message.citations && Array.isArray(message.citations) && message.citations.length === 0) {
        delete message.citations;
      }

      const success = await chatRoomDB.addMessage(roomIdStr, message);

      if (success) {
        loggers.api.debug('Added new message to room', {
          roomId: roomIdStr,
          sender: message.sender,
          messageCount: (room.messages?.length ?? 0) + 1,
        });
      } else {
        loggers.api.debug('Duplicate message skipped', { messageId: message.id });
      }
    }

    if (updates.participants) {
      await chatRoomDB.updateChatRoom(roomIdStr, {
        participants: {
          ...room.participants,
          ...updates.participants,
        },
      });

      const updatedRoom = await chatRoomDB.getChatRoomById(roomIdStr);
      if (updatedRoom) {
        await chatRoomDB.updateChatRoom(roomIdStr, {
          totalParticipants:
            updatedRoom.participants.users.length + updatedRoom.participants.npcs.length,
        });
      }
    }

    const updatedRoom = await chatRoomDB.getChatRoomById(roomIdStr);
    return json({ success: true, room: updatedRoom });
  } catch (error) {
    loggers.api.error('Error updating chat room', error);
    return json({ success: false, error: 'Failed to update chat room' }, { status: 500 });
  }
}
