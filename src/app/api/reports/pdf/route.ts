import { NextRequest, NextResponse } from "next/server";
import { withAuth, badReq, serverErr } from "@/lib/api/auth-guard";
import {
  generateTripLogPdf,
  buildPdfFileName,
  type PdfTripRow,
} from "@/lib/pdf-generator";

const COMPANY_NAME = "삼우에레코주식회사";

/**
 * GET /api/reports/pdf
 * 쿼리 파라미터:
 *   - year:       number (필수)
 *   - month:      number (필수, 1~12)
 *   - vehicle_id: string (선택)
 *
 * 응답: application/pdf
 */
export async function GET(request: NextRequest) {
  const { supabase, error } = await withAuth(true); // admin 전용
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const yearStr   = searchParams.get("year");
  const monthStr  = searchParams.get("month");
  const vehicleId = searchParams.get("vehicle_id");

  if (!yearStr || !monthStr) return badReq("year와 month는 필수 파라미터입니다.");

  const year  = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year)  || year < 2020 || year > 2100) return badReq("year가 올바르지 않습니다.");
  if (isNaN(month) || month < 1   || month > 12)  return badReq("month는 1~12 사이여야 합니다.");

  const from = new Date(year, month - 1, 1).toISOString();
  const to   = new Date(year, month, 1).toISOString();

  let query = supabase!
    .from("trip_logs")
    .select(`
      departure_time, arrival_time,
      departure_location, arrival_location,
      distance_km, purpose, toll_fee,
      vehicles(id, plate_number),
      drivers(name)
    `)
    .gte("departure_time", from)
    .lt("departure_time", to)
    .not("arrival_time", "is", null)
    .in("status", ["approved", "submitted"])
    .order("departure_time", { ascending: true });

  if (vehicleId) query = query.eq("vehicle_id", vehicleId);

  const { data: rawTrips, error: dbErr } = await query;
  if (dbErr) return serverErr(dbErr.message);
  if (!rawTrips?.length) return badReq("해당 기간에 출력할 운행 기록이 없습니다.");

  // 차량번호 조회
  let plateName: string | undefined;
  if (vehicleId) {
    const { data: v } = await supabase!
      .from("vehicles").select("plate_number").eq("id", vehicleId).single();
    plateName = v?.plate_number;
  }

  // PdfTripRow 변환
  const fmt     = (d: Date) => d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const fmtDate = (d: Date) => {
    const y = d.getFullYear(), m = d.getMonth()+1, day = d.getDate();
    return `${y}.${String(m).padStart(2,"0")}.${String(day).padStart(2,"0")}`;
  };

  const trips: PdfTripRow[] = rawTrips.map((t, i) => {
    const dep = new Date(t.departure_time);
    const arr = t.arrival_time ? new Date(t.arrival_time) : null;
    return {
      no:                 i + 1,
      date:               fmtDate(dep),
      departure_time:     fmt(dep),
      arrival_time:       arr ? fmt(arr) : "—",
      driver_name:        (t.drivers as any)?.name ?? "—",
      vehicle_plate:      (t.vehicles as any)?.plate_number ?? "—",
      departure_location: t.departure_location,
      arrival_location:   t.arrival_location ?? "—",
      distance_km:        t.distance_km ?? 0,
      purpose:            t.purpose,
      toll_fee:           t.toll_fee ?? 0,
    };
  });

  const totalDistance = trips.reduce((s, t) => s + t.distance_km, 0);
  const totalToll     = trips.reduce((s, t) => s + t.toll_fee, 0);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateTripLogPdf({
      companyName:   COMPANY_NAME,
      year,
      month,
      vehiclePlate:  plateName ?? null,
      trips,
      totalDistance,
      totalToll,
    });
  } catch (e: any) {
    return serverErr(`PDF 생성 실패: ${e.message}`);
  }

  const fileName    = buildPdfFileName(year, month, plateName);
  const encodedName = encodeURIComponent(fileName);

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
      "Content-Length":      String(pdfBuffer.length),
      "Cache-Control":       "no-store",
    },
  });
}
