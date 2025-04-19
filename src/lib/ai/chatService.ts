// Types
export interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  isUser: boolean;
  timestamp: Date;
}

export interface ChatRoom {
  id: string | number;
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
}

export interface ChatRoomCreationParams {
  title: string;
  context?: string;
  maxParticipants: number;
  npcs: string[];
  isPublic?: boolean;
  currentUser?: string;
}

// 디버그 모드 설정 - 로깅 제어용
const DEBUG = false;

// 로그 출력 함수 - 디버그 모드에서만 출력
function log(...args: any[]) {
  if (DEBUG) {
    console.log(...args);
  }
}

// Updated service that can use real API calls
class ChatService {
  // API 기반으로 동작하도록 변경 - mock 데이터 제거
  private chatRooms: ChatRoom[] = [];
  private useAPI: boolean = true;

  // 생성자 - API 사용 여부 설정 가능
  constructor(useAPI: boolean = true) {
    this.useAPI = useAPI;
  }

  // Get all chat rooms - API 요청으로 대체
  async getChatRooms(): Promise<ChatRoom[]> {
    try {
      log('Fetching chat rooms from API...');
      const response = await fetch('/api/rooms');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch chat rooms: ${response.status}`);
      }
      
      const data = await response.json();
      log(`Fetched ${data.length} chat rooms from API`);
      
      // 중복 ID 제거 (동일한 ID의 첫 번째 채팅방만 유지)
      const uniqueRooms = data.reduce((acc: ChatRoom[], room: ChatRoom) => {
        // 이미 같은 ID의 방이 있는지 확인
        const exists = acc.some((r: ChatRoom) => String(r.id) === String(room.id));
        if (!exists) {
          acc.push(room);
        } else {
          console.warn(`중복 채팅방 ID 발견: ${room.id}, 제목: ${room.title}`);
        }
        return acc;
      }, [] as ChatRoom[]);
      
      // 유니크한 채팅방 ID 로깅
      const uniqueIds = uniqueRooms.map((room: ChatRoom) => room.id);
      console.log(`유니크한 채팅방 ID: ${uniqueIds.join(', ')}`);
      
      // API 응답으로 로컬 캐시 업데이트
      this.chatRooms = uniqueRooms;
      
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

  // Get a specific chat room by ID
  async getChatRoomById(id: string | number): Promise<ChatRoom | null> {
    log('\n=======================================');
    log('🔍 FETCHING CHAT ROOM');
    log('ID:', id);
    log('ID type:', typeof id);
    
    try {
      // API에서 특정 채팅방 데이터 가져오기
      const numericId = typeof id === 'string' ? parseInt(id) : id;
      const response = await fetch(`/api/rooms?id=${numericId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch chat room: ${response.status}`);
      }
      
      const room = await response.json();
      
      // 채팅방이 없으면 종료
      if (!room) {
        log('❌ Room not found');
        log('=======================================\n');
        return null;
      }
      
      log('✅ Room found!');
      log('Room Title:', room.title);
      log('Participants:', room.participants);
      
      // 채팅방 ID 확인 - 잘못된 채팅방이 반환되는 것을 방지
      if (room.id && String(room.id) !== String(id)) {
        console.error(`❌ ERROR: Room ID mismatch! Requested ${id}, but got ${room.id}`);
        return null;
      }
      
      // 1. 참여자 유효성 검사
      if (!room.participants || !room.participants.npcs || room.participants.npcs.length === 0) {
        console.error('❌ ERROR: Room has no participants!');
        
        // 참여자가 없는 방은 사용할 수 없음을 명확히 함
        return {
          ...room,
          messages: [{
            id: this.generateUniqueId('error-'),
            text: 'This chat room has no philosopher participants.',
            sender: 'System',
            isUser: false,
            timestamp: new Date()
          }]
        };
      }
      
      // 2. 이 채팅방에 등록된 철학자 목록 (복사본 생성)
      const registeredPhilosophers = [...room.participants.npcs];
      log('Registered philosophers:', registeredPhilosophers);
      
      // 3. 메시지 초기화 (아직 없는 경우)
      if (!room.messages || room.messages.length === 0) {
        log('📝 Initializing messages for new room');
        room.messages = [{
          id: this.generateUniqueId('sys-'),
          text: `Welcome to the philosophical dialogue on "${room.title}".`,
          sender: 'System',
          isUser: false,
          timestamp: new Date()
        }];
        
        // 등록된 철학자가 있는 경우 첫 번째 철학자가 인사 메시지 보냄
        if (registeredPhilosophers.length > 0) {
          const firstPhilosopher = registeredPhilosophers[0];
          room.messages.push({
            id: this.generateUniqueId(`npc-${firstPhilosopher.toLowerCase()}-`),
            text: this.getInitialPrompt(room.title, room.context),
            sender: firstPhilosopher,
            isUser: false,
            timestamp: new Date(Date.now() - 60000)
          });
          log(`📝 Added welcome message from ${firstPhilosopher}`);
        }
      }
      
      // 로컬 캐시 업데이트
      const existingRoomIndex = this.chatRooms.findIndex(r => String(r.id) === String(id));
      if (existingRoomIndex >= 0) {
        this.chatRooms[existingRoomIndex] = room;
      } else {
        this.chatRooms.push(room);
      }
      
      log('✅ Room fetched successfully');
      log('=======================================\n');
      
      return room;
    } catch (error) {
      console.error('Error fetching chat room:', error);
      
      // API 실패 시 로컬 캐시에서 검색
      log('Falling back to local cache...');
      const idStr = String(id);
      const cachedRoom = this.chatRooms.find(room => String(room.id) === idStr);
      
      if (!cachedRoom) {
        log('❌ Room not found in local cache');
        return null;
      }
      
      return JSON.parse(JSON.stringify(cachedRoom));
    }
  }

  // Create a new chat room
  async createChatRoom(params: ChatRoomCreationParams): Promise<ChatRoom> {
    console.log('\n=======================================');
    console.log('🏗️ CREATING NEW CHAT ROOM');
    
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
      // API 요청으로 채팅방 생성
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create chat room: ${response.status}`);
      }
      
      const newRoom = await response.json();
      console.log('✅ Created room:', newRoom.id, newRoom.title);
      
      // 로컬 캐시에 추가
      this.chatRooms.push(newRoom);
      
      return newRoom;
    } catch (error) {
      console.error('❌ Error creating chat room:', error);
      throw error;
    }
  }

  // Send a message in a chat room
  async sendMessage(roomId: string | number, messageText: string, senderName?: string): Promise<ChatMessage> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const room = this.chatRooms.find(room => room.id.toString() === roomId.toString());
    if (!room) throw new Error('Chat room not found');
    
    if (!room.messages) {
      room.messages = [];
    }
    
    // Make sure we don't already have this message (prevent duplicates)
    const userMessage: ChatMessage = {
      id: this.generateUniqueId('user-'),
      text: messageText,
      sender: senderName || 'You',
      isUser: true,
      timestamp: new Date()
    };
    
    // Add to room messages
    room.messages.push(userMessage);
    room.lastActivity = 'Just now';
    
    return userMessage;
  }

  // Get an AI response to a user message - 에러 처리 개선
  async getAIResponse(roomId: string | number): Promise<ChatMessage> {
    log('\n==========================================');
    log('🤖 GENERATING AI RESPONSE');
    log('Room ID:', roomId);
    
    try {
      // Get the room
      const room = this.chatRooms.find(room => room.id.toString() === roomId.toString());
      if (!room) {
        console.error('❌ ERROR: Chat room not found');
        throw new Error('Chat room not found');
      }
      
      if (!room.messages) {
        console.error('❌ ERROR: No message history found');
        throw new Error('No message history found');
      }
      
      log('Room Title:', room.title);
      log('Participant NPCs:', room.participants.npcs);

      // 실제 API 호출 시도
      if (this.useAPI) {
        try {
          log('🔄 Attempting to use real API...');
          
          // Generate a unique message ID before making the API call
          const messageId = this.generateUniqueId('api-');
          
          // Get LLM settings from localStorage
          let llmProvider = 'openai';
          let llmModel = '';
          let ollamaEndpoint = 'http://localhost:11434';
          
          // Browser check for localStorage
          if (typeof window !== 'undefined' && window.localStorage) {
            llmProvider = localStorage.getItem('llmProvider') || 'openai';
            
            if (llmProvider === 'openai') {
              llmModel = localStorage.getItem('openaiModel') || 'gpt-4o';
            } else if (llmProvider === 'ollama') {
              llmModel = localStorage.getItem('ollamaModel') || 'llama3';
              ollamaEndpoint = localStorage.getItem('ollamaEndpoint') || 'http://localhost:11434';
            }
          }
          
          log(`🔄 Using LLM provider: ${llmProvider}, model: ${llmModel}`);
          
          // Call the actual API
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-llm-provider': llmProvider,
              'x-llm-model': llmModel,
              'x-ollama-endpoint': ollamaEndpoint
            },
            body: JSON.stringify({
              messages: room.messages,
              roomId: roomId,
              topic: room.title,
              context: room.context,
              participants: room.participants
            }),
          });

          // API 응답 검증
          if (!response.ok) {
            const errorStatus = response.status;
            let errorData = {};
            
            try {
              errorData = await response.json();
            } catch (e) {
              // JSON 파싱 실패 시 빈 객체 유지
            }
            
            console.error(`❌ API error: Status ${errorStatus}`, errorData);
            log('⚠️ Falling back to mock response...');
            // 폴백 처리로 이동
            throw new Error(`API request failed with status ${errorStatus}`);
          }

          // 정상 응답 처리
          const aiMessage = await response.json();
          
          // Always use our locally generated ID instead of the one from API
          aiMessage.id = messageId;
          
          // Convert timestamp string to Date if needed
          if (typeof aiMessage.timestamp === 'string') {
            aiMessage.timestamp = new Date(aiMessage.timestamp);
          }
          
          // 응답 검증 - 누락된 필드 확인
          if (!aiMessage.text || !aiMessage.sender) {
            console.error('❌ API returned incomplete message:', aiMessage);
            log('⚠️ Falling back to mock response...');
            throw new Error('API returned incomplete message');
          }
          
          // 응답자 검증 - 참여자 목록에 있는지 확인
          if (!room.participants.npcs.includes(aiMessage.sender)) {
            console.warn(`⚠️ API returned message from non-participant: ${aiMessage.sender}`);
            // 메시지의 발신자를 첫 번째 참여자로 교체
            aiMessage.sender = room.participants.npcs[0];
            log(`✅ Fixed: Changed sender to ${aiMessage.sender}`);
          }
          
          // Check if this message is already in the room (prevent duplicates)
          const isDuplicate = room.messages.some(msg => 
            msg.text === aiMessage.text && 
            msg.sender === aiMessage.sender && 
            !msg.isUser
          );
          
          // Only add if not a duplicate
          if (!isDuplicate) {
            room.messages.push(aiMessage);
          }
          
          log('✅ AI response generated via API');
          log('==========================================\n');
          return aiMessage;
        } catch (error) {
          console.error('❌ Error getting AI response from API:', error);
          log('⚠️ Falling back to mock response...');
          // Fall back to mock response if API fails
          return this.getMockAIResponse(room);
        }
      } else {
        // Use mock response instead of API
        log('🔄 Using mock response as configured');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate thinking time
        return this.getMockAIResponse(room);
      }
    } catch (error) {
      console.error('❌ CRITICAL ERROR in getAIResponse:', error);
      
      // 비상 복구 - 예외 상황에서도 응답 생성
      const emergencyResponse: ChatMessage = {
        id: this.generateUniqueId('emergency-'),
        text: "I apologize, but I encountered an unexpected error. Let's continue our conversation.",
        sender: 'System',
        isUser: false,
        timestamp: new Date()
      };
      
      log('⚠️ Returning emergency response');
      log('==========================================\n');
      return emergencyResponse;
    }
  }

  // 상수: 이용 가능한 철학자들과 그 응답을 객체로 저장
  private readonly AVAILABLE_PHILOSOPHERS = [
    'Socrates', 'Plato', 'Aristotle', 'Kant', 'Nietzsche', 
    'Sartre', 'Camus', 'Simone de Beauvoir', 'Marx', 'Rousseau',
    'Wittgenstein', 'Heidegger', 'Descartes', 'Hume', 'Spinoza', 
    'Confucius', 'Lao Tzu', 'Buddha'
  ];

  // Helper method to get a mock AI response - 완전히 다시 작성
  private getMockAIResponse(room: ChatRoom): ChatMessage {
    log('\n==========================================');
    log('💬 GENERATING AI RESPONSE');
    log('Room ID:', room.id);
    log('Room Title:', room.title);
    
    // 1. 채팅방 참여자 검증
    if (!room.participants || !room.participants.npcs || room.participants.npcs.length === 0) {
      throw new Error(`No philosophers in room: ${room.title}`);
    }
    
    // 2. 등록된 NPC 목록 (불변성 보장)
    const registeredNPCs = [...room.participants.npcs];
    log('✅ Registered NPCs:', registeredNPCs);
    
    // 3. 참여자 검증 - 모든 NPC가 유효한지 확인
    const invalidNPCs = registeredNPCs.filter(npc => !this.AVAILABLE_PHILOSOPHERS.includes(npc));
    if (invalidNPCs.length > 0) {
      console.warn('⚠️ Warning: Room contains invalid philosophers:', invalidNPCs);
    }
    
    // 4. 최근 메시지 가져오기
    const recentMessages = (room.messages || []).slice(-5);
    const lastUserMessage = [...recentMessages].reverse().find(msg => msg.isUser);
    log('Last user message:', lastUserMessage?.text);
    
    // 5. 응답할 철학자 결정 로직 개선
    let respondingPhilosopher = '';
    
    // 5.1. 사용자가 특정 철학자를 언급했는지 확인
    if (lastUserMessage) {
      const userMessageLower = lastUserMessage.text.toLowerCase();
      
      for (const npc of registeredNPCs) {
        // 언급된 철학자 찾기 (참여자만)
        if (userMessageLower.includes(npc.toLowerCase())) {
          respondingPhilosopher = npc;
          log(`👉 User mentioned NPC: ${npc}`);
          break;
        }
      }
    }
    
    // 5.2. 사용자가 특정 철학자를 언급하지 않았다면 번갈아가며 대답
    if (!respondingPhilosopher) {
      log('No specific philosopher mentioned, alternating...');
      
      // 마지막 NPC 메시지 찾기 (이 room의 참여자 중에서만)
      const lastNpcMessage = [...recentMessages].reverse().find(msg => 
        !msg.isUser && 
        msg.sender !== 'System' && 
        registeredNPCs.includes(msg.sender)
      );
      
      // 마지막으로 대화에 참여한 NPC가 있는 경우
      if (lastNpcMessage && registeredNPCs.includes(lastNpcMessage.sender) && registeredNPCs.length > 1) {
        // 다음 NPC 선택 (순환식으로)
        const lastIndex = registeredNPCs.indexOf(lastNpcMessage.sender);
        const nextIndex = (lastIndex + 1) % registeredNPCs.length;
        respondingPhilosopher = registeredNPCs[nextIndex];
        log(`👉 Alternating NPCs: Last=${lastNpcMessage.sender} → Next=${respondingPhilosopher}`);
      } else {
        // 마지막으로 대화에 참여한 NPC가 없거나 참여 NPC가 하나뿐이면 첫 번째 참여자 선택
        respondingPhilosopher = registeredNPCs[0];
        log(`👉 Defaulting to first philosopher: ${respondingPhilosopher}`);
      }
    }
    
    // 6. 최종 안전 검사 - 철학자가 참여 목록에 있는지 다시 확인
    if (!registeredNPCs.includes(respondingPhilosopher)) {
      console.error('❌ ERROR: Selected philosopher not in participants list');
      console.error('Room participants:', registeredNPCs);
      console.error('Selected:', respondingPhilosopher);
      
      // 첫 번째 등록된 철학자로 강제 교체
      respondingPhilosopher = registeredNPCs[0];
      log(`👉 Forced fallback to: ${respondingPhilosopher}`);
    }
    
    // 7. 선택된 철학자의 응답 생성
    const response = this.generatePhilosopherResponse(respondingPhilosopher, room.title, recentMessages);
    
    // 8. 결과 로깅
    log(`✅ Final responding philosopher: ${respondingPhilosopher}`);
    log('==========================================\n');
    
    // 9. 생성된 메시지 객체 반환
    const aiMessage: ChatMessage = {
      id: this.generateUniqueId(`npc-${respondingPhilosopher.toLowerCase()}-`),
      text: response,
      sender: respondingPhilosopher,
      isUser: false,
      timestamp: new Date()
    };
    
    // 10. 채팅방 메시지 목록에 추가
    if (room.messages) {
      room.messages.push(aiMessage);
    }
    
    return aiMessage;
  }

  // Helper to generate initial prompts based on topic
  private getInitialPrompt(topic: string, context?: string): string {
    const prompts = [
      `I find this topic of "${topic}" quite fascinating. What aspects of it interest you the most?`,
      `Let us explore "${topic}" together. What questions come to mind when you consider this subject?`,
      `The question of "${topic}" has intrigued philosophers for centuries. Where shall we begin our inquiry?`,
      `I've spent much time contemplating "${topic}". What is your perspective on this matter?`,
      `To understand "${topic}", we must first examine our assumptions. What do you believe to be true about this subject?`
    ];
    
    // If there's context, incorporate it into a custom prompt
    if (context && context.trim()) {
      return `Given the context that ${context}, I'm curious about your thoughts on "${topic}"?`;
    }
    
    // Otherwise select a random prompt
    const randomIndex = Math.floor(Math.random() * prompts.length);
    return prompts[randomIndex];
  }

  // Helper to generate philosopher-specific responses (for mock/fallback use)
  private generatePhilosopherResponse(philosopher: string, topic: string, messages: ChatMessage[]): string {
    // Get the last user message to respond to
    const lastUserMessage = [...messages].reverse().find(msg => msg.isUser);
    const userQuery = lastUserMessage?.text || '';
    
    // Find keywords in the user's query to make responses more contextual
    const keywords = this.extractKeywords(userQuery);
    
    // Define philosopher-specific response styles
    const philosopherResponses: Record<string, string[]> = {
      'Socrates': [
        "I must question what you mean by that. Can we examine your assumptions?",
        "That's an interesting perspective. What led you to form this view?",
        "Let us explore this question through dialogue. What evidence supports your position?",
        "I know that I know nothing, but I suspect there's more to consider here. What do you think?"
      ],
      'Plato': [
        "Consider this from the perspective of ideal forms. What is the perfect essence of what you describe?",
        "Your point reminds me of the allegory of the cave. Perhaps what we perceive is merely shadows of reality.",
        "To understand this truly, we must look beyond the material manifestations to the underlying form."
      ],
      'Aristotle': [
        "We should analyze this methodically, examining its causes and components.",
        "There appears to be a practical wisdom in what you suggest, but let's consider the golden mean between extremes.",
        "To understand this properly, we must distinguish between its potential and actual states."
      ],
      'Kant': [
        "We must consider this as a categorical imperative. Would you will that maxim to be universal law?",
        "Your reasoning seems sound, but we must distinguish between phenomena and noumena here.",
        "The moral worth of this position depends on whether it's motivated by duty rather than inclination."
      ],
      'Nietzsche': [
        "Perhaps this conventional thinking masks the will to power underneath.",
        "We must go beyond traditional good and evil in evaluating this position.",
        "I sense a potential for the übermensch in this perspective, but it requires the courage to challenge established values."
      ],
      'Sartre': [
        "Your choice reflects your freedom, but remember that with freedom comes radical responsibility.",
        "In choosing this position, you choose for all humanity. Does your choice affirm human dignity?",
        "Existence precedes essence - your authentic choices define who you are, not predetermined categories."
      ],
      'Camus': [
        "Despite the absurdity of existence, we can find meaning in how we respond to your question.",
        "Like Sisyphus, we must find meaning in the struggle itself, not just the outcome.",
        "I see in your perspective both the acknowledgment of life's absurdity and the rebellion against it."
      ],
      'Simone de Beauvoir': [
        "We must analyze how gender and social conditioning influence this perspective.",
        "Your freedom is intertwined with the freedom of others. How does this position affect that relationship?",
        "Let's examine how this viewpoint has been shaped by historical and social situations."
      ],
      'Marx': [
        "We must analyze the material and economic conditions that give rise to this situation.",
        "Your perspective seems shaped by class interests. Whose interests does it ultimately serve?",
        "The point isn't merely to interpret the world, but to change it. How might this lead to praxis?"
      ],
      'Rousseau': [
        "In our natural state, before social corruption, how might we have approached this?",
        "Social institutions have transformed our authentic nature. We must consider the general will.",
        "I wonder if civilization has improved or diminished our ability to address this concern."
      ],
      'Wittgenstein': [
        "The limits of my language are the limits of my world. Let us clarify what we mean by these terms.",
        "Perhaps this is a case where language is bewitching our intelligence. What do these words truly mean?",
        "We must examine the language game we're playing. How are we using these words in this context?"
      ]
    };
    
    // Default responses for philosophers not specifically defined
    const defaultResponses = [
      "I find your perspective intriguing. Let's explore this further.",
      "There's wisdom in what you say, though I'd add some nuance.",
      "This is a complex matter that deserves careful consideration.",
      "Your thoughts have merit, though I might approach this differently."
    ];
    
    // Get the appropriate response array for the philosopher
    const responseArray = philosopherResponses[philosopher] || defaultResponses;
    
    // Select a random response from the array
    const randomIndex = Math.floor(Math.random() * responseArray.length);
    let baseResponse = responseArray[randomIndex];
    
    // Incorporate user query context if available
    let contextualizedResponse = '';
    if (userQuery) {
      // Reference aspects of the user's message
      const userQueryFragment = userQuery.length > 30 ? userQuery.substring(0, 30) + "..." : userQuery;
      
      // Add keyword-specific content
      if (keywords.length > 0) {
        const keyword = keywords[Math.floor(Math.random() * keywords.length)];
        contextualizedResponse = `Regarding your point about "${keyword}", ${baseResponse}`;
      } else {
        contextualizedResponse = `In response to "${userQueryFragment}", ${baseResponse}`;
      }
    } else {
      contextualizedResponse = baseResponse;
    }
    
    // Add topic-specific content
    const enhancedResponse = `${contextualizedResponse} ${this.getPhilosopherSpecificClosing(philosopher, topic)}`;
    
    return enhancedResponse;
  }

  // Helper to extract meaningful keywords from user text
  private extractKeywords(text: string): string[] {
    if (!text) return [];
    
    // List of common philosophical keywords
    const philosophicalKeywords = [
      "knowledge", "truth", "reality", "existence", "consciousness", 
      "morality", "ethics", "justice", "freedom", "determinism", 
      "meaning", "purpose", "language", "mind", "being", "time",
      "perception", "identity", "self", "other", "society", "nature"
    ];
    
    // Simple keyword extraction - look for philosophical keywords in the text
    const keywords: string[] = [];
    const words = text.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      const cleanWord = word.replace(/[.,?!;:()'"]/g, '');
      if (cleanWord.length > 3 && philosophicalKeywords.includes(cleanWord)) {
        keywords.push(cleanWord);
      }
    }
    
    // If no philosophical keywords found, extract any significant words (4+ chars)
    if (keywords.length === 0) {
      for (const word of words) {
        const cleanWord = word.replace(/[.,?!;:()'"]/g, '');
        if (cleanWord.length > 4 && !["about", "these", "those", "their", "would", "could", "should"].includes(cleanWord)) {
          keywords.push(cleanWord);
        }
      }
    }
    
    return [...new Set(keywords)]; // Remove duplicates
  }

  // Get philosopher-specific closing statement
  private getPhilosopherSpecificClosing(philosopher: string, topic: string): string {
    const closings: Record<string, string[]> = {
      'Socrates': [
        `Is this line of questioning helping us understand ${topic} more clearly?`,
        `What further questions should we ask about ${topic}?`
      ],
      'Plato': [
        `In the realm of forms, ${topic} takes on its true essence beyond our limited perceptions.`,
        `Consider how ${topic} relates to the Good itself.`
      ],
      'Nietzsche': [
        `When examining ${topic}, we must be willing to gaze into the abyss.`,
        `Perhaps our views on ${topic} need a complete revaluation.`
      ],
      'Wittgenstein': [
        `When discussing ${topic}, we must be careful about the language games we play.`,
        `The meaning of our discussion on ${topic} lies in its use, not abstract definition.`
      ]
    };
    
    const defaultClosings = [
      `I'm curious to hear more about your thoughts on ${topic}.`,
      `How does this perspective change your understanding of ${topic}?`
    ];
    
    const availableClosings = closings[philosopher] || defaultClosings;
    return availableClosings[Math.floor(Math.random() * availableClosings.length)];
  }
}

// Export a singleton instance of the service
export const chatService = new ChatService(true); // true to use API, false to use mock responses

export default chatService; 