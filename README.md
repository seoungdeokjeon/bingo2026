# Bingo 2026

친구 4명(전승덕, 전혜지, 서현준, 주혜빈)이 공유하는 5x5 빙고 웹앱입니다.

## Stack

- Frontend: Static HTML/CSS/Vanilla JS
- Backend as a Service: Supabase (Postgres + REST)
- Frontend Hosting: Cloudflare Pages (GitHub 연동 배포)

운영 주소:

- https://bingo2026.pages.dev

## Data Source

앱 데이터는 로컬 스토리지를 사용하지 않고 Supabase만 사용합니다.

주요 테이블:

- `public.profiles`
  - `id` (고정 프로필 ID)
  - `name`
  - `board_json` (25칸: `text`, `emoji`, `checked`)
  - `created_at`
  - `updated_at`
  - `winner_at`

## Supabase Setup

1. Supabase SQL Editor에서 아래 파일 실행:
   - `supabase/migrations/001_profiles.sql`
2. Supabase Project Settings > API에서 값 확인:
   - Project URL
   - anon public key
3. 아래 파일에 입력:
   - `assets/js/supabase-config.js`

```js
window.SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
window.SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

## Local Dev

```bash
cd /Users/sdeok.jeon/Documents/Projects/bingo2026
python3 -m http.server 5500
```

브라우저:

- http://127.0.0.1:5500

## Deployment

- Cloudflare Pages가 GitHub `main` 브랜치와 연결되어 자동 배포됩니다.
- `main`에 푸시하면 `bingo2026.pages.dev`에 반영됩니다.
