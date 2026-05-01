import { loggers } from '@/utils/logger';
import { DEFAULT_LLM_MODEL } from './llmDefaults';
import { safeParseJson } from './chatHttp';
import { RoomCache } from './roomCache';
import type {
  Citation,
  ChatMessage,
  ChatRoom,
  ChatRoomCreationParams,
  NpcDetail,
} from './chatTypes';

// Re-export types so existing `from '@/lib/ai/chatService'` imports keep
// working. New code should import from './chatTypes' directly.
export type {
  Citation,
  RagSource,
  ChatMessage,
  NpcDetail,
  ChatRoom,
  ChatRoomCreationParams,
} from './chatTypes';

// Enhanced logging function for better debugging
function log(...args: unknown[]) {
  if (process.env.NODE_ENV !== 'production') {
    loggers.api.debug('[ChatService]', ...args);
  }
}

// Updated service that can use real API calls
class ChatService {
  // API - mock
  private cache = new RoomCache();
  private useAPI: boolean = true;

  // - API
  constructor(useAPI: boolean = true) {
    this.useAPI = useAPI;
  }

  // Get all chat rooms - API
  async getChatRooms(): Promise<ChatRoom[]> {
    try {
      log('Fetching chat rooms from API...');
      
      const MAX_RETRIES = 3;
      let retryCount = 0;
      let response: Response | undefined;
      
      while (retryCount < MAX_RETRIES) {
        try {
          response = await fetch('/api/rooms');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch chat rooms: ${response.status}`);
          }
          
          break;
        } catch (error) {
          retryCount++;
          loggers.api.error(`API call failed (attempt ${retryCount}/${MAX_RETRIES})`, { error });
          
          if (retryCount >= MAX_RETRIES) {
            throw error;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
        }
      }

      if (!response) {
        throw new Error('No response received from API after maximum retries');
      }
      
      const data = await response.json();
      loggers.api.info('Fetched chat rooms from API', { count: data.length });
      
      // ID ( ID )
      const uniqueRooms = data.reduce((acc: ChatRoom[], room: ChatRoom) => {
        const roomId = String(room.id).trim();
        const exists = acc.some((r: ChatRoom) => String(r.id).trim() === roomId);
        if (!exists) {
          acc.push(room);
        } else {
          loggers.api.warn('Duplicate chat room ID found', { roomId, title: room.title });
        }
        return acc;
      }, [] as ChatRoom[]);
      
      const uniqueIds = uniqueRooms.map((room: ChatRoom) => room.id);
      loggers.api.info('Unique chat room IDs loaded', { 
        count: uniqueIds.length,
        roomIds: uniqueIds.join(', ')
      });
      
      this.cache.replaceAll(uniqueRooms);
      return uniqueRooms;
    } catch (error) {
      loggers.api.error('Error fetching chat rooms', { error });
      return this.cache.getAll();
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

  // Get a specific chat room by ID -
  async getChatRoomById(id: string | number): Promise<ChatRoom | null> {
    const roomId = String(id).trim();
    
    loggers.api.debug('Fetching chat room by ID', { roomId, originalId: id, idType: typeof id });
    
    // Check if this is a Free Discussion session (starts with "free-")
    if (roomId.startsWith('free-')) {
      loggers.api.debug('Detected Free Discussion session, using freeDiscussionService');
      
      try {
        // Import the service dynamically to avoid circular dependencies
        const { freeDiscussionService } = await import('@/lib/api/freeDiscussionService');
        const sessionStatus = await freeDiscussionService.getSessionStatus(roomId);
        
        if (!sessionStatus) {
          loggers.api.warn('Free Discussion session not found', { roomId });
          return null;
        }
        
        // Convert Free Discussion session to ChatRoom format
        const chatRoom: ChatRoom = {
          id: sessionStatus.session_id,
          title: sessionStatus.topic,
          context: sessionStatus.context || undefined,
          participants: {
            users: sessionStatus.user_name ? [sessionStatus.user_name] : [],
            npcs: sessionStatus.participants,
          },
          totalParticipants: sessionStatus.participants.length + (sessionStatus.user_name ? 1 : 0),
          lastActivity: sessionStatus.last_activity,
          messages: [], // Messages will be handled by EnhancedCircularChatUI
          isPublic: false,
          dialogueType: 'free',
          freeDiscussionSessionId: sessionStatus.session_id,
          // Do not force freeDiscussionConfig here; use session defaults/manual
        };
        
        loggers.api.info('Free Discussion session found and converted to ChatRoom', { roomId });
        return chatRoom;
      } catch (error) {
        loggers.api.error('Error fetching Free Discussion session', { roomId, error });
        return null;
      }
    }
    
    // 1. (regular chat rooms)
    const cachedRoom = this.cache.getIfValid(roomId);
    if (cachedRoom) {
      loggers.api.info('Using valid cache for room', { roomId });
      const roomCopy = JSON.parse(JSON.stringify(cachedRoom));
      roomCopy.id = roomId;
      return roomCopy;
    }
    
    // 2. API
    try {
      loggers.api.debug('Fetching room from API', { roomId });
      
      const MAX_RETRIES = 3;
      let retryCount = 0;
      let response: Response | undefined;
      
      while (retryCount < MAX_RETRIES) {
        try {
          response = await fetch(`/api/rooms?id=${encodeURIComponent(roomId)}`);
      
      if (!response.ok) {
            if (response.status === 404) {
              loggers.api.warn('Room not found in API', { roomId });
              return null;
            }
        throw new Error(`Failed to fetch chat room: ${response.status}`);
          }
          
          break;
        } catch (error) {
          retryCount++;
          loggers.api.error(`API call failed (attempt ${retryCount}/${MAX_RETRIES})`, { error });
          
          if (retryCount >= MAX_RETRIES) {
            throw error;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
        }
      }
      
      if (!response) {
        throw new Error('No response received from API after maximum retries');
      }
      
      const room = await response.json();
      
      if (!room || !room.id) {
        loggers.api.error('Invalid room data received for ID', { roomId });
        return null;
      }
      
      const responseId = String(room.id).trim();
      if (responseId !== roomId) {
        loggers.api.warn('ID mismatch detected', { 
          requested: roomId, 
          response: responseId 
        });
        
        if (responseId !== roomId) {
          loggers.api.error('ID mismatch confirmed', { 
            requested: roomId, 
            response: responseId 
          });
          return null;
        }
        
        loggers.api.info('ID match confirmed');
        room.id = roomId;
      }
      
      loggers.api.info('Room found', { roomId });
      loggers.api.debug('Room details', { 
        roomId: room.id, 
        roomTitle: room.title, 
        participants: room.participants 
      });
      
      if (!room.participants || !room.participants.npcs || room.participants.npcs.length === 0) {
        loggers.api.error('Room has no participants');
        
        return {
          ...room,
          id: roomId,
          messages: []
        };
      }
      
      const registeredPhilosophers = [...room.participants.npcs];
      loggers.api.debug('Registered philosophers', { registeredPhilosophers });
      
      if (!room.messages) {
        room.messages = [];
      }
      
      // 4. System Welcome
      if (room.messages.length > 0) {
        const initialMessageCount = room.messages.length;
        room.messages = room.messages.filter((msg: ChatMessage) => 
          msg.sender !== 'System' && 
          !(msg.text && msg.text.toLowerCase().startsWith("welcome to"))
        );
        
        if (initialMessageCount !== room.messages.length) {
          loggers.api.info('Removed system or welcome messages', { 
            initialCount: initialMessageCount, 
            remainingCount: room.messages.length 
          });
        }
      }
      
      // 📨 chatMessages
      loggers.api.debug('Loading messages from chatMessages collection');
      try {
        const messagesResponse = await fetch(`/api/messages?roomId=${encodeURIComponent(roomId)}&action=getMessages`);
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          if (messagesData.success && messagesData.messages && Array.isArray(messagesData.messages)) {
            loggers.api.info('Loaded messages from chatMessages collection', { 
              count: messagesData.messages.length 
            });
            
            // chatMessages ChatMessage
            interface RawDBMessage {
              messageId: string;
              text: string;
              sender: string;
              isUser: boolean;
              timestamp: string | Date;
              role?: string;
              citations?: Citation[];
            }
            const loadedMessages: ChatMessage[] = messagesData.messages.map((msg: RawDBMessage) => ({
              id: msg.messageId,  // messageId -> id
              text: msg.text,
              sender: msg.sender,
              isUser: msg.isUser,
              timestamp: new Date(msg.timestamp),
              role: msg.role,
              citations: msg.citations || [],
              skipAnimation: true
            }));
            
            // messages
            const existingIds = new Set(room.messages.map((msg: ChatMessage) => msg.id));
            const uniqueLoadedMessages = loadedMessages.filter(msg => !existingIds.has(msg.id));
            
            room.messages = [...room.messages, ...uniqueLoadedMessages].sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            
            loggers.api.info('Total messages after merge', { 
              totalCount: room.messages.length 
            });
          } else {
            loggers.api.warn('No messages found in chatMessages collection or invalid response format');
          }
        } else {
          loggers.api.warn('Failed to load messages from chatMessages collection', { 
            status: messagesResponse.status 
          });
        }
      } catch (error) {
        loggers.api.error('Error loading messages from chatMessages collection', { error });
        // ( messages )
      }
      
      // 5. NPC
      if (!room.npcDetails || room.npcDetails.length === 0) {
        loggers.api.debug('Loading NPC details for participants');
        room.npcDetails = await this.loadNpcDetails(registeredPhilosophers);
      }
      
      if (room.initial_message) {
        loggers.api.debug('Processing initial message');
        
        if (room.initial_message.text && room.initial_message.text.trim() !== "") {
          
          // () (Moderator, isSystemMessage=true, role=moderator)
          if (room.initial_message.sender === 'Moderator' || 
              room.initial_message.isSystemMessage || 
              room.initial_message.role === 'moderator') {
            
            loggers.api.info('Valid moderator message found, adding to message list');
            loggers.api.debug('Moderator message details', {
              sender: room.initial_message.sender,
              isSystemMessage: room.initial_message.isSystemMessage,
              role: room.initial_message.role,
              textPreview: room.initial_message.text.substring(0, 100)
            });
            
            const isDuplicate = room.messages.some((msg: ChatMessage) => 
              msg.text === room.initial_message.text && 
              (msg.sender === room.initial_message.sender || msg.sender === 'Moderator') && 
              !msg.isUser
            );
            
            if (!isDuplicate) {
              const moderatorMessage: ChatMessage = {
                ...room.initial_message,
                sender: 'Moderator',
                isSystemMessage: true,
                role: 'moderator'
              };
              
              room.messages.push(moderatorMessage);
              loggers.api.info('Added moderator message to message list');
            } else {
              loggers.api.warn('Duplicate moderator message detected, not adding');
            }
          }
          // System , Welcome ( NPC )
          else if (room.initial_message.sender !== 'System' && 
              !room.initial_message.text.toLowerCase().startsWith("welcome to")) {
            
            loggers.api.info('Valid initial message found, adding to message list');
            loggers.api.debug('Message', { roomInitialMessage: room.initial_message });
            
            const isDuplicate = room.messages.some((msg: ChatMessage) => 
              msg.text === room.initial_message.text && 
              msg.sender === room.initial_message.sender && 
              !msg.isUser
            );
            
            if (!isDuplicate) {
              room.messages.push(room.initial_message);
            } else {
              loggers.api.warn('Duplicate initial message detected, not adding');
            }
          } else {
            loggers.api.warn('System or welcome initial message detected, not adding');
          }
        } else {
          loggers.api.warn('Empty initial message detected, not adding');
        }
        
        delete room.initial_message;
      }
      
      // 7. Debate (Socket.IO )
      if (room.dialogueType === 'debate') {
        const hasModeratorMessage = room.messages.some((msg: ChatMessage) => 
          msg.sender === 'Moderator' && 
          (msg.isSystemMessage || msg.role === 'moderator') &&
          !msg.id.startsWith('temp-waiting-') &&
          msg.text.trim() !== "Participants are joining. Please wait a moment..."
        );
        
        if (hasModeratorMessage) {
          const beforeCount = room.messages.length;
          room.messages = room.messages.filter((msg: ChatMessage) => !msg.id.startsWith('temp-waiting-'));
          const afterCount = room.messages.length;
          
          if (beforeCount !== afterCount) {
            loggers.api.debug('Removed temporary waiting messages (Socket.IO update)', { 
              beforeCount, 
              afterCount 
            });
            loggers.api.debug('Messages after cleanup', { afterCount });
          }
        } else {
          const hasTempMessage = room.messages.some((msg: ChatMessage) => msg.id.startsWith('temp-waiting-'));
          if (hasTempMessage) {
            loggers.api.warn('Temporary waiting message still present - no moderator message found yet');
          }
        }
      }
      
      room.id = roomId;
      
      this.cache.set(room);
      
      loggers.api.info('Room fetched successfully', { roomId });
      return JSON.parse(JSON.stringify(room));
    } catch (error) {
      loggers.api.error('Error fetching chat room', { error });
      
      // 3. API
      if (cachedRoom) {
        loggers.api.warn('Using stale cache for room due to API error', { roomId });
        const roomCopy = JSON.parse(JSON.stringify(cachedRoom));
        roomCopy.id = roomId;
        return roomCopy;
      }
      
        return null;
    }
  }

  // Create a new chat room
  async createChatRoom(params: ChatRoomCreationParams): Promise<ChatRoom> {
    loggers.api.debug('Creating new chat room', { title: params.title, npcs: params.npcs });
    
    // 1. - NPC
    if (!params.title || !params.title.trim()) {
      loggers.api.error('Chat room title is required');
      throw new Error('Chat room title is required');
    }
    
    if (!params.npcs || !Array.isArray(params.npcs) || params.npcs.length === 0) {
      loggers.api.error('At least one philosopher (NPC) is required');
      throw new Error('At least one philosopher is required');
    }
    
    try {
      // 2. - generateInitialMessage
      // "Welcome to..."
      const requestData = {
        ...params,
        generateInitialMessage: true
      };
      
      loggers.api.debug('Request data', { 
        preview: JSON.stringify(requestData).substring(0, 200) + '...' 
      });
      
      // 3. API
      const MAX_RETRIES = 3;
      let retryCount = 0;
      let response: Response | undefined;
      
      while (retryCount < MAX_RETRIES) {
        try {
          // - API
          loggers.api.debug('Creating chat room via API...');
      
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
            loggers.api.error('API error', { 
              status: response.status, 
              contentType: contentType 
            });
            
            if (contentType.includes('text/html')) {
              const htmlError = await response.text();
              loggers.api.error('HTML error response', { 
                preview: htmlError.substring(0, 200) 
              });
              throw new Error(`Server returned HTML error page: ${response.status}`);
            }
            
        throw new Error(`Failed to create chat room: ${response.status}`);
      }
      
          break;
        } catch (error) {
          retryCount++;
          loggers.api.error('API call failed', { 
            attempt: retryCount, 
            maxRetries: MAX_RETRIES, 
            error 
          });
          
          if (retryCount >= MAX_RETRIES) {
            throw error;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
        }
      }
      
      if (!response) {
        throw new Error('No response received from API after maximum retries');
      }
      
      let rawRoomData;
      try {
        rawRoomData = await safeParseJson(response);
      loggers.api.info('Server created room', { 
        id: rawRoomData.id, 
        title: rawRoomData.title 
      });
        
        // - initial_message
        if (rawRoomData.initial_message) {
          loggers.api.info('Initial message received from server', {
            id: rawRoomData.initial_message.id,
            sender: rawRoomData.initial_message.sender,
            isSystemMessage: rawRoomData.initial_message.isSystemMessage,
            role: rawRoomData.initial_message.role,
            textPreview: rawRoomData.initial_message.text.substring(0, 100)
          });
          
          // Moderator
          if (
            rawRoomData.initial_message.sender === 'Moderator' ||
            rawRoomData.initial_message.isSystemMessage === true ||
            rawRoomData.initial_message.role === 'moderator'
          ) {
            loggers.api.info('Moderator message detected in initial_message');
          } else {
            loggers.api.warn('Initial message is not from Moderator', { 
              sender: rawRoomData.initial_message.sender 
            });
          }
        } else {
          loggers.api.warn('No initial_message field in server response');
        }
      } catch (error) {
        loggers.api.error('Failed to parse API response', { error });
        throw new Error('Unable to parse API response: ' + (error as Error).message);
      }
      
      if (!rawRoomData || !rawRoomData.id) {
        throw new Error('Invalid room data received from server');
      }
      
      const newRoom: ChatRoom = JSON.parse(JSON.stringify(rawRoomData));
      
      if (!newRoom.messages) {
        newRoom.messages = [];
      }
      
      if (newRoom.initial_message) {
        loggers.api.debug('Processing initial message from server');
        loggers.api.debug('Initial message', { newRoomInitialMessage: newRoom.initial_message });
        
        // (Moderator, isSystemMessage=true, role=moderator)
        if (newRoom.initial_message.sender === 'Moderator' || 
            newRoom.initial_message.isSystemMessage || 
            newRoom.initial_message.role === 'moderator') {
          
          loggers.api.info('Found moderator message for debate, replacing temporary message');
          loggers.api.info('Moderator message details', {
            sender: newRoom.initial_message.sender,
            isSystemMessage: newRoom.initial_message.isSystemMessage,
            role: newRoom.initial_message.role,
            textPreview: newRoom.initial_message.text?.substring(0, 100)
          });
          loggers.api.debug('full message text', { text: newRoom.initial_message.text });
          
          if (newRoom.initial_message.text && newRoom.initial_message.text.trim() !== "") {
            const isDuplicate = newRoom.messages.some(msg => 
              msg.text === newRoom.initial_message?.text && 
              msg.sender === newRoom.initial_message?.sender
            );
            
            if (!isDuplicate) {
              // messages
              // isSystemMessage role
              const moderatorMsg: ChatMessage = {
                ...newRoom.initial_message,
                isSystemMessage: true,
                role: 'moderator'
              };
              newRoom.messages.push(moderatorMsg);
              loggers.api.info('Added actual moderator message');
              loggers.api.debug('Final moderator message', { moderatorMsg });
            } else {
              loggers.api.warn('Duplicate moderator message detected, not adding');
            }
          } else {
            loggers.api.warn('Empty moderator message from server');
          }
        } else {
          // NPC - debate
          if (newRoom.dialogueType === 'debate') {
            loggers.api.warn('Detected generic NPC fallback message in debate; skipping', { 
              sender: newRoom.initial_message?.sender, 
              textPreview: newRoom.initial_message?.text?.substring(0, 100) 
            });
          } else {
            // System , Welcome ( NPC )
            if (newRoom.initial_message && 
                newRoom.initial_message.sender !== 'System' && 
                !newRoom.initial_message.text.toLowerCase().startsWith("welcome to")) {
              
              loggers.api.info('Valid initial message found, adding to message list');
              loggers.api.debug('Message', { newRoomInitialMessage: newRoom.initial_message });
              
              const isDuplicate = newRoom.messages.some((msg: ChatMessage) => 
                msg.text === newRoom.initial_message!.text && 
                msg.sender === newRoom.initial_message!.sender && 
                !msg.isUser
              );
              
              if (!isDuplicate) {
                newRoom.messages.push(newRoom.initial_message);
              } else {
                loggers.api.warn('Duplicate initial message detected, not adding');
              }
            } else {
              loggers.api.warn('System or welcome initial message detected, not adding');
            }
          }
        }
        
        delete newRoom.initial_message;
      } else {
        loggers.api.warn('No initial message from server');
        // Mock -
      }
      
      // 8. NPC
      if (!newRoom.npcDetails) {
        loggers.api.debug('Loading NPC details');
        newRoom.npcDetails = await this.loadNpcDetails(newRoom.participants.npcs);
      }
      
      this.cache.set(newRoom);
      
      loggers.api.info('New chat room created', { 
        roomId: newRoom.id, 
        messageCount: newRoom.messages.length 
      });
      return newRoom;
    } catch (error) {
      loggers.api.error('Error creating chat room', { error });
      throw error;
    }
  }

  // NPC ID -
  async loadNpcDetails(npcIds: string[]): Promise<NpcDetail[]> {
    loggers.api.debug('Loading details for NPCs using static data only', { count: npcIds.length, npcIds });
    
    const npcDetails: NpcDetail[] = [];
    
    for (const npcId of npcIds) {
      // API -
      loggers.api.debug('Creating default detail for NPC ID', { npcId });
      npcDetails.push(this.createDefaultNpcDetail(npcId));
    }
    
    loggers.api.info('Loaded NPC details successfully (static data)', { 
      count: npcDetails.length, 
      npcIds: npcDetails.map(npc => `${npc.id} → ${npc.name}`) 
    });
    return npcDetails;
  }

  private createDefaultNpcDetail(npcId: string): NpcDetail {
    // MongoDB ObjectID (24 16)
    const isMongoId = /^[0-9a-f]{24}$/i.test(npcId);
    
    // NPC ID UUID ( NPC )
    const isUuid = npcId.length > 30 && npcId.split('-').length === 5;
    
    if (isMongoId || isUuid) {
      loggers.api.warn('Creating default detail for custom NPC', { npcId });
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
      // ID camelCase snake_case
      const formattedName = npcId
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^\w/, c => c.toUpperCase())
        .trim();
        
      loggers.api.warn('Creating default detail for standard philosopher', { formattedName });  
      return {
        id: npcId,
        name: formattedName,
        description: `A philosopher known as ${formattedName}`,
        is_custom: false
      };
    }
  }

  // Helper to generate initial prompts based on topic
  private getInitialPrompt(topic: string): string {
    loggers.api.debug('getInitialPrompt called - disabled');
    loggers.api.info('Topic', { topic });

    // Mock -
    return "";
  }

  // Send user message to a chat room
  async sendMessage(roomId: string | number, message: string, messageData: Partial<ChatMessage> = {}): Promise<ChatMessage> {
    loggers.api.debug('Sending message to room', { roomId });
    loggers.api.info('Message data', { messageData });

    try {
      const room = await this.getChatRoomById(roomId);
      if (!room) {
        throw new Error(`Chat room with ID ${roomId} not found`);
      }

      // 2. - messageData id, sender, role
      const messageObj: ChatMessage = {
        id: messageData?.id || this.generateUniqueId('user-'),
        text: message.trim(),
        sender: messageData?.sender || 'User',
        isUser: true,
        timestamp: messageData?.timestamp || new Date(),
        role: messageData?.role,  // (debate )
        skipAnimation: false
      };

      if (messageData?.citations) {
        messageObj.citations = messageData.citations;
      }

      // 3. API
      loggers.api.debug('Saving message to API', { 
        messageId: messageObj.id, 
        role: messageObj.role || 'none' 
      });
      
      const apiUrl = '/api/messages';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          message: messageObj,
          isInitial: false
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        loggers.api.error('Failed to save message', { 
          status: response.status, 
          errorText: errorText 
        });
        throw new Error(`Failed to save message: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      loggers.api.info('Message saved successfully', { result });

      if (typeof window !== 'undefined') {
        const messageEvent = new CustomEvent('user-message-sent', { 
          detail: { messageObj, roomId }
        });
        window.dispatchEvent(messageEvent);
      }

      // 5. API
      return messageObj;
    } catch (error) {
      loggers.api.error('Error in sendMessage', { error });
      throw error;
    }
  }

  // Get AI response for a chat room
  async getAIResponse(roomId: string | number): Promise<ChatMessage> {
    loggers.api.debug('Getting AI response for room', { roomId });

    try {
      const room = await this.getChatRoomById(roomId);
      if (!room) {
        throw new Error(`Chat room with ID ${roomId} not found`);
      }

      // 2. NPC
      if (!room.npcDetails || room.npcDetails.length === 0) {
        loggers.api.debug('Loading NPC details for AI response');
        room.npcDetails = await this.loadNpcDetails(room.participants.npcs);
      }

      const roomIdStr = String(roomId).trim();
      const topic = room.title;
      const context = room.context || '';
      
      const recentMessages = (room.messages || []).slice(-10);
      
      const lastUserMessage = [...recentMessages].reverse().find(msg => msg.isUser);
      if (!lastUserMessage) {
        throw new Error("No user message found to generate response for");
      }
      
      // 5. Custom NPC (AI )
      const npcDescriptions = room.npcDetails?.map(npc => {
        let description = `${npc.name}:`;
        if (npc.description) description += ` ${npc.description}`;
        if (npc.communication_style) description += `, Communication style: ${npc.communication_style}`;
        if (npc.debate_approach) description += `, Debate approach: ${npc.debate_approach}`;
        return description;
      }).join('\n\n') || '';

      const dialogueText = recentMessages.map(msg => {
        let senderName = msg.sender;
        if (!msg.isUser) {
          const npc = room.npcDetails?.find(npc => npc.id === msg.sender);
          if (npc) senderName = npc.name;
        }
        return `${msg.isUser ? 'User' : senderName}: ${msg.text}`;
      }).join('\n');

      // 7. API
      loggers.api.debug('Requesting AI response from API');
      const response = await fetch('/api/chat/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-llm-provider': 'openai',
          'x-llm-model': DEFAULT_LLM_MODEL
        },
        body: JSON.stringify({
          npcs: room.participants.npcs,
          npc_descriptions: npcDescriptions,
          topic: topic,
          context: context,
          previous_dialogue: dialogueText,
          use_rag: true,  // RAG
          // - room_id
          room_id: roomIdStr,
          user_message: lastUserMessage.text
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get AI response: ${response.status}`);
      }

      // 8. API
      const data = await response.json();
      loggers.api.info('API response full data', { data: JSON.stringify(data) });
      
      let respondingNpc = room.npcDetails?.find(npc => 
        npc.name.toLowerCase() === data.philosopher.toLowerCase()
      );
      
      if (!respondingNpc) {
        respondingNpc = room.npcDetails?.find(npc => 
          npc.id.toLowerCase() === data.philosopher.toLowerCase()
        );
      }
      
      if (!respondingNpc && room.npcDetails && room.npcDetails.length > 0) {
        respondingNpc = room.npcDetails[0];
      }

      // 10. - API
      loggers.api.info('Checking citations - API response field', { field: 'citations' });
      const citations = data.citations || [];
      loggers.api.info('Extracted citations', { count: citations.length });

      const messageObj: ChatMessage = {
        id: this.generateUniqueId('ai-'),
        text: data.response,
        sender: respondingNpc?.name || data.philosopher,
        isUser: false,
        timestamp: new Date(),
        citations: citations,
        skipAnimation: false
      };
      
      loggers.api.info('Created message object (citations included)', { messageObj: JSON.stringify(messageObj) });
      
      this.cache.appendMessage(roomIdStr, messageObj);

      loggers.api.info('AI response received successfully');
      return messageObj;
    } catch (error) {
      loggers.api.error('Error getting AI response', { error });
      throw error;
    }
  }

  // Save an initial welcome message to a chat room
  async saveInitialMessage(roomId: string | number, message: ChatMessage): Promise<boolean> {
    try {
      loggers.api.debug('Saving initial message to room', { roomId, type: typeof roomId });
      
      // Add detailed logging for the message
      loggers.api.debug('Message details', { 
        id: message.id, 
        sender: message.sender, 
        isUser: message.isUser 
      });
      loggers.api.info('Message text', { text: message.text });

      // System
      if (!message.text || message.text.trim() === "") {
        loggers.api.warn('Attempted to save empty message, aborting');
        return false;
      }
      
      if (message.sender === 'System' || message.text.toLowerCase().startsWith("welcome to")) {
        loggers.api.warn('Attempted to save System or Welcome message, aborting');
        return false;
      }

      const roomIdStr = String(roomId).trim();
      
      // First, verify if the room exists in our local cache
      const cachedRoom = this.cache.get(roomIdStr);
      if (cachedRoom) {
        loggers.api.info('Room exists in local cache', { 
          roomId: roomIdStr, 
          title: cachedRoom.title 
        });
      } else {
        loggers.api.warn('Room not found in local cache - will depend on DB lookup', { roomId: roomIdStr });
      }

      // Prepare the request body for debugging
      const requestBody = {
        roomId: roomIdStr,
        message: {
          ...message,
          timestamp: message.timestamp instanceof Date 
            ? message.timestamp.toISOString() 
            : message.timestamp
        },
        isInitial: true
      };
      
      loggers.api.debug('Request body', { requestBody });

      const MAX_RETRIES = 3;
      let retryCount = 0;
      let apiResponse: Response | null = null;
      
      while (retryCount < MAX_RETRIES) {
        try {
          // In the frontend, we use 'id', but in the DB schema, it's 'roomId'
          // API request uses the parameter name 'roomId' as expected by the API
          loggers.api.debug('API request attempt', { 
            attempt: retryCount + 1, 
            maxRetries: MAX_RETRIES, 
            roomId: roomIdStr 
          });
          
          apiResponse = await fetch('/api/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              roomId: roomIdStr,
              message: {
                ...message,
                timestamp: message.timestamp instanceof Date 
                  ? message.timestamp.toISOString() 
                  : message.timestamp
              },
              isInitial: true
            })
          });
          
          if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            loggers.api.error('API error', { 
              status: apiResponse.status, 
              responseText: errorText.substring(0, 200) 
            });
            throw new Error(`Failed to save initial message: ${apiResponse.status} ${errorText}`);
          }
          
          break;
        } catch (error) {
          retryCount++;
          loggers.api.error('API call failed', { 
            attempt: retryCount, 
            maxRetries: MAX_RETRIES, 
            error 
          });
          
          if (retryCount >= MAX_RETRIES) {
            throw error;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
        }
      }
      
      if (!apiResponse) {
        throw new Error('No response received from API after maximum retries');
      }
      
      const result = await apiResponse.json();
      loggers.api.info('API response successful', { result });
      
      return true;
    } catch (error) {
      loggers.api.error('Error saving initial message', { error });
      return false;
    }
  }
}

// Export a singleton instance of the service
export const chatService = new ChatService(true); // true to use API, false to use mock responses

export default chatService;