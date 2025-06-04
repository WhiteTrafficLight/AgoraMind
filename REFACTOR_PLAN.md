# 토론 채팅 UI 리팩터링 플랜

## 🎯 목표
- 기존 코드 유지하면서 점진적 개선
- 컴포넌트 책임 분리 및 재사용성 향상
- 타입 안정성 및 테스트 용이성 확보

## 📁 새로운 디렉토리 구조

```
src/
├── components/
│   ├── chat/
│   │   ├── DebateChatUI.tsx                    # 기존 파일 (유지)
│   │   ├── CircularChatUI.tsx                  # 기존 파일 (유지)
│   │   └── v2/                                 # 새로운 구조
│   │       ├── DebateChatContainer.tsx         # 최상위 컨테이너
│   │       ├── components/                     # UI 컴포넌트
│   │       │   ├── ParticipantGrid.tsx         # 참가자 표시 영역
│   │       │   ├── MessageList.tsx             # 메시지 목록
│   │       │   ├── MessageInput.tsx            # 입력 영역
│   │       │   ├── TurnIndicator.tsx           # 발언 차례 표시
│   │       │   ├── ControlPanel.tsx            # Next 버튼 등 컨트롤
│   │       │   └── ParticipantCard.tsx         # 개별 참가자 카드
│   │       ├── hooks/                          # 커스텀 훅
│   │       │   ├── useDebateState.ts           # 토론 상태 관리
│   │       │   ├── useSocketConnection.ts      # 소켓 연결 관리
│   │       │   ├── useMessageHandling.ts       # 메시지 처리
│   │       │   ├── useTurnManagement.ts        # 발언 순서 관리
│   │       │   └── useDebateControls.ts        # 토론 제어 (pause/resume)
│   │       ├── types/                          # 타입 정의
│   │       │   ├── debate.types.ts             # 토론 관련 타입
│   │       │   ├── message.types.ts            # 메시지 관련 타입
│   │       │   └── participant.types.ts        # 참가자 관련 타입
│   │       └── utils/                          # 유틸리티
│   │           ├── debateHelpers.ts            # 토론 관련 헬퍼
│   │           ├── messageFormatters.ts        # 메시지 포맷팅
│   │           └── participantUtils.ts         # 참가자 유틸리티
│   └── ui/                                     # 공통 UI 컴포넌트
│       ├── Avatar.tsx
│       ├── Button.tsx
│       ├── Badge.tsx
│       └── LoadingSpinner.tsx
├── app/
│   ├── chat/
│   │   ├── page.tsx                            # 기존 파일 (유지)
│   │   └── v2/                                 # 새로운 구조
│   │       ├── page.tsx                        # 새로운 페이지
│   │       ├── components/                     # 페이지 전용 컴포넌트
│   │       │   ├── ChatPageContainer.tsx       # 페이지 컨테이너
│   │       │   └── ChatTypeSelector.tsx        # 채팅 타입 선택
│   │       └── hooks/                          # 페이지 전용 훅
│   │           ├── useChatPage.ts              # 페이지 상태 관리
│   │           └── useChatDataLoader.ts        # 데이터 로딩
│   └── api/
│       └── socket/                             # Socket.IO API 라우트 정리
├── lib/
│   ├── socket/
│   │   ├── socketClient.ts                     # 기존 파일 (유지)
│   │   └── v2/                                 # 새로운 구조
│   │       ├── SocketManager.ts                # 소켓 연결 관리자
│   │       ├── EventEmitter.ts                 # 이벤트 에미터
│   │       └── types.ts                        # 소켓 이벤트 타입
│   ├── services/
│   │   ├── chatService.ts                      # 기존 파일 (개선)
│   │   ├── debateService.ts                    # 토론 전용 서비스
│   │   └── realtimeService.ts                  # 실시간 통신 서비스
│   └── types/
│       ├── chat.types.ts                       # 채팅 공통 타입
│       ├── api.types.ts                        # API 응답 타입
│       └── socket.types.ts                     # 소켓 이벤트 타입
└── styles/
    └── components/
        └── debate-chat.css                     # 컴포넌트별 스타일 분리
```

## 🚀 마이그레이션 전략

### Phase 1: 타입 정의 및 서비스 분리
1. 타입 정의 추출 및 정리
2. 서비스 레이어 분리 (API 호출, 소켓 통신)
3. 커스텀 훅 생성 (상태 관리 로직 분리)

### Phase 2: 컴포넌트 분해
1. UI 컴포넌트 단위로 분할
2. 각 컴포넌트별 Props 인터페이스 정의
3. Storybook 추가하여 컴포넌트별 독립 개발

### Phase 3: 새로운 페이지 구현
1. v2 디렉토리에 새로운 구조로 구현
2. Feature Flag로 기존/신규 버전 선택 가능
3. A/B 테스트를 통한 점진적 전환

### Phase 4: 기존 코드 교체
1. 충분한 테스트 후 기존 파일을 새로운 구조로 교체
2. 기존 파일을 deprecated 디렉토리로 이동
3. 문서화 및 팀 교육

## 📋 상세 분할 계획

### 1. DebateChatUI.tsx 분할
- **ParticipantGrid**: 참가자 프로필 표시 (300 라인 → 80 라인)
- **MessageList**: 메시지 렌더링 (400 라인 → 120 라인)
- **MessageInput**: 입력 UI 및 검증 (200 라인 → 60 라인)
- **TurnIndicator**: 발언 차례 표시 (100 라인 → 40 라인)
- **ControlPanel**: 버튼 및 컨트롤 (150 라인 → 50 라인)

### 2. page.tsx 분할
- **ChatPageContainer**: 라우팅 및 전체 상태 (200 라인)
- **useChatDataLoader**: 데이터 로딩 로직 (150 라인)
- **useSocketIntegration**: WebSocket 통합 관리 (200 라인)
- **ChatTypeSelector**: 채팅 타입별 컴포넌트 선택 (100 라인)

## 🛠️ 개발 도구 및 규칙

### TypeScript 규칙
- 모든 Props는 interface로 정의
- 유니온 타입 대신 enum 사용
- Generic 타입 적극 활용

### 컴포넌트 규칙
- 단일 책임 원칙 (SRP) 준수
- Props는 5개 이하로 제한
- 컴포넌트당 100라인 이하 목표

### 훅 규칙
- 하나의 훅은 하나의 관심사만 처리
- 상태와 액션 분리
- 의존성 배열 최적화

## 🧪 테스트 전략

### 단위 테스트
- 각 컴포넌트별 Jest + RTL
- 커스텀 훅 테스트
- 서비스 레이어 테스트

### 통합 테스트
- 페이지 레벨 E2E 테스트
- 소켓 이벤트 시나리오 테스트
- API 통합 테스트

## 📈 성능 최적화

### 렌더링 최적화
- React.memo 적용
- useMemo, useCallback 활용
- 가상화 스크롤 (react-window)

### 번들 최적화
- 코드 스플리팅
- 동적 import
- Tree shaking

## 🔧 개발 환경 설정

### 필요한 패키지
```json
{
  "devDependencies": {
    "@storybook/react": "^7.0.0",
    "@testing-library/react": "^13.0.0",
    "@testing-library/jest-dom": "^5.0.0",
    "@types/testing-library__jest-dom": "^5.0.0"
  },
  "dependencies": {
    "react-window": "^1.8.8",
    "react-error-boundary": "^4.0.11"
  }
}
```

### 설정 파일
- `.storybook/main.js` - Storybook 설정
- `jest.config.js` - 테스트 설정
- `tsconfig.json` - 경로 별칭 설정 