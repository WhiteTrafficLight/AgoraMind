// Types
export interface Citation {
  id: string;       // 각주 ID (예: "1", "2")
  text: string;     // 원문 텍스트
  source: string;   // 출처 (책 이름)
  location?: string; // 위치 정보 (선택사항)
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  isUser: boolean;
  timestamp: Date;
  citations?: Citation[]; // 인용 정보 배열 추가
}

export interface ChatRoom {
  id: number; // 항상 숫자로 통일
  title: string;
  context?: string;
  participants: {
    users: string[];
    npcs: string[];
  };
  totalParticipants: number;
  lastActivity: string;
  messages?: ChatMessage[];
  isPublic: boolean;
  npcDetails?: NpcDetail[]; // NPC 상세 정보 추가
  initial_message?: ChatMessage; // 서버에서 생성된 초기 메시지
  dialogueType?: string; // Modified to accept any string value from database
  // 찬반토론을 위한 필드 추가
  pro?: string[]; // 찬성측 참여자들 (NPC IDs와 사용자)
  con?: string[]; // 반대측 참여자들 (NPC IDs와 사용자)
  neutral?: string[]; // 중립 참여자들 (NPC IDs와 사용자)
}

// NPC 상세 정보 인터페이스 추가
export interface NpcDetail {
  id: string;
  name: string;
  description?: string;
  communication_style?: string;
  debate_approach?: string;
  voice_style?: string;
  portrait_url?: string;
  reference_philosophers?: string[];
  is_custom: boolean;
  created_by?: string;
}

export interface ChatRoomCreationParams {
  title: string;
  context?: string;
  contextUrl?: string;
  contextFileContent?: string;
  maxParticipants: number;
  npcs: string[];
  isPublic?: boolean;
  currentUser?: string;
  generateInitialMessage?: boolean;
  llmProvider?: string;
  llmModel?: string;
  dialogueType?: string; // 대화 패턴 타입 추가
  npcPositions?: Record<string, 'pro' | 'con'>; // 찬반토론을 위한 NPC 입장 정보
  userDebateRole?: 'pro' | 'con' | 'neutral'; // 찬반토론에서 사용자의 역할
}

// 디버그 모드 설정 - 로깅 제어용
const DEBUG = false;

// Enhanced logging function for better debugging
function log(...args: any[]) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[ChatService]', ...args);
  }
}

// Helper function to safely parse JSON and detect HTML responses
async function safeParseJson(response: Response): Promise<any> {
  // Check content type before reading the response
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    log('⚠️ WARNING: Response has HTML content type');
    const text = await response.text();
    console.error('Received HTML response from API:', text.substring(0, 500));
    throw new Error(`API returned HTML instead of JSON. Status: ${response.status}`);
  }
  
  const text = await response.text();
  
  // Debug the raw response
  log('Raw API response:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
  
  // Check if response is HTML (indication of an error page)
  if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
    log('⚠️ WARNING: Received HTML response instead of JSON');
    console.error('Received HTML response from API:', text.substring(0, 500));
    throw new Error(`API returned HTML instead of JSON. Status: ${response.status}`);
  }
  
  // If empty response
  if (!text.trim()) {
    log('⚠️ WARNING: Received empty response');
    return null;
  }
  
  // Try to parse JSON
  try {
    return JSON.parse(text);
  } catch (error) {
    log('⚠️ ERROR: Failed to parse JSON response');
    console.error('Response parsing error:', error);
    console.error('Response text:', text.substring(0, 500));
    throw new Error(`Invalid JSON response. Status: ${response.status}`);
  }
}

// Updated service that can use real API calls
class ChatService {
  // API 기반으로 동작하도록 변경 - mock 데이터 제거
  private chatRooms: ChatRoom[] = [];
  private useAPI: boolean = true;
  
  // 캐시 관련 변수 및 상수 추가
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5분
  private cacheTimestamps: Record<number, number> = {};

  // 생성자 - API 사용 여부 설정 가능
  constructor(useAPI: boolean = true) {
    this.useAPI = useAPI;
  }
  
  // ID 표준화 유틸리티 함수 - 숫자로 통일
  private normalizeId(id: string | number): number {
    if (id === null || id === undefined) {
      console.error('normalizeId: Null or undefined ID provided');
      return 0; // 유효하지 않은 ID는 0으로 처리
    }
    
    // 문자열이면 앞뒤 공백 제거 후 숫자로 변환
    const strId = typeof id === 'string' ? id.trim() : String(id);
    const numId = Number(strId);
    
    // NaN 체크
    if (isNaN(numId)) {
      console.error(`ID 정규화 오류: "${strId}"는 숫자로 변환할 수 없음`);
      return 0; // 변환 불가능한 경우 0 반환
    }
    
    console.log(`ID 정규화: ${id} (${typeof id}) -> ${numId} (숫자)`);
    return numId;
  }
  
  // 캐시 유효성 확인 메서드
  private isCacheValid(id: number): boolean {
    const timestamp = this.cacheTimestamps[id];
    if (!timestamp) return false;
    
    const now = Date.now();
    return (now - timestamp) < this.CACHE_TTL;
  }
  
