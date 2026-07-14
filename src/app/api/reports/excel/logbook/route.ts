import { NextRequest, NextResponse } from "next/server";
import { withAuth, badReq, serverErr } from "@/lib/api/auth-guard";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

/**
 * GET /api/reports/excel/logbook?vehicle_id=...&month=YYYY-MM
 *
 * 국세청 업무용 승용차 운행기록부 양식에 DB 운행 기록을 채워 반환합니다.
 * SheetJS 만 사용 (외부 패키지 의존 없음)
 */

const svc = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** JS UTC 날짜 → Excel 날짜 시리얼 */
function toExcelSerial(y: number, mo: number, d: number): number {
  return Math.floor(Date.UTC(y, mo - 1, d) / 86400000) + 25569;
}

/**
 * 기존 셀의 스타일 인덱스(s)를 보존하면서 값만 덮어씀.
 * NaN / null / undefined 숫자 값은 0으로 안전하게 처리.
 */
function sc(
  ws: XLSX.WorkSheet,
  addr: string,
  v: XLSX.CellObject["v"],
  t: XLSX.ExcelDataType,
  z?: string
): void {
  // 숫자 타입에서 null/undefined/NaN 방지
  let safeV = v;
  if (t === "n") {
    const n = Number(v);
    safeV = isNaN(n) ? 0 : n;
  }
  const prev = (ws[addr] as XLSX.CellObject | undefined) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { f: _f, ...style } = prev as XLSX.CellObject & { f?: string };
  const cell: XLSX.CellObject = { ...style, v: safeV, t };
  if (z !== undefined) cell.z = z;
  ws[addr] = cell;
}

