# 차량 운행일지 앱 — 초기 설치 가이드

> 빠르게 로컬 환경만 띄우고 싶다면 이 문서를 따라가세요.
> 프로젝트 전체 구조, DB 스키마, 배포·이관 체크리스트 등 상세 내용은 [02_HANDOVER.md](./02_HANDOVER.md)를 참고하세요.

## 1. 의존성 설치

```bash
cd vehicle-log-app
npm install
```

## 2. 환경변수 설정

```bash
# .env.example을 복사하여 .env.local 생성
cp .env.example .env.local
```

`.env.local` 파일을 열어 Supabase 값을 입력합니다:

| 변수 | 값 위치 |
|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 대시보드 → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 대시보드 → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 대시보드 → Settings → API → service_role |

## 3. 개발 서버 실행

```bash
npm run dev
# → http://localhost:3000 접속
```

## 4. 다음 단계 — TASK_02

Supabase에서 DB 스키마 생성:
- `supabase/migrations/001_init_schema.sql` 파일을 Supabase SQL Editor에서 실행

---

## 폴더 구조

```
src/
├── app/
│   ├── (auth)/login/         # 로그인 페이지 (TASK_03)
│   ├── (mobile)/             # 운전자 모바일 화면 (TASK_07~)
│   ├── admin/                # 관리자 웹 화면 (TASK_05~)
│   ├── api/                  # API Route Handlers (TASK_04~)
│   ├── layout.tsx            # 루트 레이아웃
│   ├── page.tsx              # 루트 → /login 리다이렉트
│   └── globals.css           # 전역 스타일
├── lib/
│   ├── supabase/
│   │   ├── client.ts         # 브라우저용 Supabase 클라이언트
│   │   └── server.ts         # 서버용 Supabase 클라이언트
│   └── utils.ts              # cn(), formatKRW(), formatKm()
└── types/
    └── database.ts           # DB 스키마 TypeScript 타입
```
