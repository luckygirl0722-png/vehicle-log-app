# CLAUDE.md — 실시간 차량일지 작성 앱

> 이 파일은 Claude가 프로젝트 컨텍스트를 유지하기 위한 기준 문서입니다.
> 새 대화를 시작할 때 이 파일을 먼저 읽고 작업을 이어가세요.

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **앱명** | 실시간 차량일지 작성 앱 |
| **회사** | 삼우에레코주식회사 (경영지원그룹) |
| **목적** | 영업용 차량 운행 시 출발·도착 정보(운행거리, 목적지, 운전자, 통행료)를 실시간 기록하고 세무·회계용 차량운행일지를 자동 생성 |
| **사용자** | 운전자(모바일 PWA) + 관리자(웹) |
| **배포 URL** | https://vehicle-log-app-two.vercel.app |
| **관리자 계정** | claude_2@samwooeleco.com |
| **마지막 업데이트** | 2026-06-23 (2차) |

---

## GStack (기술 스택)

```
Frontend    : Next.js 14.2.35 (App Router) + TypeScript
UI          : shadcn/ui (수동 설치) + Tailwind CSS
브랜드 컬러 : 곤색 #1E3A5F / Black / Gray / White
폰트        : Noto Sans KR
상태 관리   : Zustand
폼 처리     : React Hook Form + Zod
차트        : Recharts (BarChart, PieChart)
DB          : Supabase (PostgreSQL + Auth + Realtime + RLS)
ORM         : @supabase/supabase-js + @supabase/ssr
인증        : Supabase Auth (이메일 + RLS + RBAC + 자동 로그인)
Excel       : SheetJS (xlsx) — 운행현황·차량별집계·운전자별집계·상세운행일지 4종
PDF         : @react-pdf/renderer
이메일      : Resend (운전자 초대 + 승인 알림)
오프라인    : IndexedDB (native)
배포        : Vercel (GitHub main 브랜치 자동 배포)
DB 호스팅   : Supabase Cloud (Project ID: qusiqhybzzuwhofryoql, Seoul)
```

---

## 환경 변수 (Vercel + .env.local 모두 필요)

| 변수 | 설명 | 필수 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API + withAuth admin 확인용 | ✅ |
| `RESEND_API_KEY` | 이메일 발송 | ✅ |
| `NEXT_PUBLIC_APP_URL` | 앱 도메인 (초대 링크 생성) | ✅ |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY`가 Vercel에 없으면 관리자 권한 API 전체 실패

---

## 핵심 디렉터리 구조

```
vehicle-log-app/
├── src/
│   ├── middleware.ts                        # Supabase SSR 세션 자동 갱신 + x-pathname 헤더 전달
│   ├── app/
│   │   ├── (auth)/login/
│   │   │   └── page.tsx                    # 기존 세션 감지 → 자동 리다이렉트
│   │   ├── (mobile)/
│   │   │   ├── layout.tsx                  # force 비번 변경 체크 (user_metadata 기반)
│   │   │   ├── page.tsx                    # 홈 — 업무/출퇴근/개인사용 집계 카드
│   │   │   ├── trip/start/page.tsx         # DEFAULT_LOCATIONS에 사무실 포함
│   │   │   ├── trip/[id]/end/
│   │   │   │   └── _components/TripEndForm.tsx  # 도착지 빠른선택 버튼 (자택/사무실 등)
│   │   │   ├── my-trips/
│   │   │   │   ├── page.tsx
│   │   │   │   └── _components/
│   │   │   │       ├── BulkSubmitSection.tsx    # 미제출 기록 개별 체크박스 선택 제출
│   │   │   │       ├── BulkSubmitButton.tsx
│   │   │   │       └── SubmitButton.tsx
│   │   │   └── profile/
│   │   │       ├── page.tsx                # force=true 시 강제 변경 배너
│   │   │       └── _components/
│   │   │           └── ChangePasswordForm.tsx  # 눈 아이콘 토글, isForced prop
│   │   ├── admin/
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx
│   │   │   │   └── _components/
│   │   │   │       ├── DriverMonthlyStats.tsx   # 운전자별 집계 + Excel 다운로드 버튼
│   │   │   │       ├── VehicleMonthlyStats.tsx
│   │   │   │       └── DashboardExcelButton.tsx
│   │   │   ├── trips/
│   │   │   │   ├── page.tsx                # trip_type SELECT 포함
│   │   │   │   └── _components/
│   │   │   │       └── TripsClient.tsx     # 운행유형 배지 (업무/출퇴근/개인사용)
│   │   │   └── drivers/
│   │   │       └── _components/
│   │   │           ├── DriverModal.tsx     # 신규 등록 시 계정 자동 생성 안내
│   │   │           ├── DriversClient.tsx
│   │   │           └── ResetPasswordDialog.tsx
│   │   └── api/
│   │       ├── trips/[id]/route.ts         # DELETE: 관리자 service role로 RLS 우회
│   │       ├── auth/change-password/route.ts   # PATCH: 변경 + user_metadata.password_changed=true
│   │       ├── reports/excel/
│   │       │   ├── trips/route.ts          # 운행현황 Excel
│   │       │   ├── vehicle-summary/route.ts
│   │       │   └── driver-summary/route.ts # 운전자별 집계 Excel (신규)
│   │       └── admin/
│   │           └── set-driver-password/route.ts  # password_changed=false로 재설정
│   └── lib/
│       └── api/auth-guard.ts              # withAuth — service role로 admin 역할 확인
├── scripts/
│   └── bulk-set-passwords.mjs             # ⚠️ 서비스 롤 키 포함 — git 커밋 금지
└── supabase/migrations/
    ├── 001_init_schema.sql
    └── 002_vehicle_drivers.sql
