# 시스템 이미지 관리

## 폴더 구조
```
system/
├── default-user.png         # 기본 사용자 프로필 이미지
├── default-philosopher.png  # 기본 철학자 이미지
├── default-npc.png         # 기본 NPC 이미지
├── default-moderator.png   # 기본 모더레이터 이미지
├── default-room.png        # 기본 채팅방 썸네일
├── logo.svg               # 로고
└── icons/                 # 시스템 아이콘들
    ├── upload.svg
    ├── chat.svg
    └── philosophy.svg
```

## 이미지 요구사항
- 모든 기본 이미지: 400x400px
- 포맷: PNG (투명 배경 지원)
- 아이콘: SVG 형식
- 색상: 브랜드 컬러 시스템과 일치

## 사용법
```typescript
import { getSystemImage, DEFAULT_IMAGES } from '@/lib/imageUtils';

// 시스템 이미지 URL 가져오기
const logoUrl = getSystemImage('logo', 'svg');
const defaultUserImage = DEFAULT_IMAGES.user;
``` 