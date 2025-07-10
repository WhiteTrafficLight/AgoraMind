# AgoraMind 로그 레벨 시스템 가이드

## 환경변수 설정

`.env.local` 또는 `.env.production` 파일에 다음 설정을 추가하세요:

```bash
# 전체 로그 레벨 (ERROR, WARN, INFO, DEBUG)
NEXT_PUBLIC_LOG_LEVEL=ERROR

# 카테고리별 세부 설정 (선택사항)
NEXT_PUBLIC_SOCKET_LOG_LEVEL=ERROR
NEXT_PUBLIC_CHAT_LOG_LEVEL=ERROR  
NEXT_PUBLIC_API_LOG_LEVEL=WARN
NEXT_PUBLIC_NPC_LOG_LEVEL=ERROR
NEXT_PUBLIC_AUTH_LOG_LEVEL=WARN
NEXT_PUBLIC_DB_LOG_LEVEL=ERROR
NEXT_PUBLIC_UI_LOG_LEVEL=ERROR
NEXT_PUBLIC_RAG_LOG_LEVEL=ERROR
```

## 로그 레벨 설명

- **ERROR**: 에러만 표시 (프로덕션 권장)
- **WARN**: 경고 + 에러 표시
- **INFO**: 정보 + 경고 + 에러 표시
- **DEBUG**: 모든 로그 표시 (개발환경 권장)

## 사용법

### 기본 사용
```typescript
import { logger, loggers } from '@/utils/logger';

// 기본 로거
logger.error('심각한 오류 발생');
logger.warn('경고 메시지');
logger.info('정보성 메시지');
logger.debug('디버깅 정보');

// 카테고리별 로거
loggers.socket.debug('소켓 연결됨');
loggers.chat.info('새 메시지 수신');
loggers.api.warn('API 응답 지연');
```

### 기존 console.log 교체
```typescript
// 이전
console.log('✅ 사용자 로그인 성공');

// 이후
loggers.auth.info('사용자 로그인 성공');
```

## 런타임 제어

배포환경에서 브라우저 개발자 도구를 통해 로그 레벨을 동적으로 변경 가능:

```javascript
// 도움말 보기
AgoraLoggers.showHelp()

// 모든 로그 활성화
AgoraLoggers.setGlobalLevel('DEBUG')

// 에러만 표시
AgoraLoggers.setGlobalLevel('ERROR')

// 특정 카테고리만 디버그 모드
loggerControls.setSOCKETLogLevel('DEBUG')
loggerControls.setCHATLogLevel('INFO')

// 현재 설정 확인
loggerControls.getSOCKETLogLevel()
```

## URL 파라미터로 디버그 모드

```
https://agoramind.net?debug
```
URL에 `?debug` 파라미터를 추가하면 모든 로그가 활성화됩니다.

## 그룹 로깅 및 성능 측정

```typescript
// 그룹으로 로그 정리
logger.group('사용자 인증 프로세스');
logger.debug('토큰 검증 시작');
logger.debug('DB 조회 중');
logger.groupEnd();

// 성능 측정
logger.time('API 응답시간');
// ... API 호출
logger.timeEnd('API 응답시간');

// 긴급 디버깅 (항상 출력)
logger.force('긴급 디버깅 정보');
```

## 배포 환경별 권장 설정

### 개발환경 (.env.local)
```bash
NEXT_PUBLIC_LOG_LEVEL=DEBUG
```

### 스테이징환경 (.env.staging)  
```bash
NEXT_PUBLIC_LOG_LEVEL=INFO
```

### 프로덕션환경 (.env.production)
```bash
NEXT_PUBLIC_LOG_LEVEL=ERROR
NEXT_PUBLIC_API_LOG_LEVEL=WARN  # API 에러는 모니터링 필요
```

## 마이그레이션 가이드

기존 console.log를 점진적으로 교체:

1. **우선순위 높은 파일**: 채팅, 소켓, 인증 관련
2. **카테고리 분류**: 기능별로 적절한 로거 사용
3. **로그 레벨 분류**:
   - 에러: `logger.error()`
   - 중요 상태: `logger.warn()`  
   - 정보성: `logger.info()`
   - 디버깅: `logger.debug()` 