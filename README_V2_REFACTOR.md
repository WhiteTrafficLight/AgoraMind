# 토론 채팅 UI V2 리팩터링 구조

## 🎯 개요

기존 1200+ 라인의 `DebateChatUI.tsx`와 700+ 라인의 `page.tsx`를 **책임 분리**와 **재사용성** 향상을 위해 리팩터링했습니다.

## 📁 새로운 파일 구조

```
src/components/chat/v2/
├── DebateChatContainer.tsx           # 메인 컨테이너 (기존 DebateChatUI 대체)
├── components/
│   └── MessageInput.tsx              # 메시지 입력 컴포넌트
├── hooks/
│   ├── useDebateState.ts             # 토론 상태 관리 훅
│   └── useSocketConnection.ts        # 소켓 연결 관리 훅
└── types/
    └── debate.types.ts               # 타입 정의

src/app/chat/v2/
└── page.tsx                          # 새로운 페이지 (기존 page.tsx 대체)
```

## 🚀 사용법

### 1. V2 버전 테스트하기

기존 채팅 URL에 `/v2`를 추가하면 새로운 구조를 테스트할 수 있습니다:

```
기존: /chat?id=123
새버전: /chat/v2?id=123
```

### 2. 컴포넌트 사용 예시

```tsx
import DebateChatContainer from '@/components/chat/v2/DebateChatContainer';
import { DebateRoom } from '@/components/chat/v2/types/debate.types';

function MyDebatePage() {
  const room: DebateRoom = {
    id: 123,
    title: "토론 제목",
    dialogueType: 'debate',
    participants: { users: ['User1'] },
    pro: ['NPC1'],
    con: ['NPC2'],
    messages: []
  };

  return (
    <DebateChatContainer
      room={room}
      messages={room.messages || []}
      npcDetails={[]}
      onSendMessage={(msg) => console.log('Message:', msg)}
      onRefresh={() => console.log('Refresh')}
      isLoading={false}
      isGeneratingResponse={false}
      username="You"
    />
  );
}
```

### 3. 커스텀 훅 사용 예시

```tsx
import { useDebateState } from '@/components/chat/v2/hooks/useDebateState';
import { useSocketConnection } from '@/components/chat/v2/hooks/useSocketConnection';

function MyComponent() {
  // 토론 상태 관리
  const {
    isUserTurn,
    setUserTurn,
    selectedNpcId,
    setSelectedNpc,
    isGeneratingResponse,
    setGeneratingResponse
  } = useDebateState();

  // 소켓 연결 관리
  const { socket, isConnected, emitMessage } = useSocketConnection({
    roomId: 123,
    username: 'User',
    onTurnUpdate: (turnInfo) => setUserTurn(turnInfo.isUserTurn),
    onNpcSelected: (npcId) => setSelectedNpc(npcId),
    onNewMessage: (data) => console.log('New message:', data)
  });

  return (
    <div>
      <p>사용자 차례: {isUserTurn ? 'Yes' : 'No'}</p>
      <p>소켓 연결: {isConnected ? '연결됨' : '연결 안됨'}</p>
      <p>선택된 NPC: {selectedNpcId || '없음'}</p>
    </div>
  );
}
```

## 📊 개선 효과

### Before (기존 구조)
- **DebateChatUI.tsx**: 1,284 라인 - 거대한 단일 컴포넌트
- **page.tsx**: 735 라인 - 모든 로직이 한 파일에 집중
- **테스트 어려움**: 컴포넌트가 너무 커서 단위 테스트 불가
- **재사용성 없음**: 특정 기능만 떼어내서 쓸 수 없음

### After (V2 구조)
- **DebateChatContainer.tsx**: ~300 라인 - 관심사 분리
- **MessageInput.tsx**: ~120 라인 - 입력 관련 기능만
- **useDebateState.ts**: ~150 라인 - 상태 관리 로직만
- **useSocketConnection.ts**: ~120 라인 - 소켓 관련 로직만
- **page.tsx**: ~200 라인 - 페이지 로직만

