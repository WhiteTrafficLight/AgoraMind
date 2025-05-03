import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: {
    position: 'bottom-right',
  },
  // 개발 중에 다른 기기에서 액세스할 수 있도록 허용
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://0.0.0.0:3000',
    'http://192.168.0.36:3000',
    'http://*', // 모든 HTTP 요청 허용
  ],
  // API Routes 설정
  async headers() {
    return [
      {
        // Socket.IO 경로에 대한 CORS 설정
        source: '/api/socket/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With,Content-Type,Accept,Authorization' },
        ],
      },
      {
        // 모든 API 경로에 대한 CORS 설정
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With,Content-Type,Accept,Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;