  // 캐시 업데이트 메서드
  private updateCache(room: ChatRoom): void {
    // 항상 room.id가 있는지 확인
    if (room.id === null || room.id === undefined) {
      console.error('❌ Attempted to cache room with no ID', room);
      return;
    }
    
    const normalizedId = this.normalizeId(room.id);
    
    // 디버그 정보 추가
    console.log(`🔄 Updating cache for room ${normalizedId} (original ID: ${room.id}, type: ${typeof room.id})`);
    
    // ID를 숫자로 통일
    room.id = normalizedId;
    
    // 새로운 객체로 복사하여 완전히 격리
    const isolatedRoom: ChatRoom = JSON.parse(JSON.stringify(room));
    
    // 기존 캐시 항목 찾기
    const existingIndex = this.chatRooms.findIndex(r => r.id === normalizedId);
    
    if (existingIndex >= 0) {
      this.chatRooms[existingIndex] = isolatedRoom;
      console.log(`✅ Updated existing cache entry for room ${normalizedId}`);
    } else {
      this.chatRooms.push(isolatedRoom);
      console.log(`✅ Added new cache entry for room ${normalizedId}`);
    }
    
    // 캐시 타임스탬프 업데이트
    this.cacheTimestamps[normalizedId] = Date.now();
  }