```

---

## DB 스키마

```sql
user_roles      (user_id UUID PK, role TEXT)          -- 'driver' | 'admin'

vehicles        (id, plate_number, model, purpose, is_active BOOL)

drivers         (id, user_id, employee_no, name, department, phone, email,
                 is_active, password_changed BOOL DEFAULT false)

vehicle_drivers (vehicle_id, driver_id)               -- UNIQUE(vehicle_id, driver_id)

trip_logs       (
  id UUID PK,
  vehicle_id, driver_id,
  departure_time TIMESTAMPTZ,  departure_location TEXT,  departure_km INT,
  arrival_time   TIMESTAMPTZ,  arrival_location   TEXT,  arrival_km   INT,
  distance_km INT GENERATED ALWAYS AS (arrival_km - departure_km) STORED,
  toll_fee INT DEFAULT 0,
  purpose TEXT, note TEXT,
  status    TEXT DEFAULT 'draft',     -- draft | submitted | approved | rejected
  trip_type TEXT DEFAULT '업무'       -- 업무 | 출퇴근 | 개인사용
)

audit_logs      (id UUID PK, user_id UUID, action TEXT, table_name TEXT,
                 record_id UUID, detail JSONB, created_at TIMESTAMPTZ)
```

**Supabase SQL Editor에서 실행 필요한 DDL:**

```sql
-- 1. drivers 테이블 — 최초 비밀번호 변경 플래그 (완료됐을 수도 있음, 확인 후 실행)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS password_changed BOOL DEFAULT false;

-- 2. audit_logs 테이블 — 감사 로그
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,
  action      TEXT NOT NULL,
  table_name  TEXT NOT NULL,
  record_id   UUID,
  detail      JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs: 관리자만 조회"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
