# 🚗 차량 운행일지 시스템 — 프로젝트 이관 문서

> **작성일**: 2026-06-21
> **작성자**: 경영지원그룹 (전임 관리자)
> **대상**: 후임 프로젝트 관리자
>
> 이 문서는 후임자가 프로젝트를 받아 **즉시 로컬 환경을 세팅하고, AI(바이브코딩)로 추가 개발 및 유지보수**를 이어받을 수 있도록 작성된 종합 이관 가이드입니다.
>
> 설치 명령어만 빠르게 필요하다면 [01_SETUP.md](./01_SETUP.md)를 참고하세요.

---

## 목차

1. [프로젝트 개요 및 기술 스택](#1-프로젝트-개요-및-기술-스택)
2. [디렉토리 구조 및 핵심 소스 설명](#2-디렉토리-구조-및-핵심-소스-설명)
3. [로컬 개발 환경 구축 가이드](#3-로컬-개발-환경-구축-가이드)
4. [데이터베이스 구조 정의](#4-데이터베이스-구조-정의)
5. [바이브코딩(AI) 유지보수 가이드](#5-바이브코딩ai-유지보수-가이드)
6. [배포 및 이관 체크리스트](#6-배포-및-이관-체크리스트)

---

## 1. 프로젝트 개요 및 기술 스택

### 1-1. 시스템 목적

삼우에레코주식회사 영업용 차량의 운행 내역을 실시간으로 기록하고, 세무·회계용 차량운행일지를 자동 생성하는 웹 기반 시스템입니다.

| 구분 | 대상 | 주요 기능 |
|------|------|-----------|
| **관리자 웹** | 경영지원그룹 담당자 | 차량·운전자 관리, 운행현황 모니터링, 승인 처리, Excel/PDF 보고서 출력 |
| **운전자 앱** | 영업사원 등 차량 운전자 | 모바일 브라우저에서 출발·도착 기록 입력, 운행일지 제출, 비밀번호 관리 |

**운행 유형 3가지**: 업무(회사 경비) / 출퇴근(개인 경비) / 개인사용(개인 부담)

**서비스 URL**: https://vehicle-log-app-two.vercel.app

---

### 1-2. 기술 스택

```
┌──────────────────────────────────────────────────────────┐
│  Frontend                                                │
│  - Next.js 14.2.35 (App Router + Server Components)     │
│  - TypeScript                                            │
│  - Tailwind CSS                                          │
│  - shadcn/ui (컴포넌트 라이브러리)                        │
│  - Recharts (대시보드 차트)                               │
│  - Lucide React (아이콘)                                  │
├──────────────────────────────────────────────────────────┤
│  Backend / API                                           │
│  - Next.js Route Handlers (API Routes)                  │
│  - Supabase Auth (이메일 인증 + RBAC)                    │
│  - @supabase/supabase-js + @supabase/ssr                │
├──────────────────────────────────────────────────────────┤
│  Database                                                │
│  - Supabase (PostgreSQL + RLS 정책)                      │
│  - Project ID: qusiqhybzzuwhofryoql (Seoul Region)      │
├──────────────────────────────────────────────────────────┤
│  파일 생성                                                │
│  - SheetJS (xlsx) — Excel 보고서 3종                     │
│  - @react-pdf/renderer — PDF 운행일지                    │
├──────────────────────────────────────────────────────────┤
│  이메일                                                   │
│  - Resend (운전자 초대 알림)                              │
├──────────────────────────────────────────────────────────┤
│  배포                                                     │
│  - Vercel (GitHub main 브랜치 자동 배포)                  │
│  - GitHub Repository (소스 코드 관리)                     │
└──────────────────────────────────────────────────────────┘
```

---

## 2. 디렉토리 구조 및 핵심 소스 설명

### 2-1. 전체 디렉토리 트리

```
vehicle-log-app/
├── CLAUDE.md                          # AI 작업 컨텍스트 파일 (반드시 읽을 것)
├── 01_SETUP.md                        # 초기 설치 가이드 (빠른 시작)
├── 02_HANDOVER.md                     # 이 이관 문서
├── .env.local                         # 환경변수 (Git 미포함 — 별도 수령 필요)
├── .env.example                       # 환경변수 양식
│
├── scripts/
│   └── bulk-set-passwords.mjs         # ⚠️ 관리자 전용 스크립트 (Git 커밋 금지)
│
├── src/
│   ├── middleware.ts                   # 세션 자동 갱신 + 인증 라우팅
│   │
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx           # 로그인 페이지 (세션 감지 → 자동 리다이렉트)
│   │   │
│   │   ├── (mobile)/                  # 📱 운전자 모바일 앱 (max-w-md)
│   │   │   ├── layout.tsx             # ★ 모바일 공통 레이아웃 + 비번 강제변경 체크
│   │   │   ├── loading.tsx            # 홈 스켈레톤 UI
│   │   │   ├── page.tsx               # 홈 — 월별 운행 집계 카드
│   │   │   │
│   │   │   ├── trip/
│   │   │   │   ├── start/
│   │   │   │   │   ├── loading.tsx
│   │   │   │   │   └── _components/
│   │   │   │   │       └── TripStartForm.tsx   # ★ 출발 등록 폼
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── end/_components/
│   │   │   │   │   │   └── TripEndForm.tsx     # ★ 도착 등록 폼
│   │   │   │   │   └── complete/_components/
│   │   │   │   │       └── DeleteTripButton.tsx
│   │   │   │
│   │   │   ├── my-trips/              # 내 운행 기록 조회
│   │   │   │   ├── loading.tsx
│   │   │   │   └── _components/
│   │   │   │       └── TripActionButtons.tsx   # 수정/삭제/제출 버튼
│   │   │   │
│   │   │   ├── vehicle-trips/         # 차량별 기록 조회
│   │   │   │   └── loading.tsx
│   │   │   │
│   │   │   └── profile/               # 프로필 + 비밀번호 변경
│   │   │       ├── loading.tsx
│   │   │       └── _components/
│   │   │           ├── ChangePasswordForm.tsx  # 눈 아이콘 포함 비번 변경 폼
│   │   │           └── LogoutButton.tsx
│   │   │
│   │   ├── admin/                     # 🖥️ 관리자 웹
│   │   │   ├── layout.tsx             # 관리자 공통 레이아웃 (사이드바)
│   │   │   ├── dashboard/
│   │   │   │   ├── loading.tsx
│   │   │   │   └── _components/
│   │   │   │       ├── VehicleMonthlyStats.tsx  # 차량별 월간 집계
│   │   │   │       ├── DriverMonthlyStats.tsx   # 운전자별 월간 집계
│   │   │   │       └── DashboardExcelButton.tsx
│   │   │   ├── trips/                 # 전체 운행현황
│   │   │   │   └── loading.tsx
│   │   │   ├── vehicles/              # 차량 관리 (CRUD + 운전자 배정)
│   │   │   ├── drivers/               # 운전자 관리 (계정 생성 + 비번 설정)
│   │   │   │   ├── loading.tsx
│   │   │   │   └── _components/
│   │   │   │       ├── DriversClient.tsx        # ★ 31명 BULK_DRIVERS 데이터 내장
│   │   │   │       ├── DriverModal.tsx           # 운전자 추가/수정
│   │   │   │       ├── ResetPasswordDialog.tsx   # 비밀번호 초기화
│   │   │   │       └── BulkImportDriverModal.tsx # 일괄 등록
│   │   │   ├── approvals/             # 승인 관리
│   │   │   │   └── loading.tsx
│   │   │   └── reports/               # 보고서 (Excel/PDF 다운로드)
│   │   │
│   │   └── api/                       # REST API (Route Handlers)
│   │       ├── trips/
│   │       │   ├── route.ts            # GET(목록) / POST(출발 등록)
│   │       │   └── [id]/
│   │       │       ├── route.ts        # GET / PATCH / DELETE
│   │       │       ├── end/route.ts    # PATCH — 도착 등록
│   │       │       ├── submit/route.ts # PATCH — draft→submitted
│   │       │       └── approve/route.ts # PATCH — 승인/반려
│   │       ├── vehicles/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       ├── drivers/route.ts # 차량-운전자 배정
│   │       │       └── bulk/route.ts
│   │       ├── drivers/
│   │       │   ├── route.ts
│   │       │   ├── [id]/route.ts
│   │       │   └── bulk/route.ts       # 운전자 일괄 등록
│   │       ├── auth/
│   │       │   └── change-password/route.ts  # 비번 변경 + password_changed=true
│   │       ├── reports/
│   │       │   ├── excel/route.ts            # 상세 운행일지 Excel
│   │       │   ├── excel/vehicle-summary/    # 차량별 집계 Excel
│   │       │   ├── excel/trips/              # 운행현황 Excel
│   │       │   └── pdf/route.ts              # PDF 운행일지
│   │       └── admin/
│   │           ├── invite-driver/route.ts    # 운전자 초대 이메일
│   │           └── set-driver-password/route.ts # ★ 관리자 계정 생성/비번 설정
│   │
│   ├── components/
│   │   ├── ui/                        # shadcn/ui 컴포넌트
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx          # 로그인 폼 (이메일 기억 + 비번 보기)
│   │   │   └── LogoutButton.tsx
│   │   └── offline/                   # PWA 오프라인 지원 컴포넌트
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # 브라우저용 Supabase 클라이언트
│   │   │   └── server.ts              # 서버용 Supabase 클라이언트 (SSR)
│   │   ├── api/
│   │   │   └── auth-guard.ts          # ★ withAuth() — API 인증/권한 체크
│   │   ├── excel-generator.ts         # Excel 생성 로직
│   │   ├── pdf-generator.tsx          # PDF 생성 로직
│   │   └── offline/                   # IndexedDB 오프라인 저장 로직
│   │
│   └── types/
│       └── database.ts                # DB 테이블 TypeScript 타입 정의
│
├── supabase/
│   └── migrations/
│       ├── 001_init_schema.sql        # 초기 스키마
│       └── 002_vehicle_drivers.sql    # vehicle_drivers N:M 테이블
│
└── public/
    ├── manifest.json                  # PWA 설정
    ├── sw.js                          # Service Worker
    └── icons/                         # PWA 아이콘
```

---

### 2-2. 핵심 파일 역할 요약

| 파일 | 역할 |
|------|------|
| `src/middleware.ts` | 모든 요청 인터셉트 → Supabase 세션 자동 갱신 → 미인증 시 /login 리다이렉트 |
| `src/app/(mobile)/layout.tsx` | 모바일 앱 공통 레이아웃 + **최초 로그인 비번 강제변경 체크** |
| `src/lib/api/auth-guard.ts` | API Route에서 `withAuth(requireAdmin)` 으로 인증/권한 검사 |
| `src/app/api/admin/set-driver-password/route.ts` | 관리자가 운전자 계정 생성 및 비밀번호 설정 |
| `src/app/admin/drivers/_components/DriversClient.tsx` | 운전자 31명 이메일 데이터 내장 + 관리 UI |

---

## 3. 로컬 개발 환경 구축 가이드

### 3-1. 사전 요구사항

| 도구 | 버전 | 확인 명령 |
|------|------|-----------|
| Node.js | 18 이상 | `node -v` |
| npm | 9 이상 | `npm -v` |
| Git | 최신 | `git -v` |

---

### 3-2. 설치 및 실행 순서

```bash
# 1. 저장소 클론
git clone https://github.com/[organization]/vehicle-log-app.git
cd vehicle-log-app

# 2. 의존성 설치
npm install

# 3. 환경변수 파일 생성 (아래 3-3 참고)
cp .env.example .env.local
# → .env.local 파일을 열어 실제 값 입력

# 4. 개발 서버 실행
npm run dev
# → http://localhost:3000 접속

# 5. 빌드 테스트 (배포 전 필수)
npm run build
```

---

### 3-3. 환경변수 (.env.local) 템플릿

```env
# =====================================================
# 차량 운행일지 앱 — 환경변수
# ⚠️ 이 파일은 절대 Git에 커밋하지 마세요
# =====================================================

# Supabase — 프로젝트 설정 페이지에서 확인
# https://supabase.com/dashboard/project/[PROJECT_ID]/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxx

# 앱 도메인 (로컬: http://localhost:3000 / 운영: https://vehicle-log-app-two.vercel.app)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 이메일 발송 — Resend 대시보드에서 발급
# https://resend.com/api-keys
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@samwooeleco.com
```

**각 키값 설명:**

| 변수 | 어디서 확인 | 설명 |
|------|------------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 대시보드 → Settings → API | Supabase 프로젝트 주소 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 위와 동일 | 공개 API 키 (브라우저 노출 가능) |
| `SUPABASE_SERVICE_ROLE_KEY` | 위와 동일 (secret) | **관리자 전용 키 — 절대 공개 금지** |
| `NEXT_PUBLIC_APP_URL` | 직접 입력 | 운행일지 서비스 도메인 |
| `RESEND_API_KEY` | resend.com | 이메일 발송용 API 키 |

> ⚠️ **`SUPABASE_SERVICE_ROLE_KEY`는 Vercel 환경변수에도 반드시 등록해야 합니다.**
> Vercel Dashboard → 프로젝트 → Settings → Environment Variables

---

### 3-4. Vercel 배포 방법

```
1. GitHub에 push → main 브랜치 자동 배포 (이미 설정됨)
2. 환경변수 변경 시: Vercel Dashboard → Settings → Environment Variables → Redeploy
3. 수동 배포: Vercel Dashboard → Deployments → Redeploy
```

---

## 4. 데이터베이스 구조 정의

Supabase SQL Editor: https://supabase.com/dashboard/project/qusiqhybzzuwhofryoql/sql

### 4-1. 테이블 정의

#### `user_roles` — 사용자 역할
```sql
CREATE TABLE user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role    TEXT NOT NULL CHECK (role IN ('admin', 'driver'))
);
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
```

#### `vehicles` — 차량 정보
```sql
CREATE TABLE vehicles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number TEXT NOT NULL UNIQUE,   -- 예: 123가4567
  model        TEXT NOT NULL,          -- 예: 싼타페
  purpose      TEXT,                   -- 용도 메모
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

#### `drivers` — 운전자 정보
```sql
CREATE TABLE drivers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id),  -- 로그인 계정 연결
  employee_no      TEXT UNIQUE,                      -- 사원번호
  name             TEXT NOT NULL,
  department       TEXT,
  phone            TEXT,
  email            TEXT,                             -- 로그인 이메일
  is_active        BOOLEAN DEFAULT true,
  password_changed BOOLEAN DEFAULT false,            -- 최초 비번 변경 여부
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

#### `vehicle_drivers` — 차량-운전자 배정 (N:M)
```sql
CREATE TABLE vehicle_drivers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id  UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vehicle_id, driver_id)
);
```

#### `trip_logs` — 운행 기록 (핵심 테이블)
```sql
CREATE TABLE trip_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id         UUID NOT NULL REFERENCES vehicles(id),
  driver_id          UUID NOT NULL REFERENCES drivers(id),
  -- 출발
  departure_time     TIMESTAMPTZ,
  departure_location TEXT,
  departure_km       INTEGER,
  -- 도착
  arrival_time       TIMESTAMPTZ,
  arrival_location   TEXT,
  arrival_km         INTEGER,
  -- 자동 계산
  distance_km        INTEGER GENERATED ALWAYS AS (arrival_km - departure_km) STORED,
  -- 추가 정보
  toll_fee           INTEGER DEFAULT 0,   -- 통행료 (원)
  purpose            TEXT,               -- 방문 목적
  note               TEXT,               -- 비고
  -- 상태 관리
  status    TEXT DEFAULT 'draft'
            CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  trip_type TEXT DEFAULT '업무'
            CHECK (trip_type IN ('업무', '출퇴근', '개인사용')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**운행 상태(status) 흐름:**
```
draft → submitted → approved
                 ↘ rejected → (수정 후) submitted
```

#### `approvals` — 승인 내역
```sql
CREATE TABLE approvals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_log_id UUID NOT NULL REFERENCES trip_logs(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES auth.users(id),
  action      TEXT NOT NULL CHECK (action IN ('approved', 'rejected')),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

#### `audit_logs` — 삭제/수정 감사 로그
```sql
CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID,
  action     TEXT NOT NULL,       -- 'DELETE' | 'UPDATE' | 'INSERT'
  table_name TEXT NOT NULL,
  record_id  UUID,
  detail     JSONB,               -- 삭제된 데이터 스냅샷
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs: 관리자만 조회"
  ON audit_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));
```

---

### 4-2. 핵심 RLS 정책

```sql
-- 운전자가 draft/rejected 상태 운행기록 수정 허용 (WITH CHECK 필수)
CREATE POLICY "trip_logs: driver 수정"
  ON trip_logs FOR UPDATE
  USING (driver_id = get_my_driver_id() AND status IN ('draft', 'rejected'))
  WITH CHECK (driver_id = get_my_driver_id());

-- user_roles 본인 조회만 허용
CREATE POLICY "user_roles: 본인 조회"
  ON user_roles FOR SELECT
  USING (user_id = auth.uid());
```

---

### 4-3. 데이터 삭제 시 주의사항

연관 데이터가 있는 경우 **반드시 아래 순서로 삭제**해야 합니다.

```sql
-- 차량 삭제 순서 (cascade가 없는 경우 수동 처리)
DELETE FROM approvals   WHERE trip_log_id IN (SELECT id FROM trip_logs WHERE vehicle_id = '[차량ID]');
DELETE FROM trip_logs   WHERE vehicle_id = '[차량ID]';
DELETE FROM vehicle_drivers WHERE vehicle_id = '[차량ID]';
DELETE FROM vehicles    WHERE id = '[차량ID]';
```

---

## 5. 바이브코딩(AI) 유지보수 가이드

### 5-1. AI에게 작업 요청 전 필수 준비사항

> **이 프로젝트는 `CLAUDE.md` 파일에 전체 컨텍스트가 정리되어 있습니다.**
> AI에게 새 작업을 요청할 때 반드시 이 파일을 먼저 읽히세요.

```
"CLAUDE.md 파일을 먼저 읽고 프로젝트 구조를 파악한 뒤 작업을 시작해줘."
```

---

### 5-2. 추천 프롬프트 패턴

#### ✅ 신규 기능 추가 시
```
이 프로젝트는 Next.js 14 App Router + Supabase + shadcn/ui 기반이야.
CLAUDE.md를 읽고 기존 코드 스타일(withAuth 인증, Server Component 우선, 
Tailwind CSS, 한국어 UI)을 유지하면서 [원하는 기능]을 추가해줘.

추가할 기능:
- [구체적인 기능 설명]
- API는 /api/[경로]/route.ts 형태로 생성
- UI는 (mobile) 또는 admin 디렉토리에 위치
```

#### ✅ 버그 수정 시
```
CLAUDE.md를 읽고 아래 버그를 수정해줘.
- 증상: [어떤 화면에서 어떤 오류가 발생하는지]
- 관련 파일: [파일 경로]
- 에러 메시지: [에러 내용]
```

#### ✅ DB 스키마 변경 시
```
CLAUDE.md를 읽고 [테이블명] 테이블에 [컬럼명] 컬럼을 추가해줘.
- Supabase SQL Editor에서 실행할 DDL 쿼리 생성
- 관련 TypeScript 타입(src/types/database.ts) 업데이트
- 영향받는 API와 UI 컴포넌트도 함께 수정
```

---

### 5-3. 코드 작성 규칙 (반드시 AI에게 전달)

| 규칙 | 내용 |
|------|------|
| **언어** | 모든 UI 텍스트, 주석, 변수명은 한국어 또는 영어 혼용 가능 |
| **인증** | 모든 API Route는 `withAuth()` 또는 `withAuth(true)` 로 인증 체크 |
| **DB 쿼리** | 서버 컴포넌트에서는 `createClient()`(server.ts), 클라이언트에서는 fetch API 사용 |
| **커밋 메시지** | 한국어 콜론(:) 금지 — PowerShell 파싱 오류 발생 (`feat-` 형식 사용) |
| **git push** | 반드시 PowerShell에서 직접 실행 (Claude 환경 git lock 문제) |
| **DDL 실행** | DB 스키마 변경은 Supabase SQL Editor에서 직접 실행 |
| **파일 경로** | 한국어 경로는 bash에서 인코딩 문제 → Write/Edit 도구 사용 |
| **shadcn/ui** | DialogClose에 asChild 미지원 → `onClick={() => onOpenChange(false)}` 사용 |

---

### 5-4. 자주 필요한 작업별 참고 파일

| 작업 | 참고할 핵심 파일 |
|------|----------------|
| 새 API 추가 | `src/lib/api/auth-guard.ts` — withAuth 패턴 참고 |
| 관리자 UI 추가 | `src/app/admin/trips/page.tsx` — 기존 관리자 페이지 참고 |
| 모바일 UI 추가 | `src/app/(mobile)/my-trips/page.tsx` — 기존 모바일 페이지 참고 |
| Excel 수정 | `src/lib/excel-generator.ts` |
| 운전자 계정 관리 | `src/app/api/admin/set-driver-password/route.ts` |
| 권한 체크 로직 | `src/lib/api/auth-guard.ts` |

---

## 6. 배포 및 이관 체크리스트

### 6-1. 필수 이관 항목

| # | 항목 | 방법 | 상태 |
|---|------|------|------|
| 1 | **GitHub 저장소 권한** | Repository → Settings → Collaborators → 후임자 이메일 초대 | ☐ |
| 2 | **Supabase 프로젝트 권한** | Supabase Dashboard → Organization → Members → 후임자 초대 | ☐ |
| 3 | **Vercel 프로젝트 권한** | Vercel Dashboard → Settings → Members → 후임자 초대 | ☐ |
| 4 | **환경변수 파일 전달** | `.env.local` 파일을 보안 채널(카카오톡/이메일 암호화)로 전달 | ☐ |
| 5 | **Supabase Service Role Key** | 보안 채널로 별도 전달 (환경변수 중 가장 중요) | ☐ |
| 6 | **Resend API Key** | resend.com 계정 권한 이전 또는 새 키 발급 | ☐ |
| 7 | **관리자 계정 비밀번호** | 앱 관리자 계정(이메일) 비밀번호 전달 | ☐ |

---

### 6-2. 후임자 인수 확인 체크리스트

```
로컬 환경 확인
  ☐ git clone 후 npm install 성공
  ☐ .env.local 파일 생성 및 환경변수 입력
  ☐ npm run dev 로 로컬 실행 확인 (http://localhost:3000)
  ☐ 관리자 계정으로 로그인 성공
  ☐ 운전자 계정으로 로그인 성공

Supabase 접근 확인
  ☐ Supabase Dashboard 로그인 가능
  ☐ SQL Editor 접근 가능
  ☐ Authentication → Users 목록 확인 가능

Vercel 접근 확인
  ☐ Vercel Dashboard 로그인 가능
  ☐ 환경변수 목록 확인 가능
  ☐ 배포 이력 확인 가능

GitHub 접근 확인
  ☐ 저장소 클론 권한 확인
  ☐ main 브랜치 push 권한 확인

기능 동작 확인
  ☐ 관리자: 운행현황 목록 조회
  ☐ 관리자: Excel 보고서 다운로드
  ☐ 관리자: 운전자 비밀번호 초기화
  ☐ 운전자: 출발 등록 → 도착 등록 → 제출
  ☐ 운전자: 프로필 → 비밀번호 변경
```

---

### 6-3. 운영 중 주요 관리 포인트

| 주기 | 작업 |
|------|------|
| **수시** | 운행기록 승인/반려 (관리자 웹 → 승인관리) |
| **월말** | Excel 보고서 3종 다운로드 (상세운행일지 / 차량별집계 / 운행현황) |
| **신규 직원** | 관리자 웹 → 운전자관리 → 추가 → 이메일/비밀번호 설정 |
| **퇴직자** | 관리자 웹 → 운전자관리 → 해당 운전자 비활성화 |
| **신규 차량** | 관리자 웹 → 차량관리 → 추가 → 운전자 배정 |
| **차량 폐차** | 관리자 웹 → 차량관리 → 삭제 (운행기록 cascade 삭제 주의) |

---

### 6-4. 장애 대응 가이드

| 증상 | 원인 | 해결 방법 |
|------|------|-----------|
| 관리자 API 403 오류 | Vercel에 `SUPABASE_SERVICE_ROLE_KEY` 누락 | Vercel 환경변수 추가 후 Redeploy |
| 운전자 로그인 불가 | 이메일 미인증 상태 | Supabase Auth → 해당 유저 → Edit → email_confirm 체크 |
| 배포 후 빌드 실패 | 새 파일 git add 누락 | `git status` 확인 → 누락 파일 `git add` 후 재push |
| DB 쿼리 에러 | RLS 정책 | Supabase → Authentication → Policies 확인 |

---

## 부록 — 서비스 접속 정보 요약

| 서비스 | URL | 용도 |
|--------|-----|------|
| **운행일지 앱** | https://vehicle-log-app-two.vercel.app | 운전자/관리자 실사용 |
| **GitHub** | [전임자에게 URL 수령] | 소스 코드 관리 |
| **Vercel** | https://vercel.com | 배포 및 환경변수 관리 |
| **Supabase** | https://supabase.com/dashboard/project/qusiqhybzzuwhofryoql | DB 및 인증 관리 |
| **Resend** | https://resend.com | 이메일 발송 관리 |

---

> 📌 **인수인계 완료 후**: 전임 관리자의 Supabase/Vercel/GitHub 계정 권한을 제거하고, 관리자 앱 계정 비밀번호를 변경하세요.