  // Get all chat rooms - API 요청으로 대체
  async getChatRooms(): Promise<ChatRoom[]> {
    try {
      log('Fetching chat rooms from API...');
      
      // 재시도 로직 추가
      const MAX_RETRIES = 3;
      let retryCount = 0;
      let response: Response | undefined;
      
      while (retryCount < MAX_RETRIES) {
        try {
          response = await fetch('/api/rooms');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch chat rooms: ${response.status}`);
          }
          
          break; // 성공하면 루프 종료
        } catch (error) {
          retryCount++;
          console.error(`API call failed (attempt ${retryCount}/${MAX_RETRIES}):`, error);
          
          if (retryCount >= MAX_RETRIES) {
            throw error; // 최대 재시도 횟수 초과
          }
          
          // 지수 백오프 (1초, 2초, 4초...)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
        }
      }

      if (!response) {
        throw new Error('No response received from API after maximum retries');
      }
      
      const data = await response.json();
      log(`Fetched ${data.length} chat rooms from API`);
      
      // 중복 ID 제거 (동일한 ID의 첫 번째 채팅방만 유지)
      const uniqueRooms = data.reduce((acc: ChatRoom[], room: ChatRoom) => {
        // 이미 같은 ID의 방이 있는지 확인
        const normalizedId = this.normalizeId(room.id);
        const exists = acc.some((r: ChatRoom) => this.normalizeId(r.id) === normalizedId);
        if (!exists) {
          acc.push(room);
        } else {
          console.warn(`중복 채팅방 ID 발견: ${normalizedId}, 제목: ${room.title}`);
        }
        return acc;
      }, [] as ChatRoom[]);
      
      // 유니크한 채팅방 ID 로깅
      const uniqueIds = uniqueRooms.map((room: ChatRoom) => room.id);
      console.log(`유니크한 채팅방 ID: ${uniqueIds.join(', ')}`);
      
      // API 응답으로 로컬 캐시 업데이트
      this.chatRooms = uniqueRooms;
      
      // 캐시 타임스탬프 업데이트
      uniqueRooms.forEach((room: ChatRoom) => {
        const normalizedId = this.normalizeId(room.id);
        this.cacheTimestamps[normalizedId] = Date.now();
      });
      
      return uniqueRooms;
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
      return this.chatRooms; // 오류 시 캐싱된 데이터 반환
    }
  }

  // Helper to generate a unique ID
  private generateUniqueId(prefix: string = ''): string {
    // Using UUID-like format with timestamp and random components
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const randomStr2 = Math.random().toString(36).substring(2, 10);
    return `${prefix}${timestamp}-${randomStr}-${randomStr2}`;
  }

  // Get a specific chat room by ID - 개선된 버전
  async getChatRoomById(id: string | number): Promise<ChatRoom | null> {
    const normalizedId = this.normalizeId(id);
    
    log('\n=======================================');
    log('🔍 FETCHING CHAT ROOM');
    log('ID:', normalizedId, `(원본: ${id}, 타입: ${typeof id})`);
    
    // 1. 먼저 캐시 확인
    const cachedRoom = this.chatRooms.find(room => this.normalizeId(room.id) === normalizedId);
    
    // 유효한 캐시가 있으면 사용
    if (cachedRoom && this.isCacheValid(normalizedId)) {
      log(`✅ Using valid cache for room ${normalizedId}`);
      // ID를 명시적으로 문자열로 설정하고 깊은 복사본 반환
      const roomCopy = JSON.parse(JSON.stringify(cachedRoom));
      roomCopy.id = normalizedId;
      return roomCopy;
    }
    
    // 2. API 요청
    try {
      log(`🔄 Fetching room ${normalizedId} from API`);
      
      // 재시도 로직 추가
      const MAX_RETRIES = 3;
      let retryCount = 0;
      let response: Response | undefined;
      
      while (retryCount < MAX_RETRIES) {
        try {
          response = await fetch(`/api/rooms?id=${normalizedId}`);
      
          if (!response.ok) {
            // 상태 코드별 세분화된 오류 처리
            if (response.status === 404) {
              log(`❌ Room ${normalizedId} not found`);
              return null;
            }
            throw new Error(`Failed to fetch chat room: ${response.status}`);
          }
          
          break; // 성공하면 루프 종료
        } catch (error) {
          retryCount++;
          console.error(`API call failed (attempt ${retryCount}/${MAX_RETRIES}):`, error);
          
          if (retryCount >= MAX_RETRIES) {
            throw error; // 최대 재시도 횟수 초과
          }
          
          // 지수 백오프 (1초, 2초, 4초...)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
        }
      }
      
      if (!response) {
        throw new Error('No response received from API after maximum retries');
      }
      
      const room = await response.json();
      
      // ID가 없는 경우 처리
      if (!room || !room.id) {
        log(`❌ Invalid room data received for ID ${normalizedId}`);
        return null;
      }
      
      // ID 일치 여부 확인 (항상 문자열로 비교)
      const responseId = this.normalizeId(room.id);
      if (responseId !== normalizedId) {
        log(`⚠️ ID 불일치 감지: 요청=${normalizedId}, 응답=${responseId}`);
        log(`⚠️ 문자열 변환 후 재확인 중...`);
        
        // 다시 한번 문자열 변환 후 비교 (ID 타입 불일치 처리)
        if (String(responseId) !== String(normalizedId)) {
          log(`❌ ID 불일치 확인됨: 요청=${normalizedId}, 응답=${responseId}`);
          return null;
        }
        
        log(`✅ 문자열 변환 후 ID 일치 확인됨`);
        // ID를 정규화하여 명시적으로 설정
        room.id = normalizedId;
      }
      
      log('✅ Room found!');
      log('Room ID:', room.id, `(타입: ${typeof room.id})`);
      log('Room Title:', room.title);
      log('Participants:', room.participants);
      
      // 1. 참여자 유효성 검사
      if (!room.participants || !room.participants.npcs || room.participants.npcs.length === 0) {
        log('❌ Room has no participants!');
        
        // 참여자가 없는 방은 사용할 수 없음을 명확히 함
        return {
          ...room,
          id: normalizedId, // ID를 명시적으로 문자열로 설정
          messages: []
        };
      }
      
      // 2. 이 채팅방에 등록된 철학자 목록 (복사본 생성)
      const registeredPhilosophers = [...room.participants.npcs];
      log('Registered philosophers:', registeredPhilosophers);
      
      // 3. 메시지 초기화 (아직 없는 경우)
      if (!room.messages) {
        room.messages = [];
      }
      
      // 4. System 메시지 및 Welcome 메시지 제거
      if (room.messages.length > 0) {
        const initialMessageCount = room.messages.length;
        room.messages = room.messages.filter((msg: ChatMessage) => 
          msg.sender !== 'System' && 
          !(msg.text && msg.text.toLowerCase().startsWith("welcome to"))
        );
        
        if (initialMessageCount !== room.messages.length) {
          log(`🧹 Removed ${initialMessageCount - room.messages.length} system or welcome messages`);
        }
      }
      
      // 5. NPC 정보 로드
      if (!room.npcDetails || room.npcDetails.length === 0) {
        log('🔄 Loading NPC details for participants');
        room.npcDetails = await this.loadNpcDetails(registeredPhilosophers);
      }
      
      // 6. 초기 메시지 처리
      if (room.initial_message) {
        log('📝 Processing initial message');
        
        // 빈 메시지가 아닌지 확인
        if (room.initial_message.text && room.initial_message.text.trim() !== "") {
          
          // System 메시지가 아닌지, Welcome 메시지가 아닌지 확인
          if (room.initial_message.sender !== 'System' && 
              !room.initial_message.text.toLowerCase().startsWith("welcome to")) {
            
            log('✅ Valid initial message found, adding to message list');
            log('Message:', room.initial_message);
            
            // 중복 메시지가 아닌지 확인 
            const isDuplicate = room.messages.some((msg: ChatMessage) => 
              msg.text === room.initial_message.text && 
              msg.sender === room.initial_message.sender && 
              !msg.isUser
            );
            
            if (!isDuplicate) {
              room.messages.push(room.initial_message);
            } else {
              log('⚠️ Duplicate initial message detected, not adding');
            }
          } else {
            log('⚠️ System or welcome initial message detected, not adding');
          }
        } else {
          log('⚠️ Empty initial message detected, not adding');
        }
        
        // 사용 후 삭제하여 중복 방지
        delete room.initial_message;
      }
      
      // ID를 명시적으로 문자열로 설정
      room.id = normalizedId;
      
      // 캐시 업데이트
      this.updateCache(room);
      
      log('✅ Room fetched successfully');
      log('=======================================\n');
      
      // 복사본 반환
      return JSON.parse(JSON.stringify(room));
    } catch (error) {
      log('❌ Error fetching chat room:', error);
      
      // 3. API 실패 시 유효하지 않더라도 캐시된 데이터 반환
      if (cachedRoom) {
        log(`⚠️ Using stale cache for room ${normalizedId} due to API error`);
        const roomCopy = JSON.parse(JSON.stringify(cachedRoom));
        roomCopy.id = normalizedId; // ID를 명시적으로 문자열로 설정
        return roomCopy;
      }
      
      return null;
    }
  }

  // Create a new chat room
  async createChatRoom(params: ChatRoomCreationParams): Promise<ChatRoom> {
    console.log('\n=======================================');
    console.log('🏗️ CREATING NEW CHAT ROOM');
    console.log('Title:', params.title);
    console.log('NPCs:', params.npcs);
    
    // 1. 유효성 검사 - 제목과 NPC 목록 필수
    if (!params.title || !params.title.trim()) {
      console.error('❌ ERROR: Chat room title is required');
      throw new Error('Chat room title is required');
    }
    
    if (!params.npcs || !Array.isArray(params.npcs) || params.npcs.length === 0) {
      console.error('❌ ERROR: At least one philosopher (NPC) is required');
      throw new Error('At least one philosopher is required');
    }
    
    try {
      // 2. 요청 준비 - generateInitialMessage 필드를 명시적으로 설정
      // 백엔드에서 "Welcome to..." 시스템 메시지를 생성하지 않도록 변경
      const requestData = {
        ...params,
        generateInitialMessage: true  // 의미 있는 초기 메시지 생성 요청
      };
      
      console.log('Request data:', JSON.stringify(requestData).substring(0, 200) + '...');
      
      // 3. API 요청
      const MAX_RETRIES = 3;
      let retryCount = 0;
      let response: Response | undefined;
      
      while (retryCount < MAX_RETRIES) {
        try {
          // 건강 체크 제거 - API 요청을 직접 진행
          console.log('🔄 Creating chat room via API...');
      
      // API 요청으로 채팅방 생성
          response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
        },
            body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
            const contentType = response.headers.get('content-type') || '';
            console.error(`❌ API error: ${response.status}, Content-Type: ${contentType}`);
            
            if (contentType.includes('text/html')) {
              const htmlError = await response.text();
              console.error('HTML error response:', htmlError.substring(0, 200));
              throw new Error(`Server returned HTML error page: ${response.status}`);
            }
            
        throw new Error(`Failed to create chat room: ${response.status}`);
      }
      
          break; // 성공하면 루프 종료
        } catch (error) {
          retryCount++;
          console.error(`API call failed (attempt ${retryCount}/${MAX_RETRIES}):`, error);
          
          if (retryCount >= MAX_RETRIES) {
            throw error; // 최대 재시도 횟수 초과
          }
          
          // 지수 백오프 (1초, 2초, 4초...)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
        }
      }
      
      if (!response) {
        throw new Error('No response received from API after maximum retries');
      }
      
      // 4. 서버 응답 처리
      let rawRoomData;
      try {
        rawRoomData = await safeParseJson(response);
      console.log('✅ Server created room:', rawRoomData.id, rawRoomData.title);
      } catch (error) {
        console.error('❌ Failed to parse API response:', error);
        throw new Error('Unable to parse API response: ' + (error as Error).message);
      }
      
      // 응답 데이터 검증
      if (!rawRoomData || !rawRoomData.id) {
        throw new Error('Invalid room data received from server');
      }
      
      // 5. 채팅방 객체 생성
      const newRoom: ChatRoom = JSON.parse(JSON.stringify(rawRoomData));
      
      // 6. 메시지 배열이 없으면 초기화
      if (!newRoom.messages) {
      newRoom.messages = [];
      }
      
      // 7. 초기 메시지 처리
      if (newRoom.initial_message) {
        console.log('📝 Processing initial message from server');
        console.log('Initial message:', newRoom.initial_message);
        
        // 빈 메시지가 아닌지 확인하고, 시스템 메시지가 아닌지 확인
        if (newRoom.initial_message.text && 
            newRoom.initial_message.text.trim() !== "" && 
            newRoom.initial_message.sender !== 'System' &&
            !newRoom.initial_message.text.toLowerCase().startsWith("welcome to")) {
          
          console.log('✅ Adding valid initial message to room');
          
          // 중복 메시지가 아닌지 확인
          const isDuplicate = newRoom.messages.some(msg => 
            msg.text === newRoom.initial_message?.text && 
            msg.sender === newRoom.initial_message?.sender
          );
          
          if (!isDuplicate) {
            // 초기 메시지를 messages 배열에 추가
            newRoom.messages.push(newRoom.initial_message);
            console.log('✅ Added initial message to room');
          } else {
            console.log('⚠️ Duplicate initial message detected, not adding');
          }
        } else {
          console.log('⚠️ Invalid initial message detected (empty or system message), not adding');
          
          // 빈 메시지가 생성된 경우 우리가 직접 유의미한 메시지 생성
          if (!newRoom.initial_message.text || newRoom.initial_message.text.trim() === "") {
            console.log('🔄 Generating meaningful initial message as replacement');
            
            try {
              // NPC 상세 정보가 없는 경우 로드
              if (!newRoom.npcDetails) {
                console.log('🔄 Loading NPC details for message generation');
                newRoom.npcDetails = await this.loadNpcDetails(newRoom.participants.npcs);
              }
              
              // 첫 번째 NPC 선택
              const firstNpc = newRoom.participants.npcs[0];
              const npcDetail = newRoom.npcDetails.find(npc => npc.id === firstNpc);
              
              if (npcDetail) {
                // 유의미한 초기 메시지 생성
                const messageText = this.getInitialPrompt(newRoom.title, newRoom.context);
                
                const newMessage: ChatMessage = {
                  id: this.generateUniqueId('initial-'),
                  text: messageText,
                  sender: npcDetail.name,
                  isUser: false,
                  timestamp: new Date()
                };
                
                console.log('✅ Created meaningful initial message:', newMessage);
                newRoom.messages.push(newMessage);
                
                // 새 메시지 서버에 저장
                await this.saveInitialMessage(newRoom.id, newMessage);
              }
            } catch (err) {
              console.error('❌ Failed to generate meaningful initial message:', err);
            }
          }
        }
        
        // 사용 후 삭제
        delete newRoom.initial_message;
      } else {
        console.log('⚠️ No initial message from server, attempting to generate one');
        
        try {
          // NPC 상세 정보가 없는 경우 로드
          if (!newRoom.npcDetails) {
            console.log('🔄 Loading NPC details for message generation');
            newRoom.npcDetails = await this.loadNpcDetails(newRoom.participants.npcs);
          }
          
          // 첫 번째 NPC 선택
          const firstNpc = newRoom.participants.npcs[0];
          const npcDetail = newRoom.npcDetails.find(npc => npc.id === firstNpc);
          
          if (npcDetail) {
            // 유의미한 초기 메시지 생성
            const messageText = this.getInitialPrompt(newRoom.title, newRoom.context);
            
            const newMessage: ChatMessage = {
              id: this.generateUniqueId('initial-'),
              text: messageText,
              sender: npcDetail.name,
              isUser: false,
              timestamp: new Date()
            };
            
            console.log('✅ Created fallback initial message:', newMessage);
            newRoom.messages.push(newMessage);
            
            // 새 메시지 서버에 저장
            const saved = await this.saveInitialMessage(newRoom.id, newMessage);
            if (saved) {
              console.log('✅ Saved fallback initial message to server');
          } else {
              console.error('❌ Failed to save fallback initial message');
            }
          }
        } catch (err) {
          console.error('❌ Failed to generate fallback initial message:', err);
        }
      }
      
      // 8. NPC 상세 정보 로드
      if (!newRoom.npcDetails) {
        console.log('🔄 Loading NPC details');
        newRoom.npcDetails = await this.loadNpcDetails(newRoom.participants.npcs);
      }
      
      // 9. 로컬 캐시 업데이트
      this.updateCache(newRoom);
      
      console.log(`✅ New chat room created: ${this.normalizeId(newRoom.id)}`);
      console.log('Final message count:', newRoom.messages.length);
      console.log('=======================================\n');
      
      return newRoom;
    } catch (error) {
      console.error('❌ Error creating chat room:', error);
      throw error;
    }
  }

  // NPC ID 리스트에서 상세 정보 로드
  async loadNpcDetails(npcIds: string[]): Promise<NpcDetail[]> {
    console.log(`🔄 Loading details for ${npcIds.length} NPCs:`, npcIds);
    
    const npcDetails: NpcDetail[] = [];
    
    for (const npcId of npcIds) {
      try {
        console.log(`🔄 Fetching details for NPC ID: "${npcId}"`);
        
        // 1. NPC ID가 24글자 ObjectID 형식인지 확인
        const isMongoId = /^[0-9a-f]{24}$/i.test(npcId);
        if (isMongoId) {
          console.log(`🔄 MongoDB ObjectID 형식 감지: "${npcId}"`);
        }
        
        // 재시도 로직 추가
        const MAX_RETRIES = 3;
        let retryCount = 0;
        let response: Response | undefined;
        
        while (retryCount < MAX_RETRIES) {
          try {
        // API에서 NPC 정보 가져오기
            console.log(`🔄 API 호출 시도 (${retryCount + 1}/${MAX_RETRIES}): /api/npc/get?id=${encodeURIComponent(npcId)}`);
            
            response = await fetch(`/api/npc/get?id=${encodeURIComponent(npcId)}`);
            
            if (!response.ok) {
              throw new Error(`API returned status ${response.status}`);
            }
            
            break; // 성공하면 루프 종료
          } catch (error) {
            retryCount++;
            console.error(`API call failed (attempt ${retryCount}/${MAX_RETRIES}):`, error);
            
            if (retryCount >= MAX_RETRIES) {
              throw error; // 최대 재시도 횟수 초과
            }
            
            // 지수 백오프 (1초, 2초, 4초...)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
          }
        }
        
        if (!response) {
          throw new Error('No response received from API after maximum retries');
        }
        
          const npcData = await response.json();
        console.log(`✅ Received NPC data for ${npcId}:`, npcData);

        if (response.ok) {
          // 커스텀 NPC인 경우 DB에서 실제 이름과 프로필 정보 사용
          const isCustomNpc = npcId.length > 30 && npcId.split('-').length === 5;
          const npcDetail: NpcDetail = {
            id: npcId, // 항상 원래 ID 유지 (변환 금지)
            name: npcData.name || (isCustomNpc ? `Custom Philosopher` : npcId),
            description: npcData.description,
            communication_style: npcData.communication_style,
            debate_approach: npcData.debate_approach,
            voice_style: npcData.voice_style,
            portrait_url: npcData.portrait_url,
            reference_philosophers: npcData.reference_philosophers,
            is_custom: npcData.is_custom || isCustomNpc,
            created_by: npcData.created_by
          };
          npcDetails.push(npcDetail);
          
          console.log(`✅ Loaded NPC: ${npcDetail.name}, ID: ${npcId}, Custom: ${isCustomNpc}`);
          if (npcDetail.portrait_url) {
            console.log(`✅ Portrait URL: ${npcDetail.portrait_url}`);
          }
        } else {
          console.warn(`⚠️ API returned status ${response.status} for NPC ID: ${npcId}`);
          // API가 성공적으로 응답했지만 오류 상태 코드인 경우 기본 정보 생성
          npcDetails.push(this.createDefaultNpcDetail(npcId));
        }
      } catch (error) {
        console.error(`❌ Error loading NPC details for ID: ${npcId}`, error);
        // 네트워크 오류 등의 경우에도 폴백 처리: 기본 정보 추가
        npcDetails.push(this.createDefaultNpcDetail(npcId));
      }
    }
    
    console.log(`✅ Loaded ${npcDetails.length} NPC details successfully:`, npcDetails.map(npc => `${npc.id} → ${npc.name}`));
    return npcDetails;
  }

  // 기본 NPC 상세 정보 생성 헬퍼 함수
  private createDefaultNpcDetail(npcId: string): NpcDetail {
    // MongoDB ObjectID 형식 확인 (24자 16진수)
    const isMongoId = /^[0-9a-f]{24}$/i.test(npcId);
    
    // NPC ID가 UUID 형식인지 확인 (커스텀 NPC인 경우)
    const isUuid = npcId.length > 30 && npcId.split('-').length === 5;
    
    if (isMongoId || isUuid) {
      // 커스텀 NPC인 경우
      console.log(`⚠️ Creating default detail for custom NPC: ${npcId}`);
      return {
        id: npcId,
        name: `Custom Philosopher`,
        description: "A custom philosopher character",
        communication_style: "balanced",
        debate_approach: "dialectical",
        voice_style: "conversational",
        is_custom: true
      };
    } else {
      // 기본 철학자인 경우
      // ID가 camelCase나 snake_case인 경우 형식화
      const formattedName = npcId
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^\w/, c => c.toUpperCase())
        .trim();
        
      console.log(`⚠️ Creating default detail for standard philosopher: ${formattedName}`);  
      return {
        id: npcId,
        name: formattedName,
        description: `A philosopher known as ${formattedName}`,
        is_custom: false
      };
    }
  }

  // Helper to generate initial prompts based on topic
  private getInitialPrompt(topic: string, context?: string): string {
    console.log('🔄 Generating initial prompt for topic:', topic);
    
    // 의미 있는 초기 메시지 제공
    const prompts = [
      `I find this topic of "${topic}" quite fascinating. What aspects of it interest you the most?`,
      `Let us explore "${topic}" together. What questions come to mind when you consider this subject?`,
      `The question of "${topic}" has intrigued philosophers for centuries. Where shall we begin our inquiry?`,
      `I've spent much time contemplating "${topic}". What is your perspective on this matter?`,
      `To understand "${topic}", we must first examine our assumptions. What do you believe to be true about this subject?`
    ];
    
    // If there's context, incorporate it into a custom prompt
    if (context && context.trim()) {
      const contextPrompt = `Given the context that ${context}, I'm curious about your thoughts on "${topic}"?`;
      console.log('✅ Generated context-specific prompt:', contextPrompt);
      return contextPrompt;
    }
    
    // Otherwise select a random prompt
    const randomIndex = Math.floor(Math.random() * prompts.length);
    const selectedPrompt = prompts[randomIndex];
    console.log('✅ Generated random prompt:', selectedPrompt);
    return selectedPrompt;
  }

  // Send user message to a chat room
  async sendMessage(roomId: string | number, message: string, username?: string): Promise<ChatMessage> {
    console.log(`🔄 Sending message to room ${roomId} from ${username || 'user'}`);

    try {
      // 1. 채팅방 정보 가져오기
      const room = await this.getChatRoomById(roomId);
      if (!room) {
        throw new Error(`Chat room with ID ${roomId} not found`);
      }

      // 2. 메시지 객체 생성
      const messageObj: ChatMessage = {
      id: this.generateUniqueId('user-'),
        text: message,
        sender: username || 'User',
      isUser: true,
      timestamp: new Date()
    };
    
      // 3. API 요청 준비
      const normalizedId = this.normalizeId(roomId);
      const requestBody = {
        roomId: normalizedId,
        message: {
          ...messageObj,
          timestamp: messageObj.timestamp instanceof Date 
            ? messageObj.timestamp.toISOString() 
            : messageObj.timestamp
        }
      };

      // 4. API 요청 - 사용자 메시지 저장
      const MAX_RETRIES = 3;
      let retryCount = 0;
      let response: Response | null = null;

      while (retryCount < MAX_RETRIES) {
        try {
          console.log(`🔄 Sending message to API`, requestBody);
          response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (!response) {
            throw new Error('No response received from API');
          }

          if (!response.ok) {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('text/html')) {
              const htmlResponse = await response.text();
              throw new Error(`API returned HTML error page: Status ${response.status}`);
            }
            throw new Error(`Failed to save message: ${response.status}`);
          }
          break;
        } catch (error) {
          retryCount++;
          console.error(`API call failed (attempt ${retryCount}/${MAX_RETRIES}):`, error);
          if (retryCount >= MAX_RETRIES) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
        }
      }

      // 5. 로컬 캐시 업데이트
      const roomIndex = this.chatRooms.findIndex(r => this.normalizeId(r.id) === normalizedId);
      if (roomIndex >= 0) {
        if (!this.chatRooms[roomIndex].messages) {
          this.chatRooms[roomIndex].messages = [];
        }
        this.chatRooms[roomIndex].messages!.push(messageObj);
      }

      console.log(`✅ Message sent successfully`);
      return messageObj;
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  }

  // Get AI response for a chat room
  async getAIResponse(roomId: string | number): Promise<ChatMessage> {
    console.log(`🔄 Getting AI response for room ${roomId}`);

    try {
      // 1. 채팅방 정보 가져오기
      const room = await this.getChatRoomById(roomId);
      if (!room) {
        throw new Error(`Chat room with ID ${roomId} not found`);
      }

      // 2. NPC 정보가 없는 경우 로드
      if (!room.npcDetails || room.npcDetails.length === 0) {
        console.log('🔄 Loading NPC details for AI response');
        room.npcDetails = await this.loadNpcDetails(room.participants.npcs);
      }

      // 3. AI 응답 요청 준비
      const normalizedId = this.normalizeId(roomId);
      const topic = room.title;
      const context = room.context || '';
      
      // 4. 대화 기록 (최근 10개 메시지)
      const recentMessages = (room.messages || []).slice(-10);
      
      // 마지막 사용자 메시지 추출 (반드시 필요)
      const lastUserMessage = [...recentMessages].reverse().find(msg => msg.isUser);
      if (!lastUserMessage) {
        throw new Error("No user message found to generate response for");
      }
      
      // 5. Custom NPC 정보 구성 (AI 응답 생성에 사용)
      const npcDescriptions = room.npcDetails?.map(npc => {
        let description = `${npc.name}:`;
        if (npc.description) description += ` ${npc.description}`;
        if (npc.communication_style) description += `, Communication style: ${npc.communication_style}`;
        if (npc.debate_approach) description += `, Debate approach: ${npc.debate_approach}`;
        return description;
      }).join('\n\n') || '';

      // 6. 대화 내용 문자열화
      const dialogueText = recentMessages.map(msg => {
        // 대화 기록에서도 올바른 이름을 표시하기 위해 ID를 이름으로 변환
        let senderName = msg.sender;
        if (!msg.isUser) {
          const npc = room.npcDetails?.find(npc => npc.id === msg.sender);
          if (npc) senderName = npc.name;
        }
        return `${msg.isUser ? 'User' : senderName}: ${msg.text}`;
      }).join('\n');

      // 7. API 요청
      console.log(`🔄 Requesting AI response from API`);
      const response = await fetch('/api/chat/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-llm-provider': 'openai',
            'x-llm-model': 'gpt-4o'
          },
          body: JSON.stringify({
            npcs: room.participants.npcs,
            npc_descriptions: npcDescriptions,
            topic: topic,
            context: context,
            previous_dialogue: dialogueText,
            use_rag: true, // RAG 기능 활성화
            // 필수 필드 추가 - room_id를 문자열로 변환하여 전송
            room_id: String(normalizedId),
            user_message: lastUserMessage.text
          })
      });

      if (!response.ok) {
        throw new Error(`Failed to get AI response: ${response.status}`);
      }

      // 8. API 응답 처리
      const data = await response.json();
      console.log("📡 API 응답 전체 데이터:", JSON.stringify(data));
      
      // 9. 응답한 철학자 정보 찾기
      let respondingNpc = room.npcDetails?.find(npc => 
        npc.name.toLowerCase() === data.philosopher.toLowerCase()
      );
      
      // 응답한 철학자를 찾을 수 없는 경우 ID로 다시 검색
      if (!respondingNpc) {
        respondingNpc = room.npcDetails?.find(npc => 
          npc.id.toLowerCase() === data.philosopher.toLowerCase()
        );
      }
      
      // 그래도 없으면 첫 번째 철학자 사용
      if (!respondingNpc && room.npcDetails && room.npcDetails.length > 0) {
        respondingNpc = room.npcDetails[0];
      }

      // 10. 인용 정보 추출 - API 응답 구조 확인
      console.log("📝 인용 정보 확인 - API 응답에서 citations 필드:", data.citations);
      const citations = data.citations || [];
      console.log(`✅ 인용 정보 ${citations.length}개 추출됨:`, JSON.stringify(citations));

      // 11. 메시지 객체 생성 - 실제 이름 사용 및 인용 정보 포함
      const messageObj: ChatMessage = {
        id: this.generateUniqueId('ai-'),
        text: data.response,
        sender: respondingNpc?.name || data.philosopher,
        isUser: false,
        timestamp: new Date(),
        citations: citations // 인용 정보 직접 포함
      };
      
      console.log("📝 생성된 메시지 객체(citations 포함):", JSON.stringify(messageObj));
      
      // 12. 로컬 캐시 업데이트
      const roomIndex = this.chatRooms.findIndex(r => this.normalizeId(r.id) === normalizedId);
      if (roomIndex >= 0) {
        if (!this.chatRooms[roomIndex].messages) {
          this.chatRooms[roomIndex].messages = [];
        }
        this.chatRooms[roomIndex].messages!.push(messageObj);
      }

      console.log(`✅ AI response received successfully`);
      return messageObj;
    } catch (error) {
      console.error('❌ Error getting AI response:', error);
      throw error;
    }
  }

