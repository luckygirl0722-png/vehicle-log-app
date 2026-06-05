-- ============================================================
-- 실시간 차량일지 앱 — 초기 스키마
-- 파일: 001_init_schema.sql
-- 실행: Supabase SQL Editor 에 붙여넣고 Run
-- ============================================================

-- ── 확장 ─────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ENUM 타입
-- ============================================================

CREATE TYPE vehicle_purpose AS ENUM ('영업용', '업무용');
CREATE TYPE trip_status     AS ENUM ('draft', 'submitted', 'approved', 'rejected');
CREATE TYPE user_role       AS ENUM ('driver', 'admin');

-- ============================================================
-- 2. 사용자 역할 테이블 (auth.users 확장)
-- ============================================================

CREATE TABLE public.user_roles (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       user_role NOT NULL DEFAULT 'driver',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

COMMENT ON TABLE public.user_roles IS '사용자 역할 (driver | admin)';

-- ============================================================
-- 3. 차량 테이블
-- ============================================================

CREATE TABLE public.vehicles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plate_number VARCHAR(20)  NOT NULL UNIQUE,  -- 예: 12가3456
  model        VARCHAR(50)  NOT NULL,          -- 예: 아반떼
  purpose      vehicle_purpose NOT NULL DEFAULT '영업용',
  note         TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.vehicles              IS '영업용/업무용 차량 목록';
COMMENT ON COLUMN public.vehicles.plate_number IS '차량번호 (유일값)';
COMMENT ON COLUMN public.vehicles.is_active    IS 'FALSE = 소속 이탈/폐차 등 비활성';

-- ============================================================
-- 4. 운전자 테이블
-- ============================================================

CREATE TABLE public.drivers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_no VARCHAR(20)  NOT NULL UNIQUE,  -- 사원번호
  name        VARCHAR(50)  NOT NULL,
  department  VARCHAR(50)  NOT NULL DEFAULT '',
  phone       VARCHAR(20),
  license_no  VARCHAR(30),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.drivers            IS '운전자 목록 (사원과 1:1 매핑)';
COMMENT ON COLUMN public.drivers.user_id    IS 'Supabase Auth 계정 연결 (없을 수도 있음)';
COMMENT ON COLUMN public.drivers.is_active  IS 'FALSE = 퇴직/휴직 등 비활성';

-- ============================================================
-- 5. 운행일지 테이블 (핵심)
-- ============================================================

CREATE TABLE public.trip_logs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id           UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  driver_id            UUID NOT NULL REFERENCES public.drivers(id)  ON DELETE RESTRICT,

  -- 출발 정보
  departure_time       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  departure_location   VARCHAR(200) NOT NULL DEFAULT '',
  departure_km         INTEGER NOT NULL CHECK (departure_km >= 0),

  -- 도착 정보 (운행 완료 전까지 NULL)
  arrival_time         TIMESTAMPTZ,
  arrival_location     VARCHAR(200),
  arrival_km           INTEGER CHECK (arrival_km >= 0),

  -- 자동 계산 (트리거)
  distance_km          INTEGER GENERATED ALWAYS AS (
                         CASE WHEN arrival_km IS NOT NULL
                              THEN arrival_km - departure_km
                              ELSE NULL
                         END
                       ) STORED,

  -- 업무 정보
  purpose              VARCHAR(200) NOT NULL DEFAULT '',
  toll_fee             INTEGER NOT NULL DEFAULT 0 CHECK (toll_fee >= 0),

  -- 상태 및 승인
  status               trip_status NOT NULL DEFAULT 'draft',
  note                 TEXT,

  -- 메타
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 제약: 도착 km는 반드시 출발 km 이상
  CONSTRAINT chk_arrival_km_gte_departure
    CHECK (arrival_km IS NULL OR arrival_km >= departure_km),

  -- 제약: 도착 시각은 반드시 출발 시각 이후
  CONSTRAINT chk_arrival_time_after_departure
    CHECK (arrival_time IS NULL OR arrival_time >= departure_time)
);

COMMENT ON TABLE  public.trip_logs              IS '차량 운행 기록 (핵심 테이블)';
COMMENT ON COLUMN public.trip_logs.distance_km  IS '운행거리 = arrival_km - departure_km (자동 계산, STORED)';
COMMENT ON COLUMN public.trip_logs.status       IS 'draft(작성중) → submitted(제출) → approved(승인)/rejected(반려)';

-- ============================================================
-- 6. 승인 테이블
-- ============================================================

