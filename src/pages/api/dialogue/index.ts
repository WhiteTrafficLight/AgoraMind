// API route for dialogue-related operations
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // API 서버 URL 설정
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  
  try {
    // HTTP 메소드 확인
    if (req.method === 'GET') {
      // 사용 가능한 대화 형식 가져오기
      const response = await fetch(`${apiBaseUrl}/api/dialogue/types`);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return res.status(200).json(data);
    }
    
    // 지원하지 않는 HTTP 메소드
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Error in dialogue API route:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 