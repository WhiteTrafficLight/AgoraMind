// Dynamic API route for dialogue operations by room ID and action
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // API 서버 URL 설정
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  
  // URL 파라미터 가져오기
  const { roomId, action } = req.query;
  
  if (!roomId || !action) {
    return res.status(400).json({ error: 'Room ID and action are required' });
  }
  
  try {
    // 기본 API 경로 구성
    const apiPath = `/api/dialogue/${roomId}/${action}`;
    
    // HTTP 메소드에 따른 처리
    if (req.method === 'GET') {
      // GET 요청 처리
      const response = await fetch(`${apiBaseUrl}${apiPath}`);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return res.status(200).json(data);
    } else if (req.method === 'POST') {
      // POST 요청 처리
      const response = await fetch(`${apiBaseUrl}${apiPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return res.status(200).json(data);
    }
    
    // 지원하지 않는 HTTP 메소드
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error(`Error in dialogue/${roomId}/${action} API route:`, error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 