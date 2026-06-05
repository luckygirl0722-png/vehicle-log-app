/**
 * Supabase PostgreSQL 스키마 기반 TypeScript 타입
 * TASK_02 DB 스키마 생성 후 `npx supabase gen types typescript` 로 자동 생성 가능
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      vehicles: {
        Row: Vehicle;
        Insert: Omit<Vehicle, "id" | "created_at">;
        Update: Partial<Omit<Vehicle, "id" | "created_at">>;
      };
      drivers: {
        Row: Driver;
        Insert: Omit<Driver, "id" | "created_at">;
        Update: Partial<Omit<Driver, "id" | "created_at">>;
      };
      trip_logs: {
        Row: TripLog;
        Insert: Omit<TripLog, "id" | "created_at" | "updated_at" | "distance_km">;
        Update: Partial<Omit<TripLog, "id" | "created_at">>;
      };
      approvals: {
        Row: Approval;
        Insert: Omit<Approval, "id" | "created_at">;
        Update: Partial<Omit<Approval, "id" | "created_at">>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      vehicle_purpose: "영업용" | "업무용";
      trip_status: "draft" | "submitted" | "approved" | "rejected";
      user_role: "driver" | "admin";
    };
  };
}

/* ── 차량 ── */
export interface Vehicle {
  id: string;
  plate_number: string;       // 차량번호 (예: 12가3456)
  model: string;              // 차종 (예: 아반떼)
  purpose: "영업용" | "업무용";
  note: string | null;
  created_at: string;
}

/* ── 운전자 ── */
export interface Driver {
  id: string;
  user_id: string | null;     // auth.users 연결 (로그인 계정)
  employee_no: string;        // 사원번호
  name: string;
  department: string;
  phone: string | null;
  license_no: string | null;
  created_at: string;
}

/* ── 운행일지 (핵심 테이블) ── */
export interface TripLog {
  id: string;
  vehicle_id: string;
  driver_id: string;
  departure_time: string;       // ISO 8601
  departure_location: string;
  departure_km: number;
  arrival_time: string | null;
  arrival_location: string | null;
  arrival_km: number | null;
  distance_km: number | null;   // DB 트리거로 자동 계산
  purpose: string;              // 업무 목적
  toll_fee: number;             // 통행료 (원, 기본값 0)
  status: "draft" | "submitted" | "approved" | "rejected";
  note: string | null;
  created_at: string;
  updated_at: string;
  /* JOIN 결과 (선택) */
  vehicle?: Vehicle;
  driver?: Driver;
}

/* ── 승인 ── */
export interface Approval {
  id: string;
  trip_log_id: string;
  approver_id: string;
  action: "approved" | "rejected";
  comment: string | null;
  created_at: string;
}

/* ── 사용자 역할 ── */
export interface UserRole {
  id: string;
  user_id: string;
  role: "driver" | "admin";
  created_at: string;
}
