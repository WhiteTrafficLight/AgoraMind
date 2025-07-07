# 철학자 이미지 관리

## 폴더 구조
```
philosophers/
├── portraits/          # 고해상도 프로필 사진
├── thumbnails/         # 작은 썸네일 (100x100)
└── metadata/          # 철학자 정보 JSON 파일
```

## 파일 명명 규칙
- 파일명: `{philosopher_id}.{extension}`
- 예시: `socrates.jpg`, `plato.png`
- 지원 포맷: jpg, png, webp

## 이미지 요구사항
- 포트레이트: 400x400px, 최대 200KB
- 썸네일: 100x100px, 최대 50KB
- 포맷: WebP 우선, fallback으로 JPEG 