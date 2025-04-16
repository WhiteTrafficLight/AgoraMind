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
}

export interface ChatRoomCreationParams {
  title: string;
  context?: string;
  maxParticipants: number;
  npcs: string[];
}

// Updated service that can use real API calls
class ChatService {
  private chatRooms: ChatRoom[] = [
    {
      id: 1,
      title: 'The Nature of Consciousness',
      context: 'Exploring the philosophical aspects of consciousness and its relationship to the brain.',
      participants: {
        users: ['User123', 'User456'],
        npcs: ['Socrates', 'Kant']
      },
      totalParticipants: 4,
      lastActivity: '2 hours ago',
    },
    {
      id: 2,
      title: 'Ethics in the Digital Age',
      context: 'Discussing the moral implications of technology and its impacts on society.',
      participants: {
        users: ['User789'],
        npcs: ['Plato', 'Nietzsche']
      },
      totalParticipants: 3,
      lastActivity: '4 hours ago',
    },
    {
      id: 3,
      title: 'Free Will and Determinism',
      context: 'Debating whether humans truly have agency or if our actions are predetermined.',
      participants: {
        users: ['User321', 'User654', 'User987'],
        npcs: ['Aristotle', 'Simone de Beauvoir']
      },
      totalParticipants: 5,
      lastActivity: '1 day ago',
    },
    {
      id: 4,
      title: 'The Meaning of Existence',
      context: 'Exploring existentialist perspectives on purpose and meaning in life.',
      participants: {
        users: ['User234'],
        npcs: ['Sartre', 'Camus']
      },
      totalParticipants: 3,
      lastActivity: '2 days ago',
    },
    {
      id: 5,
      title: 'Political Philosophy and Justice',
      context: 'Examining concepts of fairness, rights, and governance in society.',
      participants: {
        users: ['User567', 'User890'],
        npcs: ['Rousseau', 'Marx']
      },
      totalParticipants: 4,
      lastActivity: '3 days ago',
    },
  ];

  // Flag to determine whether to use the API or mock responses
  private useAPI: boolean = true;

  constructor(useAPI: boolean = true) {
    this.useAPI = useAPI;
  }

  // Get all chat rooms
  async getChatRooms(): Promise<ChatRoom[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return [...this.chatRooms];
  }

  // Helper to generate a unique ID
  private generateUniqueId(prefix: string = ''): string {
    // Using UUID-like format with timestamp and random components
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const randomStr2 = Math.random().toString(36).substring(2, 10);
    return `${prefix}${timestamp}-${randomStr}-${randomStr2}`;
  }

  // Get a specific chat room by ID - 완전 수정
  async getChatRoomById(id: string | number): Promise<ChatRoom | null> {
    console.log('\n=======================================');
    console.log('🔍 FETCHING CHAT ROOM');
    console.log('ID:', id);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 채팅방 찾기
    const room = this.chatRooms.find(room => room.id.toString() === id.toString());
    
    // 채팅방이 없으면 종료
    if (!room) {
      console.log('❌ Room not found');
      console.log('=======================================\n');
      return null;
    }
    
    console.log('Room Title:', room.title);
    console.log('Participants:', room.participants);
    
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
    console.log('Registered philosophers:', registeredPhilosophers);
    
    // 3. 메시지 초기화 (아직 없는 경우)
    if (!room.messages) {
      console.log('📝 Initializing messages for new room');
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
        console.log(`📝 Added welcome message from ${firstPhilosopher}`);
      }
    }
    
    // 4. 메시지 검증 (중요: 모든 NPC 메시지의 발신자가 참여자 목록에 있는지 확인)
    let messagesFixed = false;
    if (room.messages && room.messages.length > 0) {
      console.log('🔍 Validating message senders...');
      
      for (let i = 0; i < room.messages.length; i++) {
        const msg = room.messages[i];
        
        // NPC 메시지이면서 참여자가 아닌 경우 수정
        if (!msg.isUser && msg.sender !== 'System' && !registeredPhilosophers.includes(msg.sender)) {
          // 발신자가 참여자 목록에 없는 경우
          console.warn(`⚠️ WARNING: Found message from non-participant: ${msg.sender}`);
          console.warn('Message:', msg.text);
          
          // 메시지 발신자를 첫 번째 참여자로 대체
          const originalSender = msg.sender;
          msg.sender = registeredPhilosophers[0];
          msg.text = `[Original message by ${originalSender}] ${msg.text}`;
          
          console.log(`✅ Fixed: Changed sender to ${msg.sender}`);
          messagesFixed = true;
        }
      }
      
      if (!messagesFixed) {
        console.log('✅ All message senders are valid');
      } else {
        console.log('⚠️ Some message senders were fixed');
      }
    }
    
