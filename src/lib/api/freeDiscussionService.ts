import { 
  CreateFreeDiscussionRequest, 
  CreateFreeDiscussionResponse,
  FreeDiscussionSession,
  ConversationSummary,
  FreeDiscussionConfig
} from '@/app/open-chat/types/freeDiscussion.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class FreeDiscussionService {
  private baseUrl = `${API_BASE_URL}/api/free-discussion`;

  async createSession(request: CreateFreeDiscussionRequest): Promise<CreateFreeDiscussionResponse> {
    console.log('🌐 Free Discussion API Base URL:', API_BASE_URL);
    console.log('🎯 Full endpoint URL:', `${this.baseUrl}/create`);
    console.log('📤 Request payload:', request);
    
    const response = await fetch(`${this.baseUrl}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response status text:', response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error response:', errorText);
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Success response:', data);
    return data;
  }

  async getSessionStatus(sessionId: string): Promise<FreeDiscussionSession> {
    console.log('🔍 Getting session status for:', sessionId);
    console.log('🎯 Status endpoint URL:', `${this.baseUrl}/${sessionId}`);
    
    const response = await fetch(`${this.baseUrl}/${sessionId}`);
    
    console.log('📥 Status response status:', response.status);
    console.log('📥 Status response status text:', response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Status API Error response:', errorText);
      throw new Error(`Failed to get session status: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Status success response:', data);
    return data;
  }

  async pauseSession(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${sessionId}/pause`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to pause session: ${response.statusText}`);
    }
  }

  async resumeSession(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${sessionId}/resume`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to resume session: ${response.statusText}`);
    }
  }

  async updateSettings(sessionId: string, settings: Partial<FreeDiscussionConfig>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${sessionId}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      throw new Error(`Failed to update settings: ${response.statusText}`);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${sessionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete session: ${response.statusText}`);
    }
  }

  async nextTurn(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${sessionId}/next-turn`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to generate next turn: ${response.statusText}`);
    }
  }

  async sendUserMessage(sessionId: string, userId: string, content: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${sessionId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        content,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }
  }

  async getConversationSummary(sessionId: string): Promise<ConversationSummary> {
    console.log('📊 Getting conversation summary for:', sessionId);
    console.log('🎯 Summary endpoint URL:', `${this.baseUrl}/${sessionId}/summary`);
    
    const response = await fetch(`${this.baseUrl}/${sessionId}/summary`);
    
    console.log('📥 Summary response status:', response.status);
    console.log('📥 Summary response status text:', response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Summary API Error response:', errorText);
      throw new Error(`Failed to get summary: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Summary success response:', data);
    return data.conversation_summary;
  }
}

export const freeDiscussionService = new FreeDiscussionService();