```

---

## GSD 태스크 목록 및 진행 상황

### Phase 1 — 기반 구축

| TASK | 이름 | 상태 |
|------|------|------|
| TASK_01 | 프로젝트 초기화 및 환경 설정 | ✅ 완료 |
| TASK_02 | DB 스키마 설계 및 생성 | ✅ 완료 |
| TASK_03 | 인증 시스템 (Supabase Auth + RBAC) | ✅ 완료 |

### Phase 2 — 핵심 기능

| TASK | 이름 | 상태 |
|------|------|------|
| TASK_04 | 차량·운전자 관리 API | ✅ 완료 |
| TASK_05 | 차량·운전자 관리 UI (관리자) | ✅ 완료 |
| TASK_06 | 운행 기록 API | ✅ 완료 |
| TASK_07 | 운행 기록 입력 UI (모바일) | ✅ 완료 |
| TASK_08 | 운행 내역 조회 UI | ✅ 완료 |

### Phase 3 — 부가 기능

| TASK | 이름 | 상태 |
|------|------|------|
| TASK_09 | 관리자 대시보드 | ✅ 완료 |
| TASK_10 | Excel 보고서 출력 | ✅ 완료 |
| TASK_11 | PDF 보고서 출력 | ✅ 완료 |
| TASK_12 | 승인 워크플로우 | ✅ 완료 |
| TASK_13 | 이메일 알림 (Resend) | ✅ 완료 |
| TASK_14 | PWA 오프라인 지원 | ✅ 완료 |
| TASK_15 | 최종 QA & 운영 배포 (Vercel) | ✅ 완료 |

### Phase 4 — 배포 후 개선

| EXT | 이름 | 상태 |
|-----|------|------|
| EXT_01 | Vercel 빌드 에러 해결 | ✅ 완료 |
| EXT_02 | Supabase DB 스키마 적용 | ✅ 완료 |
| EXT_03 | 관리자 계정 생성 및 권한 부여 | ✅ 완료 |
| EXT_04 | 날짜/시간 직접 입력 필드 추가 | ✅ 완료 |
| EXT_05 | 차량별 기록 탭 (/vehicle-trips) | ✅ 완료 |
| EXT_06 | 운전자 초대 시스템 | ✅ 완료 |
| EXT_07 | drivers 테이블 email 컬럼 추가 | ✅ 완료 |
| EXT_08 | 업무/출퇴근 구분 (trip_type 도입) | ✅ 완료 |
| EXT_09 | 차량별 마지막 도착km 자동 입력 | ✅ 완료 |
| EXT_10 | 업무/출퇴근 월별 별도 집계 (모바일) | ✅ 완료 |
| EXT_11 | 관리자 대시보드 차량별 월별 집계 | ✅ 완료 |
| EXT_12 | 로그인 이메일 기억 + 비밀번호 보기 | ✅ 완료 |
| EXT_13 | 월 전체 일괄 제출 버튼 (모바일) | ✅ 완료 |
| EXT_14 | 출발지 빠른 선택 + 최근 이력 | ✅ 완료 |
| EXT_15 | 운행 완료 화면 수정·뒤로가기 버튼 | ✅ 완료 |
| EXT_16 | 관리자 승인 관리 일괄 승인 버튼 | ✅ 완료 |
| EXT_17 | 대시보드 차량별 집계 Excel 다운로드 | ✅ 완료 |
| EXT_18 | RLS 정책 수정 — driver draft→submitted 허용 | ✅ 완료 |
| EXT_19 | 차량별 집계 Excel (업무/출퇴근 분리) | ✅ 완료 |

### Phase 5 — 기능 확장

| EXT | 이름 | 상태 |
|-----|------|------|
| EXT_20 | 차량 삭제 cascade | ✅ 완료 |
| EXT_21 | 차량 체크박스 일괄 선택·삭제 | ✅ 완료 |
| EXT_22 | 차량-운전자 N:M 매핑 (vehicle_drivers) | ✅ 완료 |
| EXT_23 | 관리자 차량 목록 — 배정 운전자 표시 | ✅ 완료 |
| EXT_24 | 모바일 — 배정된 차량만 표시 | ✅ 완료 |
| EXT_25 | 개인사용 운행 유형 추가 | ✅ 완료 |
| EXT_26 | 대시보드 운전자별 월간 집계 | ✅ 완료 |
| EXT_27 | 차량기록 탭 — 배정 차량·본인 기록만 조회 | ✅ 완료 |
| EXT_28 | 모바일 홈화면 개인사용 집계 카드 | ✅ 완료 |
| EXT_29 | 미제출 기록 수정(?edit=1) + 삭제 기능 | ✅ 완료 |
| EXT_30 | 운행현황 탭 Excel 내보내기 | ✅ 완료 |

### Phase 6 — 운전자 계정 관리

| EXT | 이름 | 상태 |
|-----|------|------|
| EXT_31 | 관리자가 운전자 초기 비밀번호 직접 설정 | ✅ 완료 |
| EXT_32 | 운전자 비밀번호 초기화 버튼 (ResetPasswordDialog) | ✅ 완료 |
| EXT_33 | 모바일 프로필 페이지 + 비밀번호 변경 | ✅ 완료 |
| EXT_34 | 하단 네비게이션 프로필 탭 추가 | ✅ 완료 |
| EXT_35 | 운전자 31명 이메일 일괄 입력 (bulk upsert) | ✅ 완료 |
| EXT_36 | 이메일 미인증 계정 로그인 불가 버그 수정 | ✅ 완료 |
| EXT_37 | withAuth admin 확인 — service role key로 변경 | ✅ 완료 |

### Phase 7 — 성능 개선 & 자동 로그인

| EXT | 이름 | 상태 |
|-----|------|------|
| EXT_38 | 모바일 전 페이지 loading.tsx 스켈레톤 (5개) | ✅ 완료 |
| EXT_39 | 관리자 전 페이지 loading.tsx 스켈레톤 (4개) | ✅ 완료 |
| EXT_40 | 미들웨어 Supabase SSR 세션 자동 갱신 | ✅ 완료 |
| EXT_41 | 로그인 페이지 기존 세션 감지 → 자동 리다이렉트 | ✅ 완료 |

### Phase 8 — 보안 강화

| EXT | 이름 | 상태 |
|-----|------|------|
| EXT_42 | 운전자 31명 초기 비밀번호 일괄 설정 (Samwoo2024!) | ✅ 완료 |
| EXT_43 | 최초 로그인 비밀번호 강제 변경 (user_metadata 기반) | ✅ 완료 |
| EXT_44 | 비밀번호 입력 눈 아이콘 토글 (Eye/EyeOff) | ✅ 완료 |
| EXT_45 | 관리자 비번 초기화 시 password_changed=false 리셋 | ✅ 완료 |
| EXT_46 | audit_logs 테이블 추가 — SQL 제공 완료 | 🟡 SQL 실행 대기 |

### Phase 9 — UI·기능 개선 (2026-06-23)

| EXT | 이름 | 상태 |
|-----|------|------|
| EXT_47 | 관리자 운행현황 목록 — 운행유형 배지 (업무/출퇴근/개인사용) | ✅ 완료 |
| EXT_48 | 출발지 빠른선택에 사무실 추가 | ✅ 완료 |
| EXT_49 | 도착지 빠른선택 버튼 추가 (자택·사무실·본사·가산동) | ✅ 완료 |
| EXT_50 | 대시보드 운전자별 집계 Excel 다운로드 버튼 | ✅ 완료 |
| EXT_51 | 미제출 기록 개별 체크박스 선택 제출 | ✅ 완료 |
| EXT_52 | 관리자 승인대기 기록 삭제 — service role RLS 우회 | ✅ 완료 |
| EXT_53 | 운전자 등록 시 이메일 입력하면 계정 자동 생성 (Samwoo2024!) | ✅ 완료 |
| EXT_54 | 날짜 표시 KST 타임존 수정 (my-trips 서버 UTC→Seoul) | ✅ 완료 |
| EXT_55 | 관리자 운행현황 — 출발km·도착km 컬럼 추가 | ✅ 완료 |
| EXT_56 | 차량기록 페이지 날짜/시간 KST 타임존 수정 | ✅ 완료 |
| EXT_57 | 운행완료 화면 출발/도착 시간 KST 타임존 수정 | ✅ 완료 |
| EXT_58 | 운행시작 출발일시 날짜/시간 분리 입력 (date + time 별도) | ✅ 완료 |
| EXT_59 | 수정 모드 출발 정보(일시·출발지·km·유형·목적) 편집 가능 | ✅ 완료 |

**전체 진행률: 74개 중 73개 완료 (1개 SQL 실행 대기)**

---

## 보안 체크리스트

| 항목 | 상태 | 비고 |
|------|------|------|
| 초기 비밀번호 일괄 설정 | ✅ | Samwoo2024! |
| 최초 로그인 강제 변경 | ✅ | user_metadata.password_changed 기반 |
| 비밀번호 입력 눈 아이콘 | ✅ | Eye/EyeOff |
| 관리자 비번 초기화 → 재강제 | ✅ | password_changed=false 리셋 |
| 관리자 모든 상태 기록 삭제 | ✅ | service role RLS 우회 |
| audit_logs 테이블 | 🟡 SQL 대기 | Supabase SQL Editor 실행 필요 |
| scripts/ gitignore | ⬜ | bulk-set-passwords.mjs 보호 |
| approved 기록 삭제 방지 RLS | ⬜ | 세무자료 보호 고려 |

---

## 운전자 계정 현황 (2026-06-23 기준)

- **전체**: 31명
- **초기 비밀번호 설정**: 31명 (Samwoo2024!)
- **신규 등록 시**: 이메일 입력하면 자동으로 계정 생성 + 초기 비번 Samwoo2024! 세팅
- **로그인 URL**: https://vehicle-log-app-two.vercel.app

---

## 주요 설계 결정 및 주의사항

### 운행 유형 (trip_type) 색상 체계

| 값 | UI 색상 | 배지 색상 | 설명 |
|----|---------|-----------|------|
| `업무` | 파랑 | bg-blue-100 text-blue-700 | 영업·출장. 승인 대상. |
| `출퇴근` | 초록 | bg-green-100 text-green-700 | 출퇴근. 개인 통행료. |
| `개인사용` | 주황 | bg-orange-100 text-orange-700 | 개인 볼일. 개인 부담. |

### 최초 로그인 비밀번호 강제 변경 흐름

```
운전자 앱 진입 (자동로그인 포함 모든 경로)
  → (mobile)/layout.tsx
  → user.user_metadata.password_changed === true 확인
  → false이면 → /profile?force=true 리다이렉트
    (x-pathname 헤더로 /profile 접근 중엔 무한루프 방지)
  → 노란 배너 표시 + 로그아웃 버튼 숨김
  → 비밀번호 변경 완료
  → API PATCH /api/auth/change-password
    → supabase.auth.updateUser({ data: { password_changed: true } })
  → 홈(/) 자동 이동
