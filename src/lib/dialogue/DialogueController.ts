import { ChatRoom, ChatMessage } from '../ai/chatService';

export type DialogueType = 'standard' | 'debate' | 'socratic' | 'panel';

export interface SpeakerInfo {
  speaker_id?: string;
  role?: string;
  [key: string]: unknown;
}

export interface DialogueState {
  roomId: string;
  dialogueType: DialogueType;
  currentStage?: string;
  turnCount?: number;
  nextSpeaker?: string;
  additionalInfo?: Record<string, unknown>;
}

export interface DialogueControllerOptions {
  room: ChatRoom;
  onStateUpdate?: (state: DialogueState) => void;
  onNextSpeaker?: (speakerInfo: SpeakerInfo) => void;
  onError?: (error: Error) => void;
}

export interface DialogueProcessResult {
  debate_stage?: string;
  next_speaker?: SpeakerInfo;
  [key: string]: unknown;
}

class DialogueController {
  private room: ChatRoom;
  private dialogueType: DialogueType;
  private state: DialogueState;
  private onStateUpdate?: (state: DialogueState) => void;
  private onNextSpeaker?: (speakerInfo: SpeakerInfo) => void;
  private onError?: (error: Error) => void;

  constructor(options: DialogueControllerOptions) {
    this.room = options.room;
    this.dialogueType = (this.room.dialogueType as DialogueType) || 'standard';
    this.onStateUpdate = options.onStateUpdate;
    this.onNextSpeaker = options.onNextSpeaker;
    this.onError = options.onError;

    this.state = {
      roomId: this.room.id.toString(),
      dialogueType: this.dialogueType,
    };

    console.log(`DialogueController initialized for room ${this.room.id} with type ${this.dialogueType}`);
  }

  async initialize(): Promise<DialogueState> {
    try {
      const state = await this.fetchDialogueState();
      this.updateState(state);
      return state;
    } catch (error) {
      this.handleError(error as Error);
      return this.state;
    }
  }

  async fetchDialogueState(): Promise<DialogueState> {
    try {
      const response = await fetch(`/api/dialogue/${this.room.id}/state`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch dialogue state: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      this.handleError(error as Error);
      return this.state;
    }
  }

  async getNextSpeaker(): Promise<SpeakerInfo | null> {
    try {
      const response = await fetch(`/api/dialogue/${this.room.id}/next-speaker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get next speaker: ${response.status}`);
      }
      
      const speakerInfo = await response.json();
      
      if (this.onNextSpeaker) {
        this.onNextSpeaker(speakerInfo);
      }
      
      return speakerInfo;
    } catch (error) {
      this.handleError(error as Error);
      return null;
    }
  }

  async processUserMessage(message: string, userId: string): Promise<DialogueProcessResult | null> {
    try {
      const response = await fetch(`/api/dialogue/${this.room.id}/process-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          user_id: userId,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to process message: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.debate_stage) {
        this.updateState({
          ...this.state,
          currentStage: result.debate_stage,
          nextSpeaker: result.next_speaker?.speaker_id,
        });
      }
      
      return result;
    } catch (error) {
      this.handleError(error as Error);
      return null;
    }
  }

  async generateResponse(recentMessages: ChatMessage[]): Promise<unknown> {
    try {
      const response = await fetch(`/api/dialogue/${this.room.id}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: {
            recent_messages: recentMessages,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate response: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      this.handleError(error as Error);
      return null;
    }
  }

  private updateState(newState: Partial<DialogueState>): void {
    this.state = {
      ...this.state,
      ...newState,
    };
    
    if (this.onStateUpdate) {
      this.onStateUpdate(this.state);
    }
    
    console.log('Dialogue state updated:', this.state);
  }

  private handleError(error: Error): void {
    console.error('DialogueController error:', error);
    
    if (this.onError) {
      this.onError(error);
    }
  }

  getState(): DialogueState {
    return this.state;
  }

  getDialogueType(): DialogueType {
    return this.dialogueType;
  }
}

export default DialogueController; 