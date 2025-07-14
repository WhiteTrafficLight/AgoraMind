import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // 배포를 위해 빌드 시 ESLint 에러 무시
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 배포를 위해 빌드 시 TypeScript 에러 무시
    ignoreBuildErrors: true,
  },
  // Docker용 standalone 출력 설정
  output: 'standalone',
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
  // Configure image domains
  images: {
    domains: ['ui-avatars.com'],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // API Routes 설정
  async headers() {
    return [
      {
        // 모든 API 경로에 대한 CORS 설정
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXTAUTH_URL || 'http://localhost:3000' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With,Content-Type,Accept,Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig; 