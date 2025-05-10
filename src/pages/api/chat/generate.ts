import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // POST 요청만 처리
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // 필수 필드 검증
    const { npcs, npc_descriptions, topic, context, previous_dialogue, user_message } = req.body;
    
    if (!user_message) {
      return res.status(400).json({ error: 'Missing required field: user_message' });
    }
    
    // room_id가 없는 경우 URL에서 추출 시도 (이전 요청 형식 호환)
    let room_id = req.body.room_id;
    if (!room_id) {
      const referer = req.headers.referer || '';
      const match = referer.match(/\/chat\?id=([^&]+)/);
      room_id = match ? match[1] : '';
      
      if (!room_id) {
        return res.status(400).json({ error: 'Missing required field: room_id' });
      }
    }
    
    // room_id를 문자열로 변환 (Python API는 문자열 타입 필요)
    room_id = String(room_id);
    console.log(`API: room_id converted to string: ${room_id} (${typeof room_id})`);
    
    // Python API 서버 URL
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await fetch(`${apiBaseUrl}/api/chat/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...req.body,
        room_id,
        user_message
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}): ${errorText}`);
      throw new Error(`API returned status ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in chat/generate API:', error);
    return res.status(500).json({
      error: 'Failed to generate chat response',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 