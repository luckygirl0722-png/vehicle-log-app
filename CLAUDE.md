# CLAUDE.md — 실시간 차량일지 작성 앱

> 이 파일은 Claude가 프로젝트 컨텍스트를 유지하기 위한 기준 문서입니다.
> 새 대화를 시작할 때 이 파일을 먼저 읽고 작업을 이어가세요.

---

## 프로젝트 개요

**앱명**: 실시간 차량일지 작성 앱
**목적**: 영업용 차량 운행 시 출발·도착 정보(운행거리, 목적지, 운전자, 통행료)를 실시간으로 기록하고, 세무·회계용 차량운행일지를 자동 생성한다.
**사용자**: 운전자(모바일) + 관리자(웹)

---

## GStack (기술 스택)

```
Frontend  : Next.js 14 (App Router) + TypeScript
UI        : shadcn/ui + Tailwind CSS (브랜드: 곤색 #1f4e79 / Black / Gray / White)
폰트      : Noto Sans KR (Bold/Medium/Regular)
상태관리  : Zustand
폼        : React Hook Form + Zod
차트      : Recharts
DB        : Supabase (PostgreSQL + Auth + Realtime + Storage)
ORM       : Supabase JS Client (@supabase/supabase-js, @supabase/ssr)
인증      : Supabase Auth (이메일 + RLS)
Excel출력 : SheetJS (xlsx)
PDF출력   : @react-pdf/renderer
알림      : Resend (이메일)
PWA       : next-pwa
배포      : Vercel + Supabase Cloud
```

### 핵심 디렉터리 구조
```
vehicle-log-app/
├── src/
│   ├── app/
│   │   ├── (auth)/login/        # 로그인 (TASK_03)
│   │   ├── (mobile)/            # 운전자 모바일 UI (TASK_07~)
│   │   ├── admin/               # 관리자 웹 UI (TASK_05~)
│   │   └── api/                 # Route Handlers (TASK_04~)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts        # 브라우저용 Supabase 클라이언트
│   │   │   └── server.ts        # 서버용 Supabase 클라이언트
│   │   └── utils.ts             # cn(), formatKRW(), formatKm()
│   └── types/
│       └── database.ts          # 전체 DB 스키마 TypeScript 타입
├── supabase/
│   └── migrations/              # SQL 마이그레이션 파일 (TASK_02~)
├── tests/
│   └── task01.test.mjs          # TASK_01 검증 테스트 (87 passed)
├── public/
│   └── manifest.json            # PWA 설정
├── .env.example                 # 환경변수 템플릿
└── SETUP.md                     # 초기 설치 가이드
```

---

## GSD 태스크 목록 및 진행 상황

| 태스크 | 이름 | 상태 | 완료일 |
|--------|------|------|--------|
| **TASK_01** | 프로젝트 초기화 및 환경 설정 | ✅ 완료 | 2026-06-05 |
| **TASK_02** | DB 스키마 설계 및 생성 | ✅ 완료 | 2026-06-05 |
| **TASK_03** | 인증 시스템 (Supabase Auth + RBAC) | ✅ 완료 | 2026-06-05 |
| **TASK_04** | 차량·운전자 관리 API | ✅ 완료 | 2026-06-05 |
| **TASK_05** | 차량·운전자 관리 UI (관리자) | ✅ 완료 | 2026-06-05 |
| **TASK_06** | 운행 기록 API | ✅ 완료 | 2026-06-05 |
| **TASK_07** | 운행 기록 입력 UI (모바일) | ✅ 완료 | 2026-06-05 |
| **TASK_08** | 운행 내역 조회 UI | ✅ 완료 | 2026-06-05 |
| **TASK_09** | 관리자 대시보드 | ✅ 완료 | 2026-06-05 |
| **TASK_10** | Excel 보고서 출력 | ✅ 완료 | 2026-06-05 |
| **TASK_11** | PDF 보고서 출력 | ✅ 완료 | 2026-06-05 |
| **TASK_12** | 승인 워크플로우 | ✅ 완료 | 2026-06-05 |
| **TASK_13** | 이메일 알림 | ✅ 완료 | 2026-06-05 |
| **TASK_14** | PWA 오프라인 지원 | ✅ 완료 | 2026-06-05 |
| **TASK_15** | 최종 QA & 운영 배포 | ✅ 완료 | 2026-06-05 |

**전체 진행률**: 15 / 15 완료 (100%) 🎉

---

## TASK_01 완료 내역