```

### 신규 운전자 등록 → 계정 자동 생성 흐름

```
관리자 운전자 관리 → 등록 폼에 이메일 입력 + 등록 클릭
  → POST /api/drivers
  → Supabase Auth createUser(email, "Samwoo2024!", user_metadata.password_changed=false)
  → user_roles 에 driver 역할 등록
  → drivers.user_id 연결
  → 목록에 "연결됨" + 비번초기화 버튼 활성화
운전자: 이메일 + Samwoo2024! 로그인 → 강제 비번 변경 → 사용
```

### 미제출 기록 선택 제출 UI

```
BulkSubmitSection (my-trips 상단 고정)
  기본 상태: "미제출 N건 / X건 선택됨" + [선택] + [제출(N건)]
  [선택] 클릭 → 체크박스 목록 펼침
    - 전체 선택/해제 체크박스
    - 개별 기록: 유형배지 + 날짜 + 출발→도착 + km + 통행료
  [제출(N건)] 클릭 → 선택된 ID만 순차 PATCH /api/trips/{id}/submit
```

### Claude 작업 규칙

- **파일 작성** — Write/Edit 도구 사용 (bash 한국어 경로 인코딩 문제)
- **git 커밋** — 반드시 사용자가 PowerShell에서 실행
- **커밋 메시지** — 영어 또는 한국어 (콜론은 반각 : 사용)
- **DB DDL** — Supabase SQL Editor에서 직접 실행
- **scripts/ 디렉터리** — 서비스 롤 키 포함 파일 → git 커밋 금지
- **RLS 우회** — 관리자 DELETE/복잡 UPDATE는 service role client 사용

### API 엔드포인트 목록

| Method | 경로 | 설명 |
|--------|------|------|
| POST | `/api/trips` | 출발 등록 |
| GET/PATCH/DELETE | `/api/trips/[id]` | 상세·수정·삭제 (관리자 삭제: RLS 우회) |
| PATCH | `/api/trips/[id]/end` | 도착 등록 |
| PATCH | `/api/trips/[id]/submit` | draft → submitted |
| PATCH | `/api/trips/[id]/approve` | 승인/반려 |
| GET/POST/DELETE | `/api/vehicles/[id]/drivers` | 차량-운전자 배정 |
| DELETE | `/api/vehicles/[id]` | 차량 cascade 삭제 |
| GET/POST | `/api/drivers` | 운전자 조회/등록 (등록 시 계정 자동 생성) |
| POST | `/api/drivers/bulk` | 운전자 일괄 등록 |
| PATCH | `/api/auth/change-password` | 비밀번호 변경 + user_metadata.password_changed=true |
| GET | `/api/reports/excel` | 상세 운행일지 Excel |
| GET | `/api/reports/excel/vehicle-summary` | 차량별 집계 Excel |
| GET | `/api/reports/excel/driver-summary` | 운전자별 집계 Excel (신규) |
| GET | `/api/reports/excel/trips` | 운행현황 Excel |
| GET | `/api/reports/pdf` | PDF 운행일지 |
| POST | `/api/admin/set-driver-password` | 관리자 운전자 계정 생성·비번 설정 |
| POST | `/api/admin/invite-driver` | 초대 이메일 발송 |

### Supabase 프로젝트 정보

- **Project ID**: qusiqhybzzuwhofryoql
- **Region**: Northeast Asia (Seoul)
- **SQL Editor**: https://supabase.com/dashboard/project/qusiqhybzzuwhofryoql/sql
- **Admin 계정 user_id**: f2ad334d-0a7b-4341-bf16-eb35e068b437

### 개발 환경 실행

```bash
cd vehicle-log-app
npm install
cp .env.example .env.local
# .env.local에 실제 키 입력
npm run dev   # http://localhost:3000
```