  // Save an initial welcome message to a chat room
  async saveInitialMessage(roomId: string | number, message: ChatMessage): Promise<boolean> {
    try {
      console.log(`🔄 Saving initial message to room ${roomId} (type: ${typeof roomId})`);
      
      // Add detailed logging for the message
      console.log(`Message details: id=${message.id}, sender=${message.sender}, isUser=${message.isUser}`);
      console.log(`Message text: "${message.text}"`);

      // 빈 메시지 또는 System 메시지인지 확인
      if (!message.text || message.text.trim() === "") {
        console.error('❌ Attempted to save empty message, aborting');
        return false;
      }
      
      if (message.sender === 'System' || message.text.toLowerCase().startsWith("welcome to")) {
        console.error('❌ Attempted to save System or Welcome message, aborting');
        return false;
      }

      // 일관된 ID 형식 사용
      const normalizedId = this.normalizeId(roomId);
      
      // First, verify if the room exists in our local cache
      const cachedRoom = this.chatRooms.find(room => this.normalizeId(room.id) === normalizedId);
      if (cachedRoom) {
        console.log(`✅ Room ${normalizedId} exists in local cache (title: ${cachedRoom.title})`);
      } else {
        console.log(`⚠️ Room ${normalizedId} not found in local cache - will depend on DB lookup`);
      }

      // Prepare the request body for debugging
      const requestBody = {
        roomId: normalizedId,
        message: {
          ...message,
          timestamp: message.timestamp instanceof Date 
            ? message.timestamp.toISOString() 
            : message.timestamp
        },
        isInitial: true
      };
      
      console.log('Request body:', JSON.stringify(requestBody));

      // 재시도 로직 추가
      const MAX_RETRIES = 3;
      let retryCount = 0;
      let apiResponse: Response | null = null;
      
      while (retryCount < MAX_RETRIES) {
        try {
          // In the frontend, we use 'id', but in the DB schema, it's 'roomId'
          // API request uses the parameter name 'roomId' as expected by the API
          console.log(`🔄 Sending POST to /api/messages with roomId=${normalizedId}`);
          apiResponse = await fetch('/api/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });
          
          if (!apiResponse) {
            throw new Error('No response received from API');
          }
          
          console.log(`API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);
          console.log('Response Headers:', [...apiResponse.headers.entries()].map(([k, v]) => `${k}: ${v}`).join(', '));
          
          if (!apiResponse.ok) {
            // Check if we're getting HTML instead of JSON
            const contentType = apiResponse.headers.get('content-type') || '';
            console.log('Content-Type:', contentType);
            
            if (contentType.includes('text/html')) {
              const htmlResponse = await apiResponse.text();
              console.error('Response contains HTML error page:', htmlResponse.substring(0, 200));
              throw new Error(`API returned HTML error page: Status ${apiResponse.status}`);
            }
            
            throw new Error(`Failed to save message: ${apiResponse.status}`);
          }
          
          break; // 성공하면 루프 종료
        } catch (error) {
          retryCount++;
          console.error(`API call failed (attempt ${retryCount}/${MAX_RETRIES}):`, error);
          
          if (retryCount >= MAX_RETRIES) {
            throw error; // 최대 재시도 횟수 초과
          }
          
          // 지수 백오프 (1초, 2초, 4초...)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
        }
      }
      
      // Check if response is defined
      if (!apiResponse) {
        throw new Error('No response received from API after maximum retries');
      }
      
      // Log the API response status
      console.log(`API response status: ${apiResponse.status}`);
      
      let errorText = '';
      if (!apiResponse.ok) {
        try {
          errorText = await apiResponse.text();
          console.error(`❌ API error response: ${errorText.substring(0, 500)}`);
        } catch (e) {
          console.error('❌ Failed to read error response:', e);
        }
        
        // If room not found, try to dump the room structure for debugging
        if (apiResponse.status === 404 && cachedRoom) {
          console.log('⚠️ Dumping cached room structure for debugging:');
          console.log(JSON.stringify({
            id: cachedRoom.id,
            title: cachedRoom.title,
            participants: cachedRoom.participants,
            messagesCount: cachedRoom.messages?.length || 0
          }, null, 2));
        }
        
        throw new Error(`Failed to save initial message: ${apiResponse.status}`);
      }
      
      let responseData;
      try {
        // We know response is defined and ok here
        responseData = await safeParseJson(apiResponse);
      console.log('API response data:', responseData);
      } catch (error) {
        console.error('❌ Failed to parse API response:', error);
        return false;
      }
      
      // 로컬 캐시 업데이트 - 일관된 ID 형식 사용
      const roomIndex = this.chatRooms.findIndex(room => this.normalizeId(room.id) === normalizedId);
      if (roomIndex >= 0) {
        // Make sure messages array exists
        if (!this.chatRooms[roomIndex].messages) {
          this.chatRooms[roomIndex].messages = [];
        }
        
        // Check if the message already exists
        const messageExists = this.chatRooms[roomIndex].messages!.some(msg => msg.id === message.id);
        if (!messageExists) {
          this.chatRooms[roomIndex].messages!.push(message);
          console.log(`✅ Added initial message to local cache for room ${normalizedId}`);
        }
      } else {
        console.log(`⚠️ Room ${normalizedId} not found in local cache to update`);
      }
      
      console.log('✅ Initial message saved successfully');
      return true;
    } catch (error) {
      console.error('❌ Error saving initial message:', error);
      return false;
    }
  }
}

// Export a singleton instance of the service
export const chatService = new ChatService(true); // true to use API, false to use mock responses

export default chatService; 