import type { NextApiRequest, NextApiResponse } from 'next';
import type { Socket as NetSocket } from 'net';
import type { Server as HttpServer } from 'http';
import type { Server as SocketIOServer } from 'socket.io';
import { ChatRoom, ChatRoomCreationParams } from '@/lib/ai/chatService';
import chatRoomDB from '@/lib/db/chatRoomDB';
import mongoose from 'mongoose';
import { loggers } from '@/utils/logger';

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
    loggers.api.debug('Rooms API debug', args);
  }
}

// MongoDB 연결 함수 추가
let isConnected = false;
const connectDB = async () => {
  if (isConnected) {
    loggers.api.debug('MongoDB already connected');
    return;
  }

  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/agoramind';
    await mongoose.connect(mongoUrl);
    isConnected = true;
    loggers.api.debug('MongoDB connected successfully');
  } catch (error) {
    loggers.api.error('MongoDB connection error', error);
    throw error;
  }
};

// db 객체 초기화
const db = mongoose.connection;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseWithIO
) {
  // 중요한 로그만 유지하고 나머지는 디버그 모드로 제어
  if (req.method === 'POST') {
    loggers.api.info('API request received', { method: req.method, url: req.url });
  } else {
    log('API request received:', req.method, req.url);
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
      loggers.api.debug('Processing GET request', { query: req.query });
      
      // ID로 특정 채팅룸 필터링
      const { id } = req.query;
      if (id) {
        loggers.api.debug('Searching for chat room by ID', { id });
        // 배열인 경우 첫 번째 값만 사용
        const roomId = Array.isArray(id) ? id[0] : id;
        
        // roomId를 문자열로 정규화 (Number 변환 제거)
        const normalizedRoomId = String(roomId).trim();
        
        // 데이터베이스에서 채팅룸 조회
        const room = await chatRoomDB.getChatRoomById(normalizedRoomId);
        loggers.api.debug('Search result', { found: !!room, roomId: id });
        
        // 아이디 일치 여부 확인
        if (room && String(room.id) !== String(normalizedRoomId)) {
          loggers.api.error('Invalid room ID mismatch', { 
            requested: normalizedRoomId, 
            returned: room.id 
          });
          return res.status(200).json(null);
        }
        
        if (room) {
          loggers.api.debug('Chat room info', {
            roomId,
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
          loggers.api.warn('Duplicate chat room ID found', { id: room.id, title: room.title });
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
      loggers.api.error('Error getting chat rooms', error);
      return res.status(500).json({ error: 'Failed to get chat rooms' });
    }
  }

  // POST 요청 - 새 채팅룸 생성
  if (req.method === 'POST') {
    try {
      loggers.api.info('Processing POST request - creating chat room');
      
      const params = req.body as ChatRoomCreationParams;
      loggers.api.debug('Request body', { 
        title: params.title,
        dialogueType: params.dialogueType,
        npcCount: params.npcs?.length || 0
      });
      loggers.api.debug('Dialogue type', { dialogueType: params.dialogueType });
      
      if (params.dialogueType === 'debate') {
        loggers.api.info('Debate mode detected');
        loggers.api.debug('NPC positions', params.npcPositions);
        loggers.api.debug('User debate role', { userDebateRole: params.userDebateRole });
      }

      // 유효성 검사
      if (!params.title || !params.title.trim()) {
        loggers.api.error('Title missing in request');
        return res.status(400).json({ error: 'Chat room title is required' });
      }

      if (!params.npcs || !Array.isArray(params.npcs) || params.npcs.length === 0) {
        loggers.api.error('NPCs missing in request');
        return res.status(400).json({ error: 'At least one philosopher (NPC) is required' });
      }

      // 현재 사용자 정보 가져오기
      let currentUser: string = params.username || params.currentUser || '';
      
      if (!currentUser) {
        try {
          // /api/user/profile에서 실제 사용자 정보 가져오기
          const userResponse = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/user/profile`);
          if (userResponse.ok) {
            const userData = await userResponse.json();
            currentUser = userData.username || userData.name || `User_${Math.floor(Math.random() * 10000)}`;
            loggers.api.info('Retrieved username from user profile', { username: currentUser });
          } else {
            throw new Error('User profile not found');
          }
        } catch (error) {
          loggers.api.warn('Failed to get user profile, generating random name', error);
          currentUser = `User_${Math.floor(Math.random() * 10000)}`;
        }
      }
      
      loggers.api.debug('Final username', { username: currentUser });

      // 새 채팅룸 객체 생성
      const newRoom: ChatRoom = {
        id: `ROOM_${Date.now()}`,
        title: params.title,
        context: params.context || '',
        participants: {
          users: [currentUser],
          npcs: [...params.npcs]
        },
        totalParticipants: 1 + params.npcs.length,
        lastActivity: 'Just now',
        messages: [],
        isPublic: params.isPublic !== false,
        dialogueType: params.dialogueType || 'free', // 명시적으로 dialogueType 설정
        moderator: params.moderator // 모더레이터 정보 추가
      };
      
      // 찬반토론 모드인 경우 pro, con, neutral 필드 설정
      if (params.dialogueType === 'debate' && params.npcPositions) {
        loggers.api.debug('Setting up debate information');
        
        // pro, con, neutral 초기화
        newRoom.pro = [];
        newRoom.con = [];
        newRoom.neutral = [];
        
        // NPC 위치 설정
        for (const npcId of params.npcs) {
          const position = params.npcPositions[npcId];
          if (position === 'pro') {
            newRoom.pro.push(npcId);
            loggers.api.debug('Added NPC to PRO side', { npcId });
          } else if (position === 'con') {
            newRoom.con.push(npcId);
            loggers.api.debug('Added NPC to CON side', { npcId });
          } else {
            newRoom.neutral.push(npcId);
            loggers.api.debug('Added NPC to NEUTRAL side', { npcId });
          }
        }
        
        // 사용자 위치 설정
        if (params.userDebateRole) {
          loggers.api.debug('User role assignment', { userDebateRole: params.userDebateRole });
          if (params.userDebateRole === 'pro') {
            newRoom.pro.push(currentUser);
            loggers.api.debug('Added user to PRO side', { user: currentUser });
          } else if (params.userDebateRole === 'con') {
            newRoom.con.push(currentUser);
            loggers.api.debug('Added user to CON side', { user: currentUser });
          } else { // neutral
            newRoom.neutral.push(currentUser);
            loggers.api.debug('Added user to NEUTRAL side', { user: currentUser });
          }
        } else {
          // 기본값은 neutral
          newRoom.neutral.push(currentUser);
          loggers.api.debug('User role not specified, added to NEUTRAL', { user: currentUser });
        }
        
        loggers.api.debug('Final participant assignments', {
          pro: newRoom.pro,
          con: newRoom.con,
          neutral: newRoom.neutral
        });

        // 디베이트 모드에서는 파이썬 API 서버에 모더레이터 메시지 생성 요청
        if (params.dialogueType === 'debate' && params.generateInitialMessage) {
          try {
            loggers.api.info('Starting moderator message generation request to Python API');
            
            // 파이썬 API 서버 URL (환경 변수 또는 기본값)
            const pythonApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            
            // Pro/Con 참가자(NPC+유저) 목록 생성
            // NPC와 유저를 모두 포함하는 전체 pro/con 배열 사용
            const proNpcIds = newRoom.pro || [];
            const conNpcIds = newRoom.con || [];

            loggers.api.debug('Moderator message NPCs', {
              proNpcIds: proNpcIds,
              proCount: proNpcIds.length,
              conNpcIds: conNpcIds,
              conCount: conNpcIds.length
            });
            
            // 유저 이름 매핑 객체 (User123 -> WhiteTrafficLight 등)
            const userData: Record<string, string> = {};
            
            // 유저 ID -> 표시명 매핑 (요청 파라미터 중 username 확인)
            if (params.username) {
              // 사용자 ID가 사용자 이름과 다른 경우에만 매핑에 추가
              if (currentUser !== params.username) {
                userData[currentUser] = params.username;
                loggers.api.debug('Added user name mapping', { 
                  from: currentUser, 
                  to: params.username 
                });
              }
              loggers.api.debug('Using actual username', { username: params.username });
            }
            
            // NPC 이름 정보 조회 및 매핑 생성
            loggers.api.info('Starting NPC name information retrieval');
            loggers.api.debug('NPC position information', params.npcPositions);
            
            // NPC ID -> 이름 매핑 객체
            const npcNames: Record<string, string> = {};
            
            // 모든 NPC ID 목록 (중복 제거)
            const allNpcIds = [...new Set([...proNpcIds, ...conNpcIds])].filter(id => id !== currentUser);
            
            // 각 NPC에 대해 이름 조회
            for (const npcId of allNpcIds) {
              loggers.api.debug('Fetching NPC details', { npcId });
              
              try {
                // 먼저 UUID 형태인지 확인
                let isUuid = false;
                try {
                  // UUID 형식인지 확인
                  if (npcId.length > 30 && npcId.includes('-')) {
                    isUuid = true;
                    loggers.api.debug('Searching by backend_id (UUID)', { npcId });
                  }
                } catch (e) {
                  // UUID 형식이 아니면 무시
                }
                
                // 1. UUID 형식이면 MongoDB에서 직접 조회
                if (isUuid) {
                  try {
                    // MongoDB에 연결
                    await connectDB();
                    const npcCollection = db.collection('npcs');
                    
                    // backend_id로 NPC 검색
                    const customNpc = await npcCollection.findOne({ backend_id: npcId });
                    
                    if (customNpc) {
                      loggers.api.info('Found custom NPC', { 
                        name: customNpc.name,
                        id: customNpc._id,
                        backendId: npcId
                      });
                      
                      // 매핑에 추가
                      npcNames[npcId] = customNpc.name;
                      continue; // 찾았으므로 다음 NPC로
                    } else {
                      loggers.api.warn('Custom NPC not found with backend_id', { npcId });
                    }
                  } catch (dbError) {
                    loggers.api.error('MongoDB error during NPC lookup', dbError);
                  }
                }
                
                // 2. API를 통해 조회
                const apiUrl = `${pythonApiUrl}/api/npc/get?id=${npcId}`;
                loggers.api.debug('Trying backend API', { apiUrl });
                
                const response = await fetch(apiUrl);
                if (response.ok) {
                  const npcData = await response.json();
                  if (npcData && npcData.name) {
                    loggers.api.info('Retrieved NPC details from backend', { 
                      name: npcData.name,
                      npcId
                    });
                    loggers.api.debug('NPC name mapping added', { 
                      from: npcId, 
                      to: npcData.name 
                    });
                    loggers.api.debug('NPC info retrieval result', { 
                      data: JSON.stringify(npcData).substring(0, 100) + '...' 
                    });
                    
                    // 매핑에 추가
                    npcNames[npcId] = npcData.name;
                  } else {
                    loggers.api.warn('API returned data without name for NPC', { npcId });
                  }
                } else {
                  loggers.api.warn('Failed to get NPC details from API', { 
                    npcId,
                    status: response.status 
                  });
                  
                  // 기본 철학자 이름 하드코딩
                  const defaultNames: Record<string, string> = {
                    "socrates": "Socrates",
                    "plato": "Plato",
                    "aristotle": "Aristotle",
                    "kant": "Immanuel Kant",
                    "hegel": "Georg Wilhelm Friedrich Hegel",
                    "nietzsche": "Friedrich Nietzsche",
                    "marx": "Karl Marx",
                    "sartre": "Jean-Paul Sartre",
                    "camus": "Albert Camus", 
                    "beauvoir": "Simone de Beauvoir",
                    "confucius": "Confucius",
                    "heidegger": "Martin Heidegger",
                    "wittgenstein": "Ludwig Wittgenstein"
                  };
                  
                  if (npcId.toLowerCase() in defaultNames) {
                    const defaultName = defaultNames[npcId.toLowerCase()];
                    loggers.api.debug('Using default philosopher name', { 
                      from: npcId, 
                      to: defaultName 
                    });
                    npcNames[npcId] = defaultName;
                  } else if (isUuid) {
                    loggers.api.error('Critical: Could not find actual name for custom NPC', { npcId });
                    loggers.api.debug('Using default name for unknown custom NPC', { 
                      from: npcId, 
                      to: 'Unknown Philosopher' 
                    });
                    npcNames[npcId] = "Unknown Philosopher";
                  } else {
                    loggers.api.debug('Using default capitalized name', { 
                      from: npcId, 
                      to: npcId.charAt(0).toUpperCase() + npcId.slice(1) 
                    });
                    npcNames[npcId] = npcId.charAt(0).toUpperCase() + npcId.slice(1);
                  }
                }
              } catch (error) {
                loggers.api.error('Error fetching NPC details', { npcId, error });
              }
            }
            
            loggers.api.debug('Final NPC name information', npcNames);
            
            // API 요청 데이터 구성 - 새로운 create-debate-room 엔드포인트용
            const requestData: {
              room_id: string;
              title: string;
              context?: string;
              pro_npcs: string[];
              con_npcs: string[];
              user_ids?: string[];
              user_side?: string;
              moderator_style?: string;
              moderator_style_id?: string;
            } = {
              room_id: String(newRoom.id),
              title: params.title,
              context: params.context || "",
              pro_npcs: proNpcIds.filter(id => id !== currentUser), // 사용자 제외한 NPC만
              con_npcs: conNpcIds.filter(id => id !== currentUser), // 사용자 제외한 NPC만
              user_ids: [currentUser],
              user_side: params.userDebateRole || "neutral", // 사용자가 속한 편 전달
              moderator_style: params.moderator?.style || "Jamie the Host",
              moderator_style_id: params.moderator?.style_id || "0"
              // stance_statements 제거 - 백엔드에서 자동 생성
            };
            
            loggers.api.debug('Python API request data (new method)', requestData);
            
            // 새로운 create-debate-room 엔드포인트 호출
            const apiResponse = await fetch(`${pythonApiUrl}/api/chat/create-debate-room`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestData),
            });
            
            // 응답 처리
            if (apiResponse.ok) {
              const responseData = await apiResponse.json();
              loggers.api.info('Python API response success (new method)', responseData);
              
              // 성공 응답 확인
              if (responseData.status === 'success') {
                loggers.api.info('DebateDialogue instance created and auto-progression started');
                loggers.api.debug('Current stage', { stage: responseData.debate_info?.current_stage });
                loggers.api.debug('Pro participants', { 
                  participants: responseData.debate_info?.pro_participants 
                });
                loggers.api.debug('Con participants', { 
                  participants: responseData.debate_info?.con_participants 
                });
                
                // 파이썬 백엔드에서 확인된 실제 room_id 사용
                newRoom.id = responseData.room_id;
                loggers.api.debug('Using Python backend confirmed room_id', { 
                  roomId: responseData.room_id 
                });
                
                // 토론방 정보를 newRoom에 추가 (필요시 프론트엔드에서 참조 가능)
                newRoom.debate_info = responseData.debate_info;
                
                loggers.api.info('Debate room creation completed - auto-progression running in background');
              } else {
                loggers.api.error('Python API response error', { 
                  message: responseData.message || 'Unknown error' 
                });
                throw new Error(`Python API response error: ${responseData.message || 'Unknown error'}`);
              }
            } else {
              const errorText = await apiResponse.text();
              loggers.api.error('Python API request failed', {
                status: apiResponse.status,
                statusText: apiResponse.statusText,
                errorMessage: errorText
              });
              throw new Error(`Python API request failed: ${apiResponse.status} ${apiResponse.statusText}`);
            }
          } catch (error) {
            loggers.api.error('Error during moderator opening message generation', error);
          }
        }
      }

      // 채팅룸 데이터베이스에 저장
      loggers.api.debug('Final chat room object before saving', { 
        id: newRoom.id,
        title: newRoom.title,
        participantCount: newRoom.totalParticipants
      });
      const createdRoom = await chatRoomDB.createChatRoom(newRoom);

      loggers.api.info('Chat room created', {
        id: createdRoom.id,
        title: createdRoom.title,
        dialogueType: createdRoom.dialogueType || 'not set'
      });
      
      if (createdRoom.pro) loggers.api.debug('Pro participants', { pro: createdRoom.pro });
      if (createdRoom.con) loggers.api.debug('Con participants', { con: createdRoom.con });
      if (createdRoom.neutral) loggers.api.debug('Neutral participants', { neutral: createdRoom.neutral });
      
      // Socket.IO 이벤트 발생 (서버에 Socket.IO 인스턴스가 있는 경우)
      if (res.socket.server.io) {
        loggers.api.debug('Broadcasting room-created event');
        res.socket.server.io.emit('room-created', createdRoom);
      } else {
        loggers.api.warn('Socket.IO server not available, could not broadcast room-created event');
      }

      return res.status(201).json(createdRoom);
    } catch (error) {
      loggers.api.error('Error creating chat room', error);
      return res.status(500).json({ error: 'Failed to create chat room' });
    }
  }

  // PUT 요청 - 채팅룸 업데이트 (메시지 추가 등)
  if (req.method === 'PUT') {
    try {
      loggers.api.info('Processing PUT request - updating chat room');
      
      // id 또는 roomId 파라미터 중 하나를 사용
      const roomId = req.query.id || req.query.roomId;
      
      if (!roomId) {
        return res.status(400).json({ error: 'Room ID is required' });
      }
      
      const roomIdStr = Array.isArray(roomId) ? roomId[0] : roomId;
      loggers.api.debug('Room update request', { roomId: roomIdStr });
      
      // 채팅룸 존재 여부 확인
      const room = await chatRoomDB.getChatRoomById(roomIdStr);
      if (!room) {
        loggers.api.warn('Room not found for update', { roomId: roomIdStr });
        return res.status(404).json({ error: 'Chat room not found' });
      }
      
      const updates = req.body;
      loggers.api.debug('Updating room with data', { roomId: roomIdStr, updates });
      
      // 메시지 추가 처리
      if (updates.message) {
        const { message } = updates;
        loggers.api.debug('Adding new message', {
          sender: message.sender,
          messageId: message.id,
          hasText: !!message.text
        });
        loggers.api.debug('Complete message data', message);
        
        // 디버깅: citations 필드 확인
        if (message.citations) {
          loggers.api.debug('Citations included', { citations: message.citations });
        } else {
          loggers.api.debug('No citations information', { 
            citationsField: message.citations 
          });
        }
        
        // 클라이언트에서 오는 메시지 객체가 citations 필드를 가지고 있지만 
        // undefined로 설정된 경우를 처리
        if (message.hasOwnProperty('citations') && message.citations === undefined) {
          loggers.api.debug('Citations field is undefined, removing from message');
          delete message.citations;
        }
        
        // 클라이언트 상태에서 citations가 빈 배열이나 null인 경우도 처리
        if (message.citations && Array.isArray(message.citations) && message.citations.length === 0) {
          loggers.api.debug('Citations is empty array, removing from message');
          delete message.citations;
        }
        
        const success = await chatRoomDB.addMessage(roomIdStr, message);
        
        if (success) {
          loggers.api.debug('Added new message to room', {
            roomId: roomIdStr,
            sender: message.sender,
            messageCount: (room.messages?.length ?? 0) + 1
          });
          
          // Socket.IO 이벤트 발생 (서버에 Socket.IO 인스턴스가 있는 경우)
          if (res.socket.server.io) {
            loggers.api.debug('Broadcasting message-added event');
            // 메시지와 함께 roomId도 전송하여 클라이언트에서 올바르게 처리할 수 있도록 함
            const socketData = {
              roomId: roomIdStr,
              message: message
            };
            loggers.api.debug('Socket.IO broadcast data', socketData);
            res.socket.server.io.to(roomIdStr).emit('new-message', socketData);
            loggers.api.info('Broadcast completed', {
              roomId: roomIdStr,
              messageId: message.id
            });
          } else {
            loggers.api.warn('Socket.IO server not initialized, cannot broadcast');
          }
        } else {
          loggers.api.debug('Duplicate message skipped', { messageId: message.id });
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
      loggers.api.error('Error updating chat room', error);
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