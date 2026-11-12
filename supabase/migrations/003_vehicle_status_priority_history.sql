-- ============================================================
-- 003_vehicle_status_priority_history.sql   (2026-11-12)
-- ① 차량 소유구분·상태(렌트/리스/매각/반납) 관리
-- ② 운전자별 차량 우선순위 (관리자 기본순위 + 운전자 주사용차량)
-- ③ 차량 사용자(운전자) 변경 이력
-- Supabase SQL Editor 에서 1회 실행 (여러 번 실행해도 안전)
-- ============================================================

-- ── ① 차량 소유구분·상태 ─────────────────────────────────────
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS ownership_type     TEXT NOT NULL DEFAULT '자가',   -- 자가 | 렌트 | 리스
  ADD COLUMN IF NOT EXISTS status             TEXT NOT NULL DEFAULT '운행중', -- 운행중 | 매각 | 반납 | 폐차
  ADD COLUMN IF NOT EXISTS rental_company     TEXT,                           -- 렌트/리스사
  ADD COLUMN IF NOT EXISTS contract_start     DATE,                           -- 취득일 또는 렌트·리스 계약 시작일
  ADD COLUMN IF NOT EXISTS contract_end       DATE,                           -- 렌트·리스 계약 만료일
  ADD COLUMN IF NOT EXISTS disposed_date      DATE;                           -- 매각·반납·폐차일

DO $$ BEGIN
  ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_ownership_type_chk
    CHECK (ownership_type IN ('자가','렌트','리스'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_status_chk
    CHECK (status IN ('운행중','매각','반납','폐차'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 기존 비활성 차량은 상태를 '매각'으로 두지 않고 그대로 '운행중' 유지 (관리자가 직접 지정)
COMMENT ON COLUMN public.vehicles.ownership_type IS '소유구분: 자가/렌트/리스';
COMMENT ON COLUMN public.vehicles.status         IS '상태: 운행중/매각/반납/폐차 (운행중이 아니면 is_active=false)';

-- ── ② 차량 우선순위 ──────────────────────────────────────────
-- 관리자 기본 순위 (운전자 기준 1,2,3…  작을수록 우선)
ALTER TABLE public.vehicle_drivers
  ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 1;

-- 운전자가 앱에서 직접 고른 주 사용 차량 (관리자 순위보다 우선)
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS preferred_vehicle_id UUID
    REFERENCES public.vehicles(id) ON DELETE SET NULL;

-- ── ③ 차량 사용자 변경 이력 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicle_driver_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id  UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id   UUID NOT NULL REFERENCES public.drivers(id)  ON DELETE CASCADE,
  start_date  DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Seoul')::date,
  end_date    DATE,                      -- NULL = 현재 사용 중
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.vehicle_driver_history IS '차량-운전자 배정 이력 (사용자 변경 기록)';

CREATE INDEX IF NOT EXISTS idx_vdh_vehicle ON public.vehicle_driver_history (vehicle_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_vdh_driver  ON public.vehicle_driver_history (driver_id);

ALTER TABLE public.vehicle_driver_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "vdh: 인증 사용자 조회" ON public.vehicle_driver_history
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "vdh: admin 관리" ON public.vehicle_driver_history
    FOR ALL USING (public.get_my_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 현재 배정 상태를 이력의 시작점으로 1회 적재 (이미 적재돼 있으면 건너뜀)
INSERT INTO public.vehicle_driver_history (vehicle_id, driver_id, start_date, note)
SELECT vd.vehicle_id, vd.driver_id,
       (vd.created_at AT TIME ZONE 'Asia/Seoul')::date,
       '기존 배정 (이력 기능 도입 시 자동 적재)'
FROM public.vehicle_drivers vd
WHERE NOT EXISTS (
  SELECT 1 FROM public.vehicle_driver_history h
  WHERE h.vehicle_id = vd.vehicle_id AND h.driver_id = vd.driver_id AND h.end_date IS NULL
);
