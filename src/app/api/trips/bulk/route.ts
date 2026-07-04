import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

interface BulkTripRow {
  departure_time:      string;   // ISO 또는 "YYYY-MM-DD" (시간 없으면 09:00 기본)
  arrival_time:        string;   // ISO 또는 "YYYY-MM-DD" (시간 없으면 18:00 기본)
  departure_location?: string;   // 선택 (국세청 양식에 없음)
  arrival_location?:   string;   // 선택
  departure_km:        number;
  arrival_km:          number;
  toll_fee?:           number;
  trip_type:           string;
  purpose?:            string;   // 선택 (없으면 trip_type으로 자동)
  note?:               string;
}

// POST /api/trips/bulk
// Body: { vehicle_id: string; rows: BulkTripRow[] }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: driver } = await supabase
    .from("drivers").select("id").eq("user_id", user.id).single();
  if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 403 });

  const body = await req.json();
  const { vehicle_id, rows } = body as { vehicle_id: string; rows: BulkTripRow[] };

  if (!vehicle_id || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "vehicle_id와 rows 필드가 필요합니다." }, { status: 400 });
  }

  // 배정된 차량인지 확인
  const { data: assigned } = await supabase
    .from("vehicle_drivers")
    .select("vehicle_id")
    .eq("driver_id", driver.id)
    .eq("vehicle_id", vehicle_id)
    .maybeSingle();
  if (!assigned) return NextResponse.json({ error: "배정되지 않은 차량입니다." }, { status: 403 });

  // 날짜만 있는 경우 시간 보정 (국세청 양식: 날짜만 있고 시간 없음)
  function normalizeTime(val: string, defaultTime: string): string {
    if (!val) return "";
    // "YYYY-MM-DD" 형식이면 시간 추가
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return `${val}T${defaultTime}+09:00`;
    return val;
  }

  // 유효성 검사
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const rowNum = i + 1;
    if (!r.departure_time)   errors.push(`${rowNum}번행: 출발 일시 누락`);
    if (!r.arrival_time)     errors.push(`${rowNum}번행: 도착 일시 누락`);
    if (isNaN(r.departure_km) || r.departure_km < 0) errors.push(`${rowNum}번행: 출발km 오류`);
    if (isNaN(r.arrival_km)   || r.arrival_km < 0)   errors.push(`${rowNum}번행: 도착km 오류`);
    if (r.arrival_km <= r.departure_km)               errors.push(`${rowNum}번행: 도착km ≤ 출발km`);
    if (!["업무", "출퇴근", "개인사용"].includes(r.trip_type)) errors.push(`${rowNum}번행: 운행유형 오류`);
  });
  if (errors.length > 0) {
    return NextResponse.json({ error: "입력 오류", details: errors }, { status: 400 });
  }

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const inserts = rows.map(r => {
    const depTime = normalizeTime(r.departure_time, "09:00:00");
    const arrTime = normalizeTime(r.arrival_time,   "18:00:00");
    const purpose = r.purpose
      ? (r.trip_type !== "업무" ? `[${r.trip_type}] ${r.purpose}` : r.purpose)
      : r.trip_type;  // purpose 없으면 trip_type으로 대체
    return {
      vehicle_id,
      driver_id:          driver.id,
      departure_time:     depTime,
      arrival_time:       arrTime,
      departure_location: r.departure_location || "미입력",
      arrival_location:   r.arrival_location   || "미입력",
      departure_km:       r.departure_km,
      arrival_km:         r.arrival_km,
      toll_fee:           r.toll_fee ?? 0,
      trip_type:          r.trip_type,
      purpose,
      note:               r.note ?? null,
      status:             "submitted" as const,
    };
  });

  const { data, error } = await adminClient
    .from("trip_logs")
    .insert(inserts)
    .select("id");

  if (error) {
    console.error("bulk insert error:", error);
    return NextResponse.json({ error: "DB 저장 실패", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: data?.length ?? 0 });
}
