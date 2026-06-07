# CLAUDE.md — 실시간 차량일지 작성 앱

> 이 파일은 Claude가 프로젝트 컨텍스트를 유지하기 위한 기준 문서입니다.
> 새 대화를 시작할 때 이 파일을 먼저 읽고 작업을 이어가세요.

---

## 프로젝트 개요

**앱명**: 실시간 차량일지 작성 앱
**회사**: 삼우에레코주식회사 (경영지원그룹)
**목적**: 영업용 차량 운행 시 출발·도착 정보(운행거리, 목적지, 운전자, 통행료)를 실시간으로 기록하고, 세무·회계용 차량운행일지를 자동 생성한다.
**사용자**: 운전자(모바일) + 관리자(웹)
**배포 URL**: https://vehicle-log-app-two.vercel.app
**관리자 계정**: claude_2@samwooeleco.com

---

## GStack (기술 스택)

```
Frontend  : Next.js 14.2.35 (App Router) + TypeScript
UI        : shadcn/ui (수동) + Tailwind CSS
브랜드    : 곤색 #1f4e79 / Black / Gray / White
폰트      : Noto Sans KR
상태관리  : Zustand
폼        : React Hook Form + Zod
차트      : Recharts (BarChart, PieChart)
DB        : Supabase (PostgreSQL + Auth + Realtime)
ORM       : @supabase/supabase-js + @supabase/ssr
인증      : Supabase Auth (이메일 + RLS)
Excel출력 : SheetJS (xlsx)
PDF출력   : @react-pdf/renderer
이메일    : Resend (운전자 초대 + 승인 알림)
오프라인  : IndexedDB (native)
배포      : Vercel (자동 배포, GitHub main 브랜치)
DB 호스팅 : Supabase Cloud (qusiqhybzzuwhofryoql)
```

### 핵심 디렉터리 구조

```
vehicle-log-app/
├── src/
│   ├── app/
│   │   ├── (auth)/login/              # 로그인 (이메일기억 + 비번보기)
│   │   ├── (mobile)/                  # 운전자 모바일 UI
│   │   │   ├── page.tsx               # 홈 (업무/출퇴근 분리 집계)
│   │   │   ├── trip/start/            # 출발 등록 (유형선택+마지막km자동)
│   │   │   ├── trip/[id]/end/         # 도착 등록
│   │   │   ├── trip/[id]/complete/    # 운행 완료 요약
│   │   │   ├── my-trips/              # 내 기록 (업무/출퇴근 별도 집계)
│   │   │   └── vehicle-trips/         # 차량별 기록
│   │   ├── admin/                     # 관리자 웹 UI
│   │   │   ├── dashboard/             # KPI + 차트 + 차량별월별집계
│   │   │   ├── trips/                 # 운행 현황
│   │   │   ├── vehicles/              # 차량 관리
│   │   │   ├── drivers/               # 운전자 관리 + 초대 이메일
│   │   │   ├── approvals/             # 승인 관리
│   │   │   └── reports/               # Excel + PDF 보고서
│   │   └── api/
│   │       ├── trips/                 # 운행 기록 CRUD (trip_type 포함)
│   │       ├── vehicles/              # 차량 CRUD
│   │       ├── drivers/               # 운전자 CRUD
│   │       ├── reports/excel/         # Excel 생성
│   │       ├── reports/pdf/           # PDF 생성
│   │       └── admin/invite-driver/   # 운전자 초대
│   ├── lib/
│   │   ├── supabase/                  # client.ts + server.ts
│   │   ├── api/auth-guard.ts          # 권한 가드
│   │   ├── validations/               # Zod (vehicle, driver, trip + trip_type)
│   │   ├── email/                     # Resend 이메일
│   │   ├── offline/                   # IndexedDB + 동기화
│   │   ├── excel-generator.ts
│   │   └── pdf-generator.tsx
│   └── components/
│       ├── ui/
│       ├── auth/                      # LoginForm (이메일기억+눈아이콘) + LogoutButton
│       └── offline/                   # OfflineBanner, InstallPrompt
├── supabase/
│   ├── migrations/001_init_schema.sql
│   └── seed.sql
└── docs/
    ├── user-manual.md
    ├── deployment-guide.md
    └── e2e-checklist.md
```

---

## DB 스키마 요약

```
user_roles   : user_id, role (driver/admin)
vehicles     : id, plate_number, model, purpose, is_active
drivers      : id, user_id, employee_no, name, department, email, is_active
trip_logs    : id, vehicle_id, driver_id,
               departure_*, arrival_*,
               distance_km (GENERATED STORED),
               toll_fee, status, note,
               trip_type VARCHAR(10) DEFAULT '업무'  ← NEW
approvals    : id, trip_log_id, approver_id, action, comment
```

**상태 머신**: `draft → submitted → approved / rejected`

**trip_type 값**: `'업무'` | `'출퇴근'`

---

## GSD 태스크 목록 및 진행 상황

### Phase 1 — 기반 구축

| TASK | 이름 | 상태 | 완료일 |
|------|------|------|--------|
| TASK_01 | 프로젝트 초기화 및 환경 설정 | ✅ 완료 | 2026-06-05 |
| TASK_02 | DB 스키마 설계 및 생성 | ✅ 완료 | 2026-06-05 |
| TASK_03 | 인증 시스템 (Supabase Auth + RBAC) | ✅ 완료 | 2026-06-05 |

