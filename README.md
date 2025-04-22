# AgoraMind

AI 기반 대화형 채팅 애플리케이션입니다.

## 환경 설정

1. 프로젝트를 클론합니다.
2. 필요한 패키지를 설치합니다:

```bash
npm install
```

3. 환경 변수를 설정합니다:
   
`.env.local` 파일을 생성하고 다음 내용을 추가합니다:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-change-in-production
MONGODB_URI=mongodb://localhost:27017/agoramind

# Google OAuth credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Google OAuth 설정 방법

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속합니다.
2. 새 프로젝트를 만들거나 기존 프로젝트를 선택합니다.
3. 사이드바에서 "API 및 서비스" > "사용자 인증 정보"로 이동합니다.
4. "사용자 인증 정보 만들기" 버튼을 클릭하고 "OAuth 클라이언트 ID"를 선택합니다.
5. 애플리케이션 유형으로 "웹 애플리케이션"을 선택합니다.
6. 이름을 입력합니다 (예: "AgoraMind OAuth").
7. 승인된 JavaScript 출처에 `http://localhost:3000`을 추가합니다.
8. 승인된 리디렉션 URI에 `http://localhost:3000/api/auth/callback/google`을 추가합니다.
9. "만들기" 버튼을 클릭합니다.
10. 생성된 클라이언트 ID와 클라이언트 보안 비밀번호를 `.env.local` 파일에 설정합니다.

## 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)로 접속하여 앱을 확인할 수 있습니다.

## MongoDB 설정

로컬에서 개발할 때는 MongoDB가 설치되어 있어야 합니다:

1. [MongoDB 설치 가이드](https://docs.mongodb.com/manual/installation/)를 참고하여 MongoDB를 설치합니다.
2. MongoDB를 시작합니다.

또는 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)를 사용하여 클라우드 데이터베이스를 설정할 수 있습니다. 이 경우 `.env.local` 파일에 있는 `MONGODB_URI`를 Atlas 연결 문자열로 변경하세요.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