### 라인 수 비교
```
기존 총합: 2,019 라인 (2개 파일)
V2 총합: 990 라인 (6개 파일)
절약: 50% 줄어듦 + 재사용성 대폭 향상
```

## 🛠️ 주요 개선 사항

### 1. 컴포넌트 분리
- **단일 책임 원칙** 적용
- 각 컴포넌트가 100-300라인 내외로 관리 가능한 크기
- Props 인터페이스로 명확한 계약 정의

### 2. 커스텀 훅 도입
- **상태 관리 로직** 분리 (`useDebateState`)
- **소켓 연결 로직** 분리 (`useSocketConnection`)
- 로직 재사용성 확보

### 3. TypeScript 타입 강화
- Enum 사용으로 타입 안정성 향상
- 명확한 인터페이스 정의
- Generic 타입 활용

### 4. 성능 최적화 준비
- `React.memo` 적용 가능한 구조
- `useCallback`, `useMemo` 적용 지점 명확화
- 불필요한 리렌더링 방지 구조

## 🔄 마이그레이션 가이드

### Phase 1: 병행 운영 (현재)
```
기존: /chat?id=123 (기존 구조)
신규: /chat/v2?id=123 (V2 구조)
```

### Phase 2: 기능 완성도 검증
- [ ] 모든 기존 기능이 V2에서 동작 확인
- [ ] 성능 테스트 및 최적화
- [ ] 버그 수정 및 안정화

### Phase 3: 점진적 전환
- [ ] Feature Flag로 사용자별 A/B 테스트
- [ ] 피드백 수집 및 개선
- [ ] 단계적 트래픽 이전

### Phase 4: 완전 전환
- [ ] 기존 구조를 deprecated 폴더로 이동
- [ ] V2 구조를 기본값으로 설정
- [ ] 문서화 및 팀 교육

## 🧪 테스트 전략

### 단위 테스트
```bash
# 컴포넌트 테스트
npm test -- MessageInput.test.tsx

# 훅 테스트
npm test -- useDebateState.test.ts
npm test -- useSocketConnection.test.ts
```

### 통합 테스트
```bash
# 페이지 레벨 테스트
npm test -- ChatPageV2.test.tsx

# E2E 테스트
npm run e2e -- debate-chat-v2.spec.ts
```

## 🐛 알려진 이슈

1. **참가자 그리드 미완성**: 현재 플레이스홀더 상태
2. **메시지 목록 간소화**: 기존 스타일링 일부 누락
3. **타이핑 애니메이션**: 기존 TypingMessage 컴포넌트 의존

## 🔮 다음 단계

### 즉시 개발할 컴포넌트들
1. **ParticipantGrid.tsx** - 참가자 표시 영역
2. **MessageList.tsx** - 메시지 렌더링
3. **TurnIndicator.tsx** - 발언 차례 표시
4. **ParticipantCard.tsx** - 개별 참가자 카드

### 개선 예정 기능들
1. **실시간 동기화** 최적화
2. **타이핑 애니메이션** 개선
3. **접근성(a11y)** 지원
4. **모바일 반응형** 개선
5. **다크모드** 지원

## 📚 참고 자료

- [React 18 공식 문서](https://react.dev/)
- [Next.js 14 문서](https://nextjs.org/docs)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)
- [TailwindCSS 문서](https://tailwindcss.com/docs)

## 🤝 기여 가이드

1. V2 구조에서 새 컴포넌트 개발
2. 기존 코드는 건드리지 않기
3. TypeScript 타입 정의 필수
4. 테스트 코드 작성 권장
5. 100라인 이하 컴포넌트 유지

---

**🎉 V2 구조로 더 깔끔하고 유지보수 가능한 코드를 만들어 보세요!** 