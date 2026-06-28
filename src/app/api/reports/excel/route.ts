import { NextRequest, NextResponse } from "next/server";
import { withAuth, badReq, serverErr } from "@/lib/api/auth-guard";
import {
  generateTripLogExcel,
  buildExcelFileName,
  type TripRowData,
  type VehicleSummary,
} from "@/lib/excel-generator";

const COMPANY_NAME = "삼우에레코주식회사";

/**
 * GET /api/reports/excel
 * 쿼리 파라미터:
 *   - year:       number (필수)
 *   - month:      number (필수, 1~12)
 *   - vehicle_id: string (선택 — 특정 차량만)
 *
 * 응답: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 */
export async function GET(request: NextRequest) {
  const { supabase, error } = await withAuth(true); // admin 전용
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const yearStr   = searchParams.get("year");
  const monthStr  = searchParams.get("month");
  const vehicleId = searchParams.get("vehicle_id");
  const allStatus = searchParams.get("all_status") === "true"; // 전체 상태 포함

  // 파라미터 검증
  if (!yearStr || !monthStr) return badReq("year와 month는 필수 파라미터입니다.");

  const year  = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || year < 2020 || year > 2100) return badReq("year가 올바르지 않습니다.");
  if (isNaN(month) || month < 1 || month > 12)   return badReq("month는 1~12 사이여야 합니다.");

  // 월 범위
  const from = new Date(year, month - 1, 1).toISOString();
  const to   = new Date(year, month, 1).toISOString();

  // 운행 기록 조회 (approved + submitted 포함)
  let tripQuery = supabase!
    .from("trip_logs")
    .select(`
      id, departure_time, arrival_time, status,
      departure_location, arrival_location,
      departure_km, arrival_km, distance_km,
      purpose, toll_fee, note,
      vehicles(id, plate_number, model),
      drivers(name)
    `)
    .gte("departure_time", from)
    .lt("departure_time", to)
    .not("arrival_time", "is", null)
    .in("status", allStatus ? ["draft", "submitted", "approved", "rejected"] : ["approved", "submitted"])
    .order("departure_time", { ascending: true });

  if (vehicleId) tripQuery = tripQuery.eq("vehicle_id", vehicleId);

  const { data: rawTrips, error: dbErr } = await tripQuery;
  if (dbErr) return serverErr(dbErr.message);
  if (!rawTrips?.length) return badReq("해당 기간에 출력할 운행 기록이 없습니다.");

  // 차량번호 조회 (파일명용)
  let plateName: string | undefined;
  if (vehicleId) {
    const { data: v } = await supabase!
      .from("vehicles").select("plate_number").eq("id", vehicleId).single();
    plateName = v?.plate_number;
  }

  // TripRowData 변환
  const trips: TripRowData[] = rawTrips.map((t, i) => {
    const dep = new Date(t.departure_time);
    const arr = t.arrival_time ? new Date(t.arrival_time) : null;
    const fmt = (d: Date) => d.toLocaleTimeString("ko-KR", { timeZone:"Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
    const fmtDate = (d: Date) => d.toLocaleDateString("ko-KR", { timeZone:"Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, "-").replace(".", "");
    return {
      no:                 i + 1,
      date:               fmtDate(dep),
      departure_time:     fmt(dep),
      arrival_time:       arr ? fmt(arr) : "-",
      driver_name:        (t.drivers as any)?.name ?? "-",
      vehicle_plate:      (t.vehicles as any)?.plate_number ?? "-",
      departure_location: t.departure_location,
      arrival_location:   t.arrival_location ?? "-",
      departure_km:       t.departure_km,
      arrival_km:         t.arrival_km ?? 0,
      distance_km:        t.distance_km ?? 0,
      purpose:            t.purpose,
      toll_fee:           t.toll_fee ?? 0,
      note:               t.note ?? "",
    };
  });

  // 차량별 집계 (Sheet2용)
  const summaryMap: Record<string, VehicleSummary> = {};
  rawTrips.forEach(t => {
    const v = t.vehicles as any;
    const pid = v?.id ?? "unknown";
    if (!summaryMap[pid]) {
      summaryMap[pid] = {
        plate_number:   v?.plate_number ?? "-",
        model:          v?.model ?? "-",
        trip_count:     0,
        total_distance: 0,
        total_toll:     0,
      };
    }
    summaryMap[pid].trip_count     += 1;
    summaryMap[pid].total_distance += t.distance_km ?? 0;
    summaryMap[pid].total_toll     += t.toll_fee ?? 0;
  });
  const summaries: VehicleSummary[] = Object.values(summaryMap)
    .sort((a, b) => b.total_distance - a.total_distance);

  // Excel 생성
  let excelBuffer: Buffer;
  try {
    excelBuffer = generateTripLogExcel({ year, month, companyName: COMPANY_NAME, trips, summaries });
  } catch (e: any) {
    return serverErr(`Excel 생성 실패: ${e.message}`);
  }

  const fileName   = buildExcelFileName(year, month, plateName);
  const encodedName = encodeURIComponent(fileName);

  return new NextResponse(excelBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      "Content-Length":  String(excelBuffer.length),
      "Cache-Control":   "no-store",
    },
  });
}