CREATE TABLE public.approvals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_log_id UUID NOT NULL REFERENCES public.trip_logs(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES auth.users(id)       ON DELETE RESTRICT,
  action      VARCHAR(10) NOT NULL CHECK (action IN ('approved', 'rejected')),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.approvals IS '운행일지 승인/반려 이력';

-- ============================================================
-- 7. 인덱스
-- ============================================================

-- trip_logs: 자주 쓰는 조회 패턴에 최적화
CREATE INDEX idx_trip_logs_driver_id       ON public.trip_logs (driver_id);
CREATE INDEX idx_trip_logs_vehicle_id      ON public.trip_logs (vehicle_id);
CREATE INDEX idx_trip_logs_departure_time  ON public.trip_logs (departure_time DESC);
CREATE INDEX idx_trip_logs_status          ON public.trip_logs (status);
-- 월별 집계용 복합 인덱스
CREATE INDEX idx_trip_logs_driver_month
  ON public.trip_logs (driver_id, date_trunc('month', departure_time));

-- drivers
CREATE INDEX idx_drivers_user_id    ON public.drivers (user_id);
CREATE INDEX idx_drivers_employee_no ON public.drivers (employee_no);

-- approvals
CREATE INDEX idx_approvals_trip_log_id ON public.approvals (trip_log_id);

-- ============================================================
-- 8. updated_at 자동 갱신 트리거
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trip_logs_updated_at
  BEFORE UPDATE ON public.trip_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 9. Row-Level Security (RLS) 정책
-- ============================================================

-- 모든 테이블 RLS 활성화
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals  ENABLE ROW LEVEL SECURITY;

-- ── 헬퍼 함수: 현재 사용자 역할 조회 ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── 헬퍼 함수: 현재 사용자의 driver_id 조회 ──────────────────
CREATE OR REPLACE FUNCTION public.get_my_driver_id()
RETURNS UUID AS $$
  SELECT id FROM public.drivers WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────
-- user_roles: 본인 역할만 조회 가능, 수정은 admin만
-- ────────────────────────────────────────────────────────────
CREATE POLICY "user_roles: 본인 조회"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_roles: admin 전체 관리"
  ON public.user_roles FOR ALL
  USING (public.get_my_role() = 'admin');

-- ────────────────────────────────────────────────────────────
-- vehicles: 전체 조회 가능, 수정은 admin만
-- ────────────────────────────────────────────────────────────
CREATE POLICY "vehicles: 인증 사용자 조회"
  ON public.vehicles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "vehicles: admin 등록·수정·삭제"
  ON public.vehicles FOR ALL
  USING (public.get_my_role() = 'admin');

-- ────────────────────────────────────────────────────────────
-- drivers: 전체 조회 가능, 수정은 admin만
-- ────────────────────────────────────────────────────────────
CREATE POLICY "drivers: 인증 사용자 조회"
  ON public.drivers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "drivers: admin 등록·수정·삭제"
  ON public.drivers FOR ALL
  USING (public.get_my_role() = 'admin');

-- ────────────────────────────────────────────────────────────
-- trip_logs: driver는 본인 기록만, admin은 전체
-- ────────────────────────────────────────────────────────────
CREATE POLICY "trip_logs: driver 본인 조회"
  ON public.trip_logs FOR SELECT
  USING (
    public.get_my_role() = 'admin'
    OR driver_id = public.get_my_driver_id()
  );

CREATE POLICY "trip_logs: driver 본인 등록"
  ON public.trip_logs FOR INSERT
  WITH CHECK (driver_id = public.get_my_driver_id());

CREATE POLICY "trip_logs: driver draft 수정"
  ON public.trip_logs FOR UPDATE
  USING (
    driver_id = public.get_my_driver_id()
    AND status = 'draft'
  );

CREATE POLICY "trip_logs: admin 전체 수정"
  ON public.trip_logs FOR UPDATE
  USING (public.get_my_role() = 'admin');

CREATE POLICY "trip_logs: driver draft 삭제"
  ON public.trip_logs FOR DELETE
  USING (
    driver_id = public.get_my_driver_id()
    AND status = 'draft'
  );

-- ────────────────────────────────────────────────────────────
-- approvals: admin만 등록·조회
-- ────────────────────────────────────────────────────────────
CREATE POLICY "approvals: admin 전체 관리"
  ON public.approvals FOR ALL
  USING (public.get_my_role() = 'admin');

CREATE POLICY "approvals: driver 본인 기록 조회"
  ON public.approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_logs tl
      WHERE tl.id = approvals.trip_log_id
        AND tl.driver_id = public.get_my_driver_id()
    )
  );

-- ============================================================
-- 10. 신규 Auth 사용자 가입 시 driver 역할 자동 부여 트리거
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'driver')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