    console.log('✅ Room fetched successfully');
    console.log('=======================================\n');
    
    // 5. 깊은 복사본 반환 (원본 변경 방지)
    return JSON.parse(JSON.stringify(room));
  }

  // Create a new chat room - 완전히 새로 작성
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
      throw new Error('At least one philosopher (NPC) is required');
    }
    
    // 2. 각 NPC가 유효한 철학자인지 확인 
    const invalidPhilosophers = params.npcs.filter(npc => !this.AVAILABLE_PHILOSOPHERS.includes(npc));
    if (invalidPhilosophers.length > 0) {
      console.warn(`⚠️ WARNING: Invalid philosophers requested: ${invalidPhilosophers.join(', ')}`);
    }
    
    // 3. 인증된 철학자 목록만 가져오기 (정확히 요청한 철학자만 포함, 불변성 보장)
    const selectedPhilosophers = [...params.npcs];
    
    console.log('Title:', params.title);
    console.log('Philosophers:', selectedPhilosophers);
    console.log('Context:', params.context || '[none]');
    
    // API 지연 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. 새 채팅방 ID 생성 (시간 기반으로 고유 ID 보장)
    const newId = this.generateUniqueId('room-');
    
    // 5. 현재 사용자 (실제 앱에서는 로그인한 사용자 정보 사용)
    const currentUser = 'User123';
    
    // 6. 새 채팅방 객체 생성
    const newRoom: ChatRoom = {
      id: newId,
      title: params.title,
      context: params.context || '',
      participants: {
        users: [currentUser],
        npcs: selectedPhilosophers // 선택한 철학자만 정확히 포함
      },
      totalParticipants: 1 + selectedPhilosophers.length,
      lastActivity: 'Just now',
      messages: [
        {
          id: this.generateUniqueId('sys-'),
          text: `Welcome to the philosophical dialogue on "${params.title}".`,
          sender: 'System',
          isUser: false,
          timestamp: new Date()
        }
      ]
    };
    
    // 7. 첫 번째 철학자의 인사 메시지 추가
    if (selectedPhilosophers.length > 0 && newRoom.messages) {
      const firstPhilosopher = selectedPhilosophers[0];
      
      newRoom.messages.push({
        id: this.generateUniqueId(`npc-${firstPhilosopher.toLowerCase()}-`),
        text: this.getInitialPrompt(params.title, params.context),
        sender: firstPhilosopher,
        isUser: false,
        timestamp: new Date(Date.now() - 60000)
      });
      
      console.log(`📝 First message from: ${firstPhilosopher}`);
    }
    
    // 8. 채팅방 목록에 추가
    this.chatRooms.push(newRoom);
    
    console.log(`✅ Chat room created with ID: ${newId}`);
    console.log('=======================================\n');
    
    // 9. 새 채팅방 객체 반환 (깊은 복사본으로 원본과 분리)
    return JSON.parse(JSON.stringify(newRoom));
  }

  // Send a message in a chat room
  async sendMessage(roomId: string | number, messageText: string): Promise<ChatMessage> {
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
      sender: 'You',
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
    console.log('\n==========================================');
    console.log('🤖 GENERATING AI RESPONSE');
    console.log('Room ID:', roomId);
    
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
      
      console.log('Room Title:', room.title);
      console.log('Participant NPCs:', room.participants.npcs);

      // 실제 API 호출 시도
      if (this.useAPI) {
        try {
          console.log('🔄 Attempting to use real API...');
          
          // Generate a unique message ID before making the API call
          const messageId = this.generateUniqueId('api-');
          
          // Call the actual API
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
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
            console.log('⚠️ Falling back to mock response...');
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
            console.log('⚠️ Falling back to mock response...');
            throw new Error('API returned incomplete message');
          }
          
          // 응답자 검증 - 참여자 목록에 있는지 확인
          if (!room.participants.npcs.includes(aiMessage.sender)) {
            console.warn(`⚠️ API returned message from non-participant: ${aiMessage.sender}`);
            // 메시지의 발신자를 첫 번째 참여자로 교체
            aiMessage.sender = room.participants.npcs[0];
            console.log(`✅ Fixed: Changed sender to ${aiMessage.sender}`);
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
          
          console.log('✅ AI response generated via API');
          console.log('==========================================\n');
          return aiMessage;
        } catch (error) {
          console.error('❌ Error getting AI response from API:', error);
          console.log('⚠️ Falling back to mock response...');
          // Fall back to mock response if API fails
          return this.getMockAIResponse(room);
        }
      } else {
        // Use mock response instead of API
        console.log('🔄 Using mock response as configured');
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
      
      console.log('⚠️ Returning emergency response');
      console.log('==========================================\n');
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
    console.log('\n==========================================');
    console.log('💬 GENERATING AI RESPONSE');
    console.log('Room ID:', room.id);
    console.log('Room Title:', room.title);
    
    // 1. 채팅방 참여자 검증
    if (!room.participants || !room.participants.npcs || room.participants.npcs.length === 0) {
      throw new Error(`No philosophers in room: ${room.title}`);
    }
    
    // 2. 등록된 NPC 목록 (불변성 보장)
    const registeredNPCs = [...room.participants.npcs];
    console.log('✅ Registered NPCs:', registeredNPCs);
    
    // 3. 참여자 검증 - 모든 NPC가 유효한지 확인
    const invalidNPCs = registeredNPCs.filter(npc => !this.AVAILABLE_PHILOSOPHERS.includes(npc));
    if (invalidNPCs.length > 0) {
      console.warn('⚠️ Warning: Room contains invalid philosophers:', invalidNPCs);
    }
    
    // 4. 최근 메시지 가져오기
    const recentMessages = (room.messages || []).slice(-5);
    const lastUserMessage = [...recentMessages].reverse().find(msg => msg.isUser);
    console.log('Last user message:', lastUserMessage?.text);
    
    // 5. 응답할 철학자 결정 로직 개선
    let respondingPhilosopher = '';
    
    // 5.1. 사용자가 특정 철학자를 언급했는지 확인
    if (lastUserMessage) {
      const userMessageLower = lastUserMessage.text.toLowerCase();
      
      for (const npc of registeredNPCs) {
        // 언급된 철학자 찾기 (참여자만)
        if (userMessageLower.includes(npc.toLowerCase())) {
          respondingPhilosopher = npc;
          console.log(`👉 User mentioned NPC: ${npc}`);
          break;
        }
      }
    }
    
    // 5.2. 사용자가 특정 철학자를 언급하지 않았다면 번갈아가며 대답
    if (!respondingPhilosopher) {
      console.log('No specific philosopher mentioned, alternating...');
      
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
        console.log(`👉 Alternating NPCs: Last=${lastNpcMessage.sender} → Next=${respondingPhilosopher}`);
      } else {
        // 마지막으로 대화에 참여한 NPC가 없거나 참여 NPC가 하나뿐이면 첫 번째 참여자 선택
        respondingPhilosopher = registeredNPCs[0];
        console.log(`👉 Defaulting to first philosopher: ${respondingPhilosopher}`);
      }
    }
    
    // 6. 최종 안전 검사 - 철학자가 참여 목록에 있는지 다시 확인
    if (!registeredNPCs.includes(respondingPhilosopher)) {
      console.error('❌ ERROR: Selected philosopher not in participants list');
      console.error('Room participants:', registeredNPCs);
      console.error('Selected:', respondingPhilosopher);
      
      // 첫 번째 등록된 철학자로 강제 교체
      respondingPhilosopher = registeredNPCs[0];
      console.log(`👉 Forced fallback to: ${respondingPhilosopher}`);
    }
    
    // 7. 선택된 철학자의 응답 생성
    const response = this.generatePhilosopherResponse(respondingPhilosopher, room.title, recentMessages);
    
    // 8. 결과 로깅
    console.log(`✅ Final responding philosopher: ${respondingPhilosopher}`);
    console.log('==========================================\n');
    
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