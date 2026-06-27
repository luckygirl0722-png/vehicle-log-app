-- ============================================================
-- 002_vehicle_drivers.sql
-- 차량-운전자 N:M 배정 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vehicle_drivers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id  UUID NOT NULL REFERENCES public.drivers(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vehicle_id, driver_id)
);

COMMENT ON TABLE public.vehicle_drivers IS '차량-운전자 배정 (N:M)';

CREATE INDEX idx_vehicle_drivers_vehicle ON public.vehicle_drivers (vehicle_id);
CREATE INDEX idx_vehicle_drivers_driver  ON public.vehicle_drivers (driver_id);

-- RLS
ALTER TABLE public.vehicle_drivers ENABLE ROW LEVEL SECURITY;

-- 인증 사용자 전체 조회
CREATE POLICY "vehicle_drivers: 인증 사용자 조회"
  ON public.vehicle_drivers FOR SELECT
  USING (auth.role() = 'authenticated');

-- admin 전체 관리
CREATE POLICY "vehicle_drivers: admin 관리"
  ON public.vehicle_drivers FOR ALL
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- 헬퍼 함수: 현재 운전자에게 배정된 차량 목록
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_vehicle_ids()
RETURNS SETOF UUID AS $$
  SELECT vehicle_id
  FROM public.vehicle_drivers
  WHERE driver_id = public.get_my_driver_id();
$$ LANGUAGE sql STABLE SECURITY DEFINER;