### 생성된 파일
| 파일 | 용도 |
|------|------|
| `package.json` | 의존성 정의 (Next.js 14, Supabase, Zustand, shadcn/ui 등 17종) |
| `tailwind.config.ts` | 브랜드 컬러(곤색 #1f4e79), shadcn/ui CSS 변수 토큰 |
| `next.config.mjs` | PWA(next-pwa) 설정 |
| `src/app/globals.css` | CSS 변수, Noto Sans KR, 모바일 safe-area 유틸 |
| `src/app/layout.tsx` | 루트 레이아웃 (lang=ko, PWA 메타데이터) |
| `src/app/page.tsx` | 루트 → /login 리다이렉트 |
| `src/app/(auth)/login/page.tsx` | 로그인 페이지 placeholder |
| `src/lib/utils.ts` | `cn()`, `formatKRW()`, `formatKm()` |
| `src/lib/supabase/client.ts` | 브라우저용 Supabase 클라이언트 |
| `src/lib/supabase/server.ts` | 서버용 Supabase 클라이언트 (RSC/Route Handler) |
| `src/types/database.ts` | Vehicle, Driver, TripLog, Approval 타입 |
| `components.json` | shadcn/ui 설정 |
| `.env.example` | 환경변수 템플릿 |
| `.prettierrc` | Prettier + tailwindcss 플러그인 |
| `.gitignore` | .env.local, PWA 빌드 파일 포함 |
| `public/manifest.json` | PWA 앱 정보 |
| `SETUP.md` | 설치 가이드 |
| `tests/task01.test.mjs` | **검증 테스트 — 87/87 통과** |

### 테스트 결과
```
[A] 필수 파일 존재 검사    18/18  ✅
[B] JSON 파일 유효성 검사   4/4   ✅
[C] package.json 의존성    20/20  ✅
[D] 환경변수 템플릿 검사    7/7   ✅
[E] 유틸리티 함수 단위테스트 11/11 ✅
[F] TypeScript 타입 구조   10/10  ✅
[G] 설정 파일 핵심 토큰    17/17  ✅
────────────────────────────
합계                      87/87  ✅
```

---

## TASK_02 완료 내역

### 생성된 파일
| 파일 | 용도 |
|------|------|
| `supabase/migrations/001_init_schema.sql` | 전체 스키마 (테이블 5개, 인덱스 7개, 트리거 2개, RLS 정책 13개) |
| `supabase/seed.sql` | 차량 3대, 운전자 5명, 운행기록 6건 테스트 데이터 |
| `tests/task02.test.mjs` | 검증 테스트 — **81/81 통과** |

### 스키마 구조
- `user_roles` — Auth 사용자 역할 (driver/admin), 신규 가입 시 자동 부여 트리거
- `vehicles` — 차량 (plate_number UNIQUE, is_active)
- `drivers` — 운전자 (employee_no UNIQUE, user_id → auth.users)
- `trip_logs` — 운행일지 핵심. `distance_km`은 `GENERATED ALWAYS AS STORED` 자동계산
- `approvals` — 승인/반려 이력

### 핵심 설계 결정사항
- `distance_km` = `arrival_km - departure_km` **DB 레벨 자동계산** (애플리케이션 오류 방지)
- CHECK 제약: `arrival_km >= departure_km`, `arrival_time >= departure_time`
- 신규 Auth 회원가입 → `user_roles`에 `driver` 자동 삽입 (트리거)
- RLS: driver는 본인 `draft` 기록만 수정/삭제 가능, admin은 전체

---

## 다음 작업 — TASK_03

### 목표
Supabase Auth 기반 로그인 + 역할별 라우트 보호 미들웨어 구현

### 핵심 작업
1. Supabase Auth 이메일 로그인 UI (`/login`)
2. Next.js `middleware.ts` — 미인증 시 `/login` 리다이렉트
3. `user_roles` 연동 역할 분기 (driver → 모바일 홈, admin → 대시보드)
4. 로그아웃 기능

### 완료 기준
- 미인증 접근 시 `/login` 리다이렉트 확인
- driver 로그인 → `/` (모바일 홈) 진입
- admin 로그인 → `/admin/dashboard` 진입
- RLS 테스트: driver A가 driver B 기록 조회 불가

---

## 개발 규칙 (Claude 작업 지침)

- **한 번에 하나의 TASK만** 구현 — 다른 TASK 파일은 건드리지 않음
- **API 먼저, UI 나중** — 백엔드 Route Handler 완성 후 UI 연결
- **타입 우선** — `src/types/database.ts` 기반으로 모든 데이터 모양 정의
- **Supabase 클라이언트** — Server Component는 `lib/supabase/server.ts`, Client Component는 `lib/supabase/client.ts` 사용
- **각 TASK 완료 시** — 이 파일의 태스크 상태와 날짜를 업데이트할 것

---

## 환경 설정

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env.local
# → .env.local 에 Supabase 키 입력

# 3. 개발 서버
npm run dev  # http://localhost:3000
```

**Supabase 키 위치**: 대시보드 → Settings → API
