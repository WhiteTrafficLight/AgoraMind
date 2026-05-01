import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  // Configure image domains.
  // dangerouslyAllowSVG is required because ui-avatars.com serves SVG; the
  // CSP and contentDispositionType=attachment below mitigate the typical
  // SVG XSS vector (no inline scripts, served as download not inline).
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Rewrite rule to forward portrait requests to API server
  async rewrites() {
    return [
      {
        source: '/portraits/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/portraits/:path*`,
      },
    ];
  },
  // API Routes 설정
  async headers() {
    return [
      {
        // Socket.IO 경로에 대한 CORS 설정
        source: '/api/socket/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXTAUTH_URL || 'http://localhost:3000' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With,Content-Type,Accept,Authorization' },
        ],
      },
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
