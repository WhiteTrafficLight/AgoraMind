// Debug utility for Free Discussion
// Use this in browser console to test the API endpoints
import { createLogger, LogLevel } from './logger';

declare global {
  interface Window {
    debugFreeDiscussion: {
      testCreateSession: () => Promise<void>;
      testAPIEndpoint: (endpoint: string) => Promise<void>;
      checkBackendHealth: () => Promise<void>;
      simulateModalSubmission: () => void;
    };
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const debugLogger = createLogger({ name: 'FREE_DISCUSSION_DEBUG', useEmojis: false, level: LogLevel.DEBUG });

export const createFreeDiscussionDebug = () => {
  const testCreateSession = async () => {
    debugLogger.info('Testing Free Discussion API...');
    
    const testPayload = {
      topic: "Test: The nature of consciousness",
      philosophers: ["nietzsche", "sartre"],
      context: "A philosophical exploration of consciousness",
      user_info: {
        user_id: "test_user_123",
        user_name: "Test User"
      },
      config: {
        auto_play: true,
        playback_speed: 1.0,
        turn_interval: 3.0,
        max_turns: 10,
        allow_user_interruption: true
      }
    };

    try {
      debugLogger.debug('Sending request to:', `${API_BASE_URL}/api/free-discussion/create`);
      debugLogger.debug('Payload:', testPayload);

      const response = await fetch(`${API_BASE_URL}/api/free-discussion/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      debugLogger.debug('Response status:', response.status);
      debugLogger.debug('Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        debugLogger.info('Success response:', data);
        
        // Test getting session status
        if (data.session_id) {
          debugLogger.debug('Testing session status...');
          const statusResponse = await fetch(`${API_BASE_URL}/api/free-discussion/${data.session_id}/status`);
          const statusData = await statusResponse.json();
          debugLogger.info('Session status:', statusData);
        }
      } else {
        const errorData = await response.text();
        debugLogger.error('API Error:', response.status, errorData);
      }
    } catch (error) {
      debugLogger.error('Network error:', error);
    }
  };

  const testAPIEndpoint = async (endpoint: string) => {
    try {
      debugLogger.debug('Testing endpoint:', `${API_BASE_URL}${endpoint}`);
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      debugLogger.debug(`${endpoint} status:`, response.status);
      
      if (response.ok) {
        const data = await response.text();
        debugLogger.info(`${endpoint} response (first 200 chars):`, data.substring(0, 200));
      } else {
        debugLogger.warn(`${endpoint} error:`, response.status);
      }
    } catch (error) {
      debugLogger.error(`${endpoint} network error:`, error);
    }
  };

  const checkBackendHealth = async () => {
    debugLogger.info('Checking backend health...');
    await testAPIEndpoint('/health');
    await testAPIEndpoint('/api/free-discussion/');
    await testAPIEndpoint('/docs');
  };

  const simulateModalSubmission = () => {
    debugLogger.info('Simulating modal submission...');
    
    const mockParams = {
      title: "Test Free Discussion",
      maxParticipants: 6,
      npcs: ["nietzsche", "sartre"],
      isPublic: true,
      generateInitialMessage: true,
      dialogueType: 'free' as const,
      context: "Test context for debugging",
      freeDiscussionConfig: {
        auto_play: true,
        playback_speed: 1.0,
        turn_interval: 3.0,
        max_turns: 50,
        allow_user_interruption: true,
      }
    };

    debugLogger.debug('Mock params:', mockParams);
    debugLogger.info('Use this payload to test your createChat function');
    
    return mockParams;
  };

  return {
    testCreateSession,
    testAPIEndpoint,
    checkBackendHealth,
    simulateModalSubmission,
  };
};

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
  window.debugFreeDiscussion = createFreeDiscussionDebug();
  debugLogger.info('Free Discussion debug tools loaded. Use window.debugFreeDiscussion');
}


