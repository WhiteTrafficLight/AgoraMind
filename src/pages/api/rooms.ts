import type { NextApiRequest, NextApiResponse } from 'next';
import type { Socket as NetSocket } from 'net';
import type { Server as HttpServer } from 'http';
import type { Server as SocketIOServer } from 'socket.io';
import { ChatRoom, ChatRoomCreationParams } from '@/lib/ai/chatService';
import chatRoomDB from '@/lib/db/chatRoomDB';
import mongoose from 'mongoose';

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
    console.log(...args);
  }
}

// MongoDB 연결 함수 추가
let isConnected = false;
const connectDB = async () => {
  if (isConnected) {
    console.log('MongoDB already connected');
    return;
  }

  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/agoramind';
    await mongoose.connect(mongoUrl);
    isConnected = true;
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
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
    console.log('API 요청 받음:', req.method, req.url);
  } else {
    log('API 요청 받음:', req.method, req.url);
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
      console.log('GET 요청 처리 - 쿼리:', req.query);
      
      // ID로 특정 채팅룸 필터링
      const { id } = req.query;
      if (id) {
        console.log(`ID ${id}로 채팅룸 검색 중`);
        // 배열인 경우 첫 번째 값만 사용
        const roomId = Array.isArray(id) ? id[0] : id;
        
        // 문자열인 경우 숫자로 변환 시도
        const numericRoomId = !isNaN(Number(roomId)) ? Number(roomId) : roomId;
        
        // 데이터베이스에서 채팅룸 조회
        const room = await chatRoomDB.getChatRoomById(numericRoomId);
        console.log('검색 결과:', room ? '찾음' : '없음');
        
        // 아이디 일치 여부 확인
        if (room && String(room.id) !== String(numericRoomId)) {
          console.error(`❌ 잘못된 방 ID: 요청=${numericRoomId}, 반환=${room.id}`);
          return res.status(200).json(null);
        }
        
        if (room) {
          console.log(`채팅룸 ${roomId} 정보:`, {
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
          console.warn(`중복 채팅룸 ID 발견: ${room.id}, ${room.title}`);
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
      console.error('Error getting chat rooms:', error);
      return res.status(500).json({ error: 'Failed to get chat rooms' });
    }
  }

  // POST 요청 - 새 채팅룸 생성
  if (req.method === 'POST') {
    try {
      console.log('POST 요청 처리 - 채팅룸 생성');
      
      const params = req.body as ChatRoomCreationParams;
      console.log('📢 요청 본문:', JSON.stringify(params, null, 2));
      console.log('📢 대화 타입:', params.dialogueType);
      
      if (params.dialogueType === 'debate') {
        console.log('📢 찬반토론 모드 감지됨');
        console.log('📢 npcPositions:', JSON.stringify(params.npcPositions));
        console.log('📢 사용자 역할:', params.userDebateRole);
      }

      // 유효성 검사
      if (!params.title || !params.title.trim()) {
        console.log('오류: 제목 없음');
        return res.status(400).json({ error: 'Chat room title is required' });
      }

      if (!params.npcs || !Array.isArray(params.npcs) || params.npcs.length === 0) {
        console.log('오류: NPC 없음');
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
            console.log('✅ 사용자 프로필에서 username 가져옴:', currentUser);
          } else {
            throw new Error('User profile not found');
          }
        } catch (error) {
          console.warn('⚠️ 사용자 프로필 가져오기 실패, 랜덤 이름 생성:', error);
          currentUser = `User_${Math.floor(Math.random() * 10000)}`;
        }
      }
      
      console.log('📢 최종 사용자명:', currentUser);

      // 새 채팅룸 객체 생성
      const newRoom: ChatRoom = {
        id: Date.now(),
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
        console.log('📢 찬반토론 정보 설정 중');
        
        // pro, con, neutral 초기화
        newRoom.pro = [];
        newRoom.con = [];
        newRoom.neutral = [];
        
        // NPC 위치 설정
        for (const npcId of params.npcs) {
          const position = params.npcPositions[npcId];
          if (position === 'pro') {
            newRoom.pro.push(npcId);
            console.log(`📢 NPC를 PRO에 추가: ${npcId}`);
          } else if (position === 'con') {
            newRoom.con.push(npcId);
            console.log(`📢 NPC를 CON에 추가: ${npcId}`);
          } else {
            newRoom.neutral.push(npcId);
            console.log(`📢 NPC를 NEUTRAL에 추가: ${npcId}`);
          }
        }
        
        // 사용자 위치 설정
        if (params.userDebateRole) {
          console.log(`📢 사용자 역할: ${params.userDebateRole}`);
          if (params.userDebateRole === 'pro') {
            newRoom.pro.push(currentUser);
            console.log(`📢 사용자를 PRO에 추가: ${currentUser}`);
          } else if (params.userDebateRole === 'con') {
            newRoom.con.push(currentUser);
            console.log(`📢 사용자를 CON에 추가: ${currentUser}`);
          } else { // neutral
            newRoom.neutral.push(currentUser);
            console.log(`📢 사용자를 NEUTRAL에 추가: ${currentUser}`);
          }
        } else {
          // 기본값은 neutral
          newRoom.neutral.push(currentUser);
          console.log(`📢 역할이 지정되지 않아 사용자를 NEUTRAL에 추가: ${currentUser}`);
        }
        
        console.log(`📢 최종 Pro 목록: ${newRoom.pro.join(', ')}`);
        console.log(`📢 최종 Con 목록: ${newRoom.con.join(', ')}`);
        console.log(`📢 최종 Neutral 목록: ${newRoom.neutral.join(', ')}`);

        // 디베이트 모드에서는 파이썬 API 서버에 모더레이터 메시지 생성 요청
        if (params.dialogueType === 'debate' && params.generateInitialMessage) {
          try {
            console.log('📢 파이썬 API 서버에 모더레이터 메시지 생성 요청 시작');
            
            // 파이썬 API 서버 URL (환경 변수 또는 기본값)
            const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:8000';
            
            // Pro/Con 참가자(NPC+유저) 목록 생성
            // NPC와 유저를 모두 포함하는 전체 pro/con 배열 사용
            const proNpcIds = newRoom.pro || [];
            const conNpcIds = newRoom.con || [];

            console.log(`📢 모더레이터 메시지 위한 proNpcIds: ${proNpcIds.join(', ')} (${proNpcIds.length}개)`);
            console.log(`📢 모더레이터 메시지 위한 conNpcIds: ${conNpcIds.join(', ')} (${conNpcIds.length}개)`);
            
            // 유저 이름 매핑 객체 (User123 -> WhiteTrafficLight 등)
            const userData: Record<string, string> = {};
            
            // 유저 ID -> 표시명 매핑 (요청 파라미터 중 username 확인)
            if (params.username) {
              // 사용자 ID가 사용자 이름과 다른 경우에만 매핑에 추가
              if (currentUser !== params.username) {
                userData[currentUser] = params.username;
                console.log(`📢 유저 이름 매핑 추가: ${currentUser} -> ${params.username}`);
              }
              console.log(`📢 실제 사용자 이름(username)을 사용: ${params.username}`);
            }
            
            // NPC 이름 정보 조회 및 매핑 생성
            console.log('📢 NPC 이름 정보 조회 시작');
            console.log(`📢 NPC 포지션 정보: ${JSON.stringify(params.npcPositions)}`);
            
            // NPC ID -> 이름 매핑 객체
            const npcNames: Record<string, string> = {};
            
            // 모든 NPC ID 목록 (중복 제거)
            const allNpcIds = [...new Set([...proNpcIds, ...conNpcIds])].filter(id => id !== currentUser);
            
            // 각 NPC에 대해 이름 조회
            for (const npcId of allNpcIds) {
              console.log(`🔍 Fetching NPC details for ID: ${npcId}`);
              
              try {
                // 먼저 UUID 형태인지 확인
                let isUuid = false;
                try {
                  // UUID 형식인지 확인
                  if (npcId.length > 30 && npcId.includes('-')) {
                    isUuid = true;
                    console.log(`🔍 Searching by backend_id (UUID): ${npcId}`);
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
                      console.log(`✅ Found custom NPC: ${customNpc.name}`);
                      console.log(`   _id: ${customNpc._id}, backend_id: ${npcId}`);
                      
                      // 매핑에 추가
                      npcNames[npcId] = customNpc.name;
                      continue; // 찾았으므로 다음 NPC로
                    } else {
                      console.log(`⚠️ Custom NPC not found with backend_id: ${npcId}`);
                    }
                  } catch (dbError) {
                    console.error(`❌ MongoDB error: ${dbError}`);
                  }
                }
                
                // 2. API를 통해 조회
                const apiUrl = `${pythonApiUrl}/api/npc/get?id=${npcId}`;
                console.log(`🔄 Trying backend API at ${apiUrl}`);
                
                const response = await fetch(apiUrl);
                if (response.ok) {
                  const npcData = await response.json();
                  if (npcData && npcData.name) {
                    console.log(`✅ Got NPC details from backend: ${npcData.name}`);
                    console.log(`📢 NPC 이름 매핑 추가: ${npcId} -> ${npcData.name}`);
                    console.log(`📢 NPC 정보 조회 결과: ${JSON.stringify(npcData).substring(0, 100)}...`);
                    
                    // 매핑에 추가
                    npcNames[npcId] = npcData.name;
                  } else {
                    console.log(`⚠️ API returned data without name for NPC: ${npcId}`);
                  }
                } else {
                  console.log(`⚠️ Failed to get NPC details: ${response.status}`);
                  
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
                    console.log(`📢 기본 철학자 이름 사용: ${npcId} -> ${defaultName}`);
                    npcNames[npcId] = defaultName;
                  } else if (isUuid) {
                    console.log(`❌ 심각: 커스텀 NPC(${npcId})의 실제 이름을 찾지 못했습니다!`);
                    console.log(`📢 기본 이름 사용: ${npcId} -> Unknown Philosopher`);
                    npcNames[npcId] = "Unknown Philosopher";
                  } else {
                    console.log(`📢 기본 이름 사용: ${npcId} -> ${npcId}`);
                    npcNames[npcId] = npcId.charAt(0).toUpperCase() + npcId.slice(1);
                  }
                }
              } catch (error) {
                console.error(`❌ Error fetching NPC details: ${error}`);
              }
            }
            
            console.log(`📢 최종 NPC 이름 정보: ${JSON.stringify(npcNames)}`);
            
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
            
            console.log(`📢 Python API 요청 데이터 (새 방식): ${JSON.stringify(requestData, null, 2)}`);
            
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
              console.log(`📢 Python API 응답 성공 (새 방식): ${JSON.stringify(responseData)}`);
              
              // 성공 응답 확인
              if (responseData.status === 'success') {
                console.log(`📢 DebateDialogue 인스턴스 생성 및 자동 진행 시작됨`);
                console.log(`📢 현재 단계: ${responseData.debate_info?.current_stage}`);
                console.log(`📢 Pro 참가자: ${responseData.debate_info?.pro_participants?.join(', ')}`);
                console.log(`📢 Con 참가자: ${responseData.debate_info?.con_participants?.join(', ')}`);
                
                // 파이썬 백엔드에서 확인된 실제 room_id 사용
                newRoom.id = responseData.room_id;
                console.log(`📢 파이썬 백엔드 확인된 room_id 사용: ${responseData.room_id}`);
                
                // 토론방 정보를 newRoom에 추가 (필요시 프론트엔드에서 참조 가능)
                newRoom.debate_info = responseData.debate_info;
                
                console.log(`📢 토론방 생성 완료 - 백그라운드에서 자동 진행 중`);
              } else {
                console.error(`❌ Python API 응답 오류: ${responseData.message || 'Unknown error'}`);
                throw new Error(`Python API 응답 오류: ${responseData.message || 'Unknown error'}`);
              }
            } else {
              const errorText = await apiResponse.text();
              console.error(`❌ Python API 요청 실패: ${apiResponse.status} ${apiResponse.statusText}`);
              console.error(`❌ Python API 오류 메시지: ${errorText}`);
              throw new Error(`Python API 요청 실패: ${apiResponse.status} ${apiResponse.statusText}`);
            }
          } catch (error) {
            console.error(`❌ moderator opening 메시지 생성 중 오류: ${error}`);
          }
        }
      }

      // 채팅룸 데이터베이스에 저장
      console.log('📢 채팅룸 저장 전 최종 객체:', JSON.stringify(newRoom, null, 2));
      const createdRoom = await chatRoomDB.createChatRoom(newRoom);

      console.log(`✅ Chat room created with ID: ${createdRoom.id}, title: "${createdRoom.title}"`);
      console.log(`✅ dialogueType: ${createdRoom.dialogueType || 'not set'}`);
      
      if (createdRoom.pro) console.log(`✅ Pro: ${createdRoom.pro.join(', ')}`);
      if (createdRoom.con) console.log(`✅ Con: ${createdRoom.con.join(', ')}`);
      if (createdRoom.neutral) console.log(`✅ Neutral: ${createdRoom.neutral.join(', ')}`);
      
      // Socket.IO 이벤트 발생 (서버에 Socket.IO 인스턴스가 있는 경우)
      if (res.socket.server.io) {
        console.log('Broadcasting room-created event');
        res.socket.server.io.emit('room-created', createdRoom);
      } else {
        console.warn('Socket.IO server not available, could not broadcast room-created event');
      }

      return res.status(201).json(createdRoom);
    } catch (error) {
      console.error('Error creating chat room:', error);
      return res.status(500).json({ error: 'Failed to create chat room' });
    }
  }

  // PUT 요청 - 채팅룸 업데이트 (메시지 추가 등)
  if (req.method === 'PUT') {
    try {
      console.log('PUT 요청 처리 - 채팅룸 업데이트');
      
      // id 또는 roomId 파라미터 중 하나를 사용
      const roomId = req.query.id || req.query.roomId;
      
      if (!roomId) {
        return res.status(400).json({ error: 'Room ID is required' });
      }
      
      const roomIdStr = Array.isArray(roomId) ? roomId[0] : roomId;
      console.log(`룸 업데이트 요청: ID ${roomIdStr}`);
      
      // 채팅룸 존재 여부 확인
      const room = await chatRoomDB.getChatRoomById(roomIdStr);
      if (!room) {
        console.log(`방을 찾을 수 없음: ${roomIdStr}`);
        return res.status(404).json({ error: 'Chat room not found' });
      }
      
      const updates = req.body;
      console.log(`Updating room ${roomIdStr} with:`, updates);
      
      // 메시지 추가 처리
      if (updates.message) {
        const { message } = updates;
        console.log(`새 메시지 추가: ${message.sender}의 메시지, ID: ${message.id}`);
        console.log(`📋 메시지 전체 데이터: ${JSON.stringify(message)}`);
        
        // 디버깅: citations 필드 확인
        if (message.citations) {
          console.log(`📚 인용 정보 포함됨: ${JSON.stringify(message.citations)}`);
        } else {
          console.log(`⚠️ 인용 정보 없음 (citations 필드: ${message.citations})`);
        }
        
        // 클라이언트에서 오는 메시지 객체가 citations 필드를 가지고 있지만 
        // undefined로 설정된 경우를 처리
        if (message.hasOwnProperty('citations') && message.citations === undefined) {
          console.log(`⚠️ citations 필드가 undefined로 설정됨, 삭제 중...`);
          delete message.citations;
        }
        
        // 클라이언트 상태에서 citations가 빈 배열이나 null인 경우도 처리
        if (message.citations && Array.isArray(message.citations) && message.citations.length === 0) {
          console.log(`⚠️ citations가 빈 배열임, 삭제 중...`);
          delete message.citations;
        }
        
        const success = await chatRoomDB.addMessage(roomIdStr, message);
        
        if (success) {
          console.log(`룸 ${roomIdStr}에 ${message.sender}의 새 메시지 추가됨`);
          
          // Socket.IO 이벤트 발생 (서버에 Socket.IO 인스턴스가 있는 경우)
          if (res.socket.server.io) {
            console.log('Broadcasting message-added event');
            // 메시지와 함께 roomId도 전송하여 클라이언트에서 올바르게 처리할 수 있도록 함
            const socketData = {
              roomId: roomIdStr,
              message: message
            };
            console.log(`🔄 Socket.IO 브로드캐스트 데이터: ${JSON.stringify(socketData)}`);
            res.socket.server.io.to(roomIdStr).emit('new-message', socketData);
            console.log(`✅ 브로드캐스트 완료 - 방 ID: ${roomIdStr}, 메시지 ID: ${message.id}`);
          } else {
            console.warn(`❌ Socket.IO 서버가 초기화되지 않아 브로드캐스트할 수 없음`);
          }
        } else {
          console.log(`중복 메시지 건너뜀, ID: ${message.id}`);
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
      console.error('Error updating chat room:', error);
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