export async function GET(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const vehicleId  = sp.get("vehicle_id");
  const monthParam = sp.get("month");

  // 진단: 파라미터 로그
  console.log("[logbook] vehicle_id:", vehicleId, "month:", monthParam);

  try {
    const { error } = await withAuth(true);
    if (error) return error;

    if (!vehicleId)  return badReq("vehicle_id 파라미터가 필요합니다.");
    if (!monthParam) return badReq("month 파라미터가 필요합니다. (예: 2026-07)");

    const [y, mo] = monthParam.split("-").map(Number);
    if (!y || !mo || mo < 1 || mo > 12) return badReq(`month 형식 오류: "${monthParam}" (YYYY-MM 형식 필요)`);

    const { data: vehicle, error: vErr } = await svc
      .from("vehicles")
      .select("plate_number, model")
      .eq("id", vehicleId)
      .single();
    if (vErr || !vehicle) return badReq(`차량을 찾을 수 없습니다. (vehicle_id: ${vehicleId})`);

    console.log("[logbook] 차량:", vehicle.plate_number, y, "년", mo, "월");

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
      .not("arrival_km",    "is", null)
      .not("departure_km",  "is", null)
      .order("departure_time", { ascending: true });
    if (tErr) return serverErr(`DB 조회 오류: ${tErr.message}`);

    console.log("[logbook] 조회된 운행 건수:", trips?.length ?? 0);

    interface DayAgg {
      depKm: number; arrKm: number; commuteKm: number;
      bizKm: number; personalKm: number; tollFee: number;
      drivers: Set<string>; arrLoc: string;
    }
    const dayMap = new Map<number, DayAgg>();

    for (const trip of trips ?? []) {
      const kstDate = new Date(trip.departure_time).toLocaleString("en-CA", {
        timeZone: "Asia/Seoul",
      });
      // en-CA 형식: "2026-07-14, 9:00 AM" → split(",")[0] = "2026-07-14"
      const datePart = kstDate.split(",")[0].trim();
      const day = parseInt(datePart.split("-")[2], 10);
      if (isNaN(day) || day < 1 || day > 31) continue;

      const depKm = Number(trip.departure_km) || 0;
      const arrKm = Number(trip.arrival_km)   || 0;

      if (!dayMap.has(day)) {
        dayMap.set(day, {
          depKm, arrKm,
          commuteKm: 0, bizKm: 0, personalKm: 0, tollFee: 0,
          drivers: new Set<string>(), arrLoc: trip.arrival_location || "",
        });
      } else {
        const agg  = dayMap.get(day)!;
        agg.arrKm  = arrKm;
        agg.arrLoc = trip.arrival_location || agg.arrLoc;
      }

      const agg  = dayMap.get(day)!;
      const dist = Number(trip.distance_km) || 0;
      if      (trip.trip_type === "출퇴근")   agg.commuteKm  += dist;
      else if (trip.trip_type === "개인사용")  agg.personalKm += dist;
      else                                    agg.bizKm      += dist;
      agg.tollFee += Number(trip.toll_fee) || 0;
      const name = (trip.drivers as unknown as { name?: string })?.name;
      if (name) agg.drivers.add(name);
    }

    // ── 템플릿 읽기 ───────────────────────────────────────────
    const templatePath = path.join(process.cwd(), "public", "차량운행기록부_양식.xlsx");
    let templateBuf: Buffer;
    try {
      templateBuf = fs.readFileSync(templatePath);
    } catch (e) {
      return serverErr(`템플릿 파일 읽기 실패: ${e instanceof Error ? e.message : e}`);
    }

    const wb      = XLSX.read(templateBuf, { type: "buffer", cellStyles: true });
    const ws      = wb.Sheets[wb.SheetNames[0]];
    const lastDay = new Date(y, mo, 0).getDate();
    const dateFmt = (ws["D13"]?.z as string | undefined) ?? "mm-dd-aaa";

    sc(ws, "E3", toExcelSerial(y, mo, 1),       "n", "yyyy-mm-dd");
    sc(ws, "G3", toExcelSerial(y, mo, lastDay), "n", "yyyy-mm-dd");
    sc(ws, "D7", vehicle.model || "—",           "s");
    sc(ws, "F7", vehicle.plate_number,            "s");

    for (let d = 1; d <= 31; d++) {
      const r = 12 + d;
      if (d <= lastDay) {
        sc(ws, `D${r}`, toExcelSerial(y, mo, d), "n", dateFmt);
      } else {
        ws[`D${r}`] = { v: "", t: "s" };
        ws[`N${r}`] = { v: "", t: "s" };
      }
    }

    for (const [day, agg] of dayMap) {
      if (day < 1 || day > 31) continue;
      const r = 12 + day;
      if (agg.drivers.size) sc(ws, `G${r}`, [...agg.drivers].join(", "), "s");
      if (agg.arrLoc)       sc(ws, `I${r}`, agg.arrLoc,                  "s");
      sc(ws, `J${r}`, agg.depKm,             "n", "#,##0");
      sc(ws, `L${r}`, agg.arrKm,             "n", "#,##0");
      sc(ws, `N${r}`, agg.arrKm - agg.depKm, "n", "#,##0");
      if (agg.commuteKm  > 0) sc(ws, `P${r}`, agg.commuteKm,  "n", "#,##0");
      if (agg.bizKm      > 0) sc(ws, `R${r}`, agg.bizKm,      "n", "#,##0");
      if (agg.personalKm > 0) sc(ws, `T${r}`, agg.personalKm, "n", "#,##0");
      if (agg.tollFee    > 0) sc(ws, `V${r}`, agg.tollFee,    "n", "#,##0");
    }

    let totDist = 0, totBiz = 0, totPer = 0;
    for (const agg of dayMap.values()) {
      totDist += agg.arrKm - agg.depKm;
      totBiz  += agg.bizKm + agg.commuteKm;
      totPer  += agg.personalKm;
    }
    sc(ws, "J45", totDist, "n", "#,##0");
    sc(ws, "P45", totBiz,  "n", "#,##0");
    sc(ws, "T45", totPer,  "n", "#,##0");
    sc(ws, "V45", totDist > 0 ? Math.round((totBiz / totDist) * 1000) / 10 : 0, "n", "0.0");

    // ── SheetJS 출력 ──────────────────────────────────────────
    const finalBuf = XLSX.write(wb, {
      type: "buffer", bookType: "xlsx", cellStyles: true,
    }) as Buffer;

    console.log("[logbook] Excel 생성 완료. 버퍼 크기:", finalBuf?.length);

    const period  = `${y}년${mo}월`;
    const fname   = `차량운행기록부_${vehicle.plate_number}_${period}.xlsx`;
    const encoded = encodeURIComponent(fname);

    return new NextResponse(finalBuf, {
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
      },
    });

  } catch (err) {
    // 예상치 못한 예외 → JSON으로 반환 (프론트에서 실제 오류 메시지 표시)
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[logbook API] 서버 오류 (vehicle:", vehicleId, "month:", monthParam, "):", msg);
    return NextResponse.json({ error: `서버 오류[${monthParam}]: ${msg}` }, { status: 500 });
  }
}
