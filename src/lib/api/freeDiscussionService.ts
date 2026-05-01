import {
  CreateFreeDiscussionRequest,
  CreateFreeDiscussionResponse,
  FreeDiscussionSession,
  ConversationSummary,
  FreeDiscussionConfig
} from '@/app/open-chat/types/freeDiscussion.types';
import { loggers } from '@/utils/logger';
import { apiUrl, ENDPOINTS } from './endpoints';

class FreeDiscussionService {
  async createSession(request: CreateFreeDiscussionRequest): Promise<CreateFreeDiscussionResponse> {
    const url = apiUrl(ENDPOINTS.freeDiscussion.create);
    loggers.api.debug('Create endpoint URL', url);
    loggers.api.debug('Create request payload', request);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    loggers.api.debug('Create response status', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      loggers.api.error('Create API error response', errorText);
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const data = await response.json();
    loggers.api.debug('Create success response', data);
    return data;
  }

  async getSessionStatus(sessionId: string): Promise<FreeDiscussionSession> {
    const url = apiUrl(ENDPOINTS.freeDiscussion.byId(sessionId));
    loggers.api.debug('Get session status for', sessionId);
    loggers.api.debug('Status endpoint URL', url);

    const response = await fetch(url);

    loggers.api.debug('Status response', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      loggers.api.error('Status API error response', errorText);
      throw new Error(`Failed to get session status: ${response.statusText}`);
    }

    const data = await response.json();
    loggers.api.debug('Status success response', data);
    return data;
  }

  async pauseSession(sessionId: string): Promise<void> {
    const response = await fetch(apiUrl(ENDPOINTS.freeDiscussion.pause(sessionId)), {
      method: 'POST',
    });
    if (!response.ok) throw new Error(`Failed to pause session: ${response.statusText}`);
  }

  async resumeSession(sessionId: string): Promise<void> {
    const response = await fetch(apiUrl(ENDPOINTS.freeDiscussion.resume(sessionId)), {
      method: 'POST',
    });
    if (!response.ok) throw new Error(`Failed to resume session: ${response.statusText}`);
  }

  async updateSettings(sessionId: string, settings: Partial<FreeDiscussionConfig>): Promise<void> {
    const response = await fetch(apiUrl(ENDPOINTS.freeDiscussion.settings(sessionId)), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) throw new Error(`Failed to update settings: ${response.statusText}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(apiUrl(ENDPOINTS.freeDiscussion.byId(sessionId)), {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`Failed to delete session: ${response.statusText}`);
  }

  async nextTurn(sessionId: string): Promise<void> {
    const response = await fetch(apiUrl(ENDPOINTS.freeDiscussion.nextTurn(sessionId)), {
      method: 'POST',
    });
    if (!response.ok) throw new Error(`Failed to generate next turn: ${response.statusText}`);
  }

  async sendUserMessage(sessionId: string, userId: string, content: string): Promise<void> {
    const response = await fetch(apiUrl(ENDPOINTS.freeDiscussion.message(sessionId)), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, content }),
    });
    if (!response.ok) throw new Error(`Failed to send message: ${response.statusText}`);
  }

  async getConversationSummary(sessionId: string): Promise<ConversationSummary> {
    const url = apiUrl(ENDPOINTS.freeDiscussion.summary(sessionId));
    loggers.api.debug('Get conversation summary for', sessionId);
    loggers.api.debug('Summary endpoint URL', url);

    const response = await fetch(url);

    loggers.api.debug('Summary response', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      loggers.api.error('Summary API error response', errorText);
      throw new Error(`Failed to get summary: ${response.statusText}`);
    }

    const data = await response.json();
    loggers.api.debug('Summary success response', data);
    return data.conversation_summary;
  }
}

export const freeDiscussionService = new FreeDiscussionService();
