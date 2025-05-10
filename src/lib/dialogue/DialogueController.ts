/**
 * 대화 형식 제어 클래스
 * - 대화 형식별 API 통신 처리
 * - 대화 상태 관리
 * - UI 업데이트 콜백 처리
 */

import { ChatRoom, ChatMessage } from '../ai/chatService';

export type DialogueType = 'standard' | 'debate' | 'socratic' | 'panel';

export interface DialogueState {
  roomId: string;
  dialogueType: DialogueType;
  currentStage?: string;
  turnCount?: number;
  nextSpeaker?: string;
  additionalInfo?: Record<string, any>;
}

export interface DialogueControllerOptions {
  room: ChatRoom;
  onStateUpdate?: (state: DialogueState) => void;
  onNextSpeaker?: (speakerInfo: any) => void;
  onError?: (error: Error) => void;
}

/**
 * 대화 형식 제어를 위한 컨트롤러 클래스
 */
class DialogueController {
  private room: ChatRoom;
  private dialogueType: DialogueType;
  private state: DialogueState;
  private onStateUpdate?: (state: DialogueState) => void;
  private onNextSpeaker?: (speakerInfo: any) => void;
  private onError?: (error: Error) => void;

  /**
   * 대화 컨트롤러 초기화
   * @param options 초기화 옵션
   */
  constructor(options: DialogueControllerOptions) {
    this.room = options.room;
    this.dialogueType = (this.room.dialogueType as DialogueType) || 'standard';
    this.onStateUpdate = options.onStateUpdate;
    this.onNextSpeaker = options.onNextSpeaker;
    this.onError = options.onError;

    // 기본 상태 초기화
    this.state = {
      roomId: this.room.id.toString(),
      dialogueType: this.dialogueType,
    };

    console.log(`DialogueController initialized for room ${this.room.id} with type ${this.dialogueType}`);
  }

  /**
   * 대화 상태 초기화 및 로드
   */
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

  /**
   * 서버에서 대화 상태 조회
   */
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

  /**
   * 다음 발언자 정보 조회
   */
  async getNextSpeaker(): Promise<any> {
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
      
      // 콜백 호출
      if (this.onNextSpeaker) {
        this.onNextSpeaker(speakerInfo);
      }
      
      return speakerInfo;
    } catch (error) {
      this.handleError(error as Error);
      return null;
    }
  }

  /**
   * 사용자 메시지 처리
   * @param message 사용자 메시지
   * @param userId 사용자 ID
   */
  async processUserMessage(message: string, userId: string): Promise<any> {
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
      
      // 상태 업데이트가 포함된 경우 처리
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

  /**
   * AI 응답 생성 요청
   * @param recentMessages 최근 메시지 목록
   */
  async generateResponse(recentMessages: ChatMessage[]): Promise<any> {
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

  /**
   * 대화 상태 업데이트
   * @param newState 새로운 상태 정보
   */
  private updateState(newState: Partial<DialogueState>): void {
    this.state = {
      ...this.state,
      ...newState,
    };
    
    // 콜백 호출
    if (this.onStateUpdate) {
      this.onStateUpdate(this.state);
    }
    
    console.log('Dialogue state updated:', this.state);
  }

  /**
   * 오류 처리
   * @param error 발생한 오류
   */
  private handleError(error: Error): void {
    console.error('DialogueController error:', error);
    
    // 콜백 호출
    if (this.onError) {
      this.onError(error);
    }
  }

  /**
   * 현재 대화 상태 반환
   */
  getState(): DialogueState {
    return this.state;
  }

  /**
   * 대화 타입 반환
   */
  getDialogueType(): DialogueType {
    return this.dialogueType;
  }
}

export default DialogueController; 