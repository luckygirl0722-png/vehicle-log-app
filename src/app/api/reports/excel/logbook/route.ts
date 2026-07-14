import { NextRequest, NextResponse } from "next/server";
import { withAuth, badReq, serverErr } from "@/lib/api/auth-guard";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import path from "path";

/**
 * GET /api/reports/excel/logbook?vehicle_id=...&month=YYYY-MM
 *
 * 국세청 업무용 승용차 운행기록부 양식 (신 양식, 도착지 포함)에
 * DB 운행 기록을 채워 Excel 파일로 반환합니다.
 *
 * ExcelJS를 사용하여 템플릿의 테두리·배경색·폰트 등 모든 서식을
 * 그대로 보존하면서 값만 덮어씁니다.
 *
 * 집계 방식 (일별):
 *   - 출발km  : 해당 날 첫 번째 운행의 departure_km
 *   - 도착km  : 해당 날 마지막 운행의 arrival_km
 *   - 업무/출퇴근/개인 km : 각 trip_type의 distance_km 합산
 *   - 통행료  : toll_fee 합산 (하이패스 V열에 전부 기재)
 */

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

  // ── 운행 기록 (해당 월 KST 기준, 완료된 기록, 출발 시간 오름차순) ──
  // Vercel 서버는 UTC → KST(+09:00) 월 경계를 UTC로 역산
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
    // KST 기준 일(day) 추출
    const kstDate = new Date(trip.departure_time).toLocaleString("en-CA", {
      timeZone: "Asia/Seoul",
    });
    const day = parseInt(kstDate.split(",")[0].split("-")[2], 10); // 1~31

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

  // ── 템플릿 파일 읽기 (ExcelJS — 스타일 완전 보존) ────────
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(
      path.join(process.cwd(), "public", "차량운행기록부_양식.xlsx")
    );
  } catch {
    return serverErr("운행기록부 템플릿 파일을 읽을 수 없습니다.");
  }

  const ws      = workbook.worksheets[0];
  const lastDay = new Date(y, mo, 0).getDate();

  // ── 헤더 셀 입력 ─────────────────────────────────────────
  // ExcelJS: cell.value에 값을 할당하면 기존 스타일(테두리·배경·폰트)은 자동 보존됨
  ws.getCell("E3").value = new Date(Date.UTC(y, mo - 1, 1));
  ws.getCell("G3").value = new Date(Date.UTC(y, mo - 1, lastDay));
  ws.getCell("D7").value = vehicle.model || "—";
  ws.getCell("F7").value = vehicle.plate_number;

  // ── D열 날짜 직접 입력 ────────────────────────────────────
  // 원본 수식(=E3, =D13+1 등)의 캐시값 문제를 방지하기 위해 직접 값으로 대체.
  // 해당 월보다 행이 많은 경우(예: 2월 → 29~31일 행) null로 초기화.
  for (let d = 1; d <= 31; d++) {
    const row  = 12 + d;
    const cell = ws.getCell(`D${row}`);
    if (d <= lastDay) {
      // Date 객체를 넣으면 ExcelJS가 Excel 날짜 시리얼로 변환; 기존 numFmt 유지
      cell.value = new Date(Date.UTC(y, mo - 1, d));
    } else {
      cell.value = null;
      ws.getCell(`N${row}`).value = null; // 거리 공식 셀도 초기화
    }
  }

  // ── 데이터 행 입력 (row 13 = 1일, row 43 = 31일) ─────────
  for (const [day, agg] of dayMap) {
    if (day < 1 || day > 31) continue;
    const row = 12 + day;

    if (agg.drivers.size) ws.getCell(`G${row}`).value = [...agg.drivers].join(", ");
    if (agg.arrLoc)       ws.getCell(`I${row}`).value = agg.arrLoc;

    ws.getCell(`J${row}`).value = agg.depKm;
    ws.getCell(`L${row}`).value = agg.arrKm;
    ws.getCell(`N${row}`).value = agg.arrKm - agg.depKm;

    if (agg.commuteKm  > 0) ws.getCell(`P${row}`).value = agg.commuteKm;
    if (agg.bizKm      > 0) ws.getCell(`R${row}`).value = agg.bizKm;
    if (agg.personalKm > 0) ws.getCell(`T${row}`).value = agg.personalKm;
    if (agg.tollFee    > 0) ws.getCell(`V${row}`).value = agg.tollFee;
  }

  // ── 합계 행 직접 계산 (공식 대체) ────────────────────────
  let totDist = 0, totBiz = 0, totPer = 0;
  for (const agg of dayMap.values()) {
    totDist += agg.arrKm - agg.depKm;
    totBiz  += agg.bizKm + agg.commuteKm;
    totPer  += agg.personalKm;
  }
  ws.getCell("J45").value = totDist;
  ws.getCell("P45").value = totBiz;
  ws.getCell("T45").value = totPer;
  ws.getCell("V45").value =
    totDist > 0 ? Math.round((totBiz / totDist) * 1000) / 10 : 0;

  // ── 출력 ──────────────────────────────────────────────────
  const outBuf  = await workbook.xlsx.writeBuffer() as Buffer;
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
