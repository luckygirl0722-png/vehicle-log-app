import { NextRequest, NextResponse } from "next/server";
import { withAuth, badReq, serverErr } from "@/lib/api/auth-guard";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import path from "path";

/**
 * GET /api/reports/excel/logbook?vehicle_id=...&month=YYYY-MM
 *
 * 국세청 업무용 승용차 운행기록부 양식 (신 양식, 도착지 포함)에
 * DB 운행 기록을 채워 Excel 파일로 반환합니다.
 *
 * xlsx-populate 사용: 순수 JS 라이브러리로 템플릿의 테두리·배경색·폰트를
 * 그대로 보존하면서 값만 덮어씁니다.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XlsxPopulate = require("xlsx-populate");

const svc = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const { error } = await withAuth(true);
  if (error) return error;

  const sp         = new URL(request.url).searchParams;
  const vehicleId  = sp.get("vehicle_id");
  const monthParam = sp.get("month"); // "YYYY-MM"

  if (!vehicleId)  return badReq("vehicle_id 파라미터가 필요합니다.");
  if (!monthParam) return badReq("month 파라미터가 필요합니다. (예: 2026-07)");

  const [y, mo] = monthParam.split("-").map(Number);
  if (!y || !mo || mo < 1 || mo > 12) return badReq("month 형식 오류 (YYYY-MM)");

  // ── 차량 정보 ─────────────────────────────────────────────
  const { data: vehicle, error: vErr } = await svc
    .from("vehicles")
    .select("plate_number, model")
    .eq("id", vehicleId)
    .single();
  if (vErr || !vehicle) return badReq("차량을 찾을 수 없습니다.");

  // ── 운행 기록 조회 ────────────────────────────────────────
  const KST_MS     = 9 * 60 * 60 * 1000;
  const monthStart = new Date(Date.UTC(y, mo - 1, 1) - KST_MS).toISOString();
  const monthEnd   = new Date(Date.UTC(y, mo,     1) - KST_MS).toISOString();

  const { data: trips, error: tErr } = await svc
    .from("trip_logs")
    .select(`
      departure_time, departure_km, arrival_km, distance_km,
      arrival_location, trip_type, toll_fee,
      drivers(name)
    `)
    .eq("vehicle_id", vehicleId)
    .gte("departure_time", monthStart)
    .lt("departure_time",  monthEnd)
    .not("arrival_km", "is", null)
    .order("departure_time", { ascending: true });
  if (tErr) return serverErr(tErr.message);

  // ── 일별 집계 ─────────────────────────────────────────────
  interface DayAgg {
    depKm:      number;
    arrKm:      number;
    commuteKm:  number;
    bizKm:      number;
    personalKm: number;
    tollFee:    number;
    drivers:    Set<string>;
    arrLoc:     string;
  }
  const dayMap = new Map<number, DayAgg>();

  for (const trip of trips ?? []) {
    const kstDate = new Date(trip.departure_time).toLocaleString("en-CA", {
      timeZone: "Asia/Seoul",
    });
    const day = parseInt(kstDate.split(",")[0].split("-")[2], 10);

    if (!dayMap.has(day)) {
      dayMap.set(day, {
        depKm:      trip.departure_km,
        arrKm:      trip.arrival_km!,
        commuteKm:  0,
        bizKm:      0,
        personalKm: 0,
        tollFee:    0,
        drivers:    new Set<string>(),
        arrLoc:     trip.arrival_location || "",
      });
    } else {
      const agg  = dayMap.get(day)!;
      agg.arrKm  = trip.arrival_km!;
      agg.arrLoc = trip.arrival_location || agg.arrLoc;
    }

    const agg  = dayMap.get(day)!;
    const dist = trip.distance_km ?? 0;
    if      (trip.trip_type === "출퇴근")   agg.commuteKm  += dist;
    else if (trip.trip_type === "개인사용")  agg.personalKm += dist;
    else                                    agg.bizKm      += dist;
    agg.tollFee += trip.toll_fee ?? 0;

    const name = (trip.drivers as unknown as { name?: string })?.name;
    if (name) agg.drivers.add(name);
  }

  // ── 템플릿 로드 (xlsx-populate — 스타일 완전 보존) ────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wb: any;
  try {
    wb = await XlsxPopulate.fromFileAsync(
      path.join(process.cwd(), "public", "차량운행기록부_양식.xlsx")
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return serverErr(`템플릿 로드 실패: ${msg}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheet   = wb.sheet(0) as any;
  const lastDay = new Date(y, mo, 0).getDate();

  // ── 헤더 셀 입력 ─────────────────────────────────────────
  // xlsx-populate: cell.value(x) 호출 시 기존 스타일(테두리·배경색·폰트)은 자동 보존
  sheet.cell("E3").value(new Date(Date.UTC(y, mo - 1, 1)));
  sheet.cell("G3").value(new Date(Date.UTC(y, mo - 1, lastDay)));
  sheet.cell("D7").value(vehicle.model || "—");
  sheet.cell("F7").value(vehicle.plate_number);

  // ── D열 날짜 직접 입력 ────────────────────────────────────
  // 수식(=E3, =D13+1 등)을 직접 값으로 대체 → Protected View 캐시 문제 방지
  for (let d = 1; d <= 31; d++) {
    const row = 12 + d;
    if (d <= lastDay) {
      sheet.cell(`D${row}`).value(new Date(Date.UTC(y, mo - 1, d)));
    } else {
      sheet.cell(`D${row}`).value(null); // 해당 월보다 긴 행 초기화
      sheet.cell(`N${row}`).value(null); // 거리 공식 셀도 초기화
    }
  }

  // ── 데이터 행 입력 ────────────────────────────────────────
  for (const [day, agg] of dayMap) {
    if (day < 1 || day > 31) continue;
    const row = 12 + day;

    if (agg.drivers.size) sheet.cell(`G${row}`).value([...agg.drivers].join(", "));
    if (agg.arrLoc)       sheet.cell(`I${row}`).value(agg.arrLoc);

    sheet.cell(`J${row}`).value(agg.depKm);
    sheet.cell(`L${row}`).value(agg.arrKm);
    sheet.cell(`N${row}`).value(agg.arrKm - agg.depKm);

    if (agg.commuteKm  > 0) sheet.cell(`P${row}`).value(agg.commuteKm);
    if (agg.bizKm      > 0) sheet.cell(`R${row}`).value(agg.bizKm);
    if (agg.personalKm > 0) sheet.cell(`T${row}`).value(agg.personalKm);
    if (agg.tollFee    > 0) sheet.cell(`V${row}`).value(agg.tollFee);
  }

  // ── 합계 행 ──────────────────────────────────────────────
  let totDist = 0, totBiz = 0, totPer = 0;
  for (const agg of dayMap.values()) {
    totDist += agg.arrKm - agg.depKm;
    totBiz  += agg.bizKm + agg.commuteKm;
    totPer  += agg.personalKm;
  }
  sheet.cell("J45").value(totDist);
  sheet.cell("P45").value(totBiz);
  sheet.cell("T45").value(totPer);
  sheet.cell("V45").value(
    totDist > 0 ? Math.round((totBiz / totDist) * 1000) / 10 : 0
  );

  // ── 출력 ──────────────────────────────────────────────────
  const outBuf  = await wb.outputAsync() as Buffer;
  const period  = `${y}년${mo}월`;
  const fname   = `차량운행기록부_${vehicle.plate_number}_${period}.xlsx`;
  const encoded = encodeURIComponent(fname);

  return new NextResponse(outBuf, {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
    },
  });
}