### Phase 2 — 핵심 기능

| TASK | 이름 | 상태 | 완료일 |
|------|------|------|--------|
| TASK_04 | 차량·운전자 관리 API | ✅ 완료 | 2026-06-05 |
| TASK_05 | 차량·운전자 관리 UI (관리자) | ✅ 완료 | 2026-06-05 |
| TASK_06 | 운행 기록 API | ✅ 완료 | 2026-06-05 |
| TASK_07 | 운행 기록 입력 UI (모바일) | ✅ 완료 | 2026-06-05 |
| TASK_08 | 운행 내역 조회 UI | ✅ 완료 | 2026-06-05 |

### Phase 3 — 부가 기능

| TASK | 이름 | 상태 | 완료일 |
|------|------|------|--------|
| TASK_09 | 관리자 대시보드 | ✅ 완료 | 2026-06-05 |
| TASK_10 | Excel 보고서 출력 | ✅ 완료 | 2026-06-05 |
| TASK_11 | PDF 보고서 출력 | ✅ 완료 | 2026-06-05 |
| TASK_12 | 승인 워크플로우 | ✅ 완료 | 2026-06-05 |
| TASK_13 | 이메일 알림 | ✅ 완료 | 2026-06-05 |
| TASK_14 | PWA 오프라인 지원 | ✅ 완료 | 2026-06-05 |
| TASK_15 | 최종 QA & 운영 배포 | ✅ 완료 | 2026-06-05 |

### Phase 4 — 배포 후 개선 (2026-06-06)

| EXT | 이름 | 상태 | 완료일 |
|-----|------|------|--------|
| EXT_01 | Vercel 배포 (빌드 에러 해결) | ✅ 완료 | 2026-06-06 |
| EXT_02 | Supabase DB 스키마 적용 | ✅ 완료 | 2026-06-06 |
| EXT_03 | 관리자 계정 생성 및 권한 부여 | ✅ 완료 | 2026-06-06 |
| EXT_04 | 날짜/시간 입력 필드 추가 | ✅ 완료 | 2026-06-06 |
| EXT_05 | 차량별 기록 탭 (/vehicle-trips) | ✅ 완료 | 2026-06-06 |
| EXT_06 | 운전자 초대 시스템 (자동 계정 연결) | ✅ 완료 | 2026-06-06 |
| EXT_07 | drivers 테이블 email 컬럼 추가 | ✅ 완료 | 2026-06-06 |
| EXT_08 | 업무/출퇴근 구분 (trip_type) | ✅ 완료 | 2026-06-06 |
| EXT_09 | 차량별 마지막 도착km 자동 입력 | ✅ 완료 | 2026-06-06 |
| EXT_10 | 업무/출퇴근 월별 별도 집계 (모바일) | ✅ 완료 | 2026-06-06 |
| EXT_11 | 관리자 대시보드 차량별 월별 집계 | ✅ 완료 | 2026-06-06 |
| EXT_12 | 로그인 이메일 기억 + 비밀번호 보기 | ✅ 완료 | 2026-06-06 |

**전체 진행률**: 27 / 27 완료 (100%) 🎉

---

## 주요 설계 결정사항

### 빌드 이슈 해결
- `app/page.tsx`와 `app/(mobile)/page.tsx` URL 충돌 → `app/page.tsx` 삭제
- `next-pwa` 제거 (Next.js 14 충돌)
- 미들웨어에서 Supabase 제거 → 단순 쿠키 체크 (Edge Runtime 호환)

### 운행 유형 구분 (trip_type)
- `'업무'` : 영업/출장 등 회사 업무 → 승인 대상, Excel/PDF 증빙
- `'출퇴근'` : 개인 출퇴근 → 별도 집계, 개인 통행료 관리

### 운전자 계정 관리
```
관리자 → 운전자 등록(이메일 포함) → "초대 발송"
→ Supabase inviteUserByEmail → drivers.user_id 연결
→ 운전자: 이메일 링크 → 비밀번호 설정 → 로그인
→ loginAction: 이메일 매칭으로 user_id 자동 연결
```

### 개발 규칙 (Claude 작업 지침)
- **한 번에 하나의 기능만** 구현
- **Python으로 파일 작성** — bash cp 시 한국어 경로 인코딩 잘림 방지
- **git 커밋 메시지** — 한국어 콜론(:) 사용 금지 (PowerShell 오류)
- **타입 우선** — `src/types/database.ts` 기반
- **Supabase 클라이언트** — Server: `lib/supabase/server.ts`, Client: `lib/supabase/client.ts`

---

## Supabase 프로젝트 정보

- **Project ID**: qusiqhybzzuwhofryoql
- **URL**: https://qusiqhybzzuwhofryoql.supabase.co
- **Region**: Northeast Asia (Seoul)

---

## 개발 환경 실행

```bash
cd vehicle-log-app
npm install
cp .env.example .env.local  # Supabase 키 입력
npm run dev                  # http://localhost:3000
```

---

*마지막 업데이트: 2026-06-06*
