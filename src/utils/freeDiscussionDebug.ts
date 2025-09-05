// Debug utility for Free Discussion
// Use this in browser console to test the API endpoints

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

export const createFreeDiscussionDebug = () => {
  const testCreateSession = async () => {
    console.log('🧪 Testing Free Discussion API...');
    
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
      console.log('📤 Sending request to:', `${API_BASE_URL}/api/free-discussion/create`);
      console.log('📋 Payload:', testPayload);

      const response = await fetch(`${API_BASE_URL}/api/free-discussion/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Success! Response data:', data);
        
        // Test getting session status
        if (data.session_id) {
          console.log('🔍 Testing session status...');
          const statusResponse = await fetch(`${API_BASE_URL}/api/free-discussion/${data.session_id}/status`);
          const statusData = await statusResponse.json();
          console.log('📊 Session status:', statusData);
        }
      } else {
        const errorData = await response.text();
        console.error('❌ API Error:', response.status, errorData);
      }
    } catch (error) {
      console.error('💥 Network Error:', error);
    }
  };

  const testAPIEndpoint = async (endpoint: string) => {
    try {
      console.log(`🔍 Testing endpoint: ${API_BASE_URL}${endpoint}`);
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      console.log(`📊 ${endpoint} status:`, response.status);
      
      if (response.ok) {
        const data = await response.text();
        console.log(`✅ ${endpoint} response:`, data.substring(0, 200));
      } else {
        console.error(`❌ ${endpoint} error:`, response.status);
      }
    } catch (error) {
      console.error(`💥 ${endpoint} network error:`, error);
    }
  };

  const checkBackendHealth = async () => {
    console.log('🏥 Checking backend health...');
    
    // Test various endpoints
    await testAPIEndpoint('/health');
    await testAPIEndpoint('/api/free-discussion/');
    await testAPIEndpoint('/docs');
  };

  const simulateModalSubmission = () => {
    console.log('🎭 Simulating modal submission...');
    
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

    console.log('📋 Mock params:', mockParams);
    console.log('💡 Use this payload to test your createChat function');
    
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
  console.log('🐛 Free Discussion debug tools loaded! Use window.debugFreeDiscussion');
}

