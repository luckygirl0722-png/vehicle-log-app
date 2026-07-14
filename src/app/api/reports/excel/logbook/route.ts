import { NextRequest, NextResponse } from "next/server";
import { withAuth, badReq, serverErr } from "@/lib/api/auth-guard";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

/**
 * GET /api/reports/excel/logbook?vehicle_id=...&month=YYYY-MM
 *
 * 국세청 업무용 승용차 운행기록부 양식 (신 양식, 도착지 포함)에
 * DB 운행 기록을 채워 Excel 파일로 반환합니다.
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

/** JS UTC 날짜 → Excel 날짜 시리얼 (1900-01-01 = 1 기준) */
function toExcelSerial(y: number, mo: number, d: number): number {
  return Math.floor(Date.UTC(y, mo - 1, d) / 86400000) + 25569;
}

/**
 * 셀에 값을 쓰되 템플릿의 스타일(테두리·배경색·폰트 등, s 속성)을 보존한다.
 * 기존 셀 객체를 spread하고 값·타입·포맷만 덮어씀.
 * 수식(f)은 직접 값으로 대체하므로 제거.
 */
function sc(
  ws: XLSX.WorkSheet,
  addr: string,
  v: XLSX.CellObject["v"],
  t: XLSX.ExcelDataType,
  z?: string
): void {
  const prev = (ws[addr] as XLSX.CellObject | undefined) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { f: _f, ...style } = prev as XLSX.CellObject & { f?: string };
  const cell: XLSX.CellObject = { ...style, v, t };
  if (z !== undefined) cell.z = z;
  ws[addr] = cell;
}

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
    // KST 기준 일(day) 추출 — "en-CA" locale은 "YYYY-MM-DD, HH:MM:SS" 형식
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
      // 시간순 정렬이므로 마지막으로 업데이트된 값이 해당 날의 최종 상태
      const agg  = dayMap.get(day)!;
      agg.arrKm  = trip.arrival_km!;
      agg.arrLoc = trip.arrival_location || agg.arrLoc;
    }

    const agg  = dayMap.get(day)!;
    const dist = trip.distance_km ?? 0;
    if      (trip.trip_type === "출퇴근")    agg.commuteKm  += dist;
    else if (trip.trip_type === "개인사용")   agg.personalKm += dist;
    else                                     agg.bizKm      += dist;
    agg.tollFee += trip.toll_fee ?? 0;

    const name = (trip.drivers as unknown as { name?: string })?.name;
    if (name) agg.drivers.add(name);
  }

  // ── 템플릿 파일 읽기 ─────────────────────────────────────
  let wb: XLSX.WorkBook;
  try {
    const buf = fs.readFileSync(
      path.join(process.cwd(), "public", "차량운행기록부_양식.xlsx")
    );
    wb = XLSX.read(buf, { type: "buffer", cellStyles: true });
  } catch {
    return serverErr("운행기록부 템플릿 파일을 읽을 수 없습니다.");
  }

  const ws = wb.Sheets[wb.SheetNames[0]];

  // ── 헤더 셀 입력 ─────────────────────────────────────────
  const lastDay = new Date(y, mo, 0).getDate(); // 해당 월의 마지막 날
  sc(ws, "E3", toExcelSerial(y, mo, 1),       "n", "yyyy-mm-dd");
  sc(ws, "G3", toExcelSerial(y, mo, lastDay), "n", "yyyy-mm-dd");
  sc(ws, "D7", vehicle.model || "—",           "s");
  sc(ws, "F7", vehicle.plate_number,            "s");

  // ── D열 날짜 직접 입력 ────────────────────────────────────
  // 원본 D13=`=E3`, D14=`=D13+1`... 수식의 캐시값(=구 날짜)이 Protected View에서
  // 재계산되지 않는 문제를 방지하기 위해 수식을 직접 값으로 대체.
  //
  // 해당 월보다 긴 행(예: 6월인데 d=31)은 원본 수식 =D42+1 이 다음 달 날짜를
  // 표시하지 않도록 명시적으로 빈 문자열로 덮어쓴다 (delete 대신).
  // sc()를 사용하므로 템플릿의 테두리/배경색은 자동 보존됨.
  const dateFmt = (ws["D13"]?.z as string | undefined) ?? "mm-dd-aaa";
  for (let d = 1; d <= 31; d++) {
    const r = 12 + d;
    if (d <= lastDay) {
      sc(ws, `D${r}`, toExcelSerial(y, mo, d), "n", dateFmt);
    } else {
      // 공식 =D42+1 이 다음 달 날짜(예: 07-01)를 표시하지 않도록 명시적 초기화
      sc(ws, `D${r}`, "", "s");
      // 거리 공식 =L-J 도 0이 아닌 빈 셀로 초기화
      sc(ws, `N${r}`, "", "s");
    }
  }

  // ── 데이터 행 입력 (row 13 = 1일, row 43 = 31일) ─────────
  // sc()로 기존 셀의 스타일(테두리·배경색)을 보존하면서 값만 덮어씀
  for (const [day, agg] of dayMap) {
    if (day < 1 || day > 31) continue;
    const r = 12 + day; // Excel row number

    if (agg.drivers.size) sc(ws, `G${r}`, [...agg.drivers].join(", "), "s");
    if (agg.arrLoc)       sc(ws, `I${r}`, agg.arrLoc, "s");

    sc(ws, `J${r}`, agg.depKm,             "n", "#,##0");
    sc(ws, `L${r}`, agg.arrKm,             "n", "#,##0");
    sc(ws, `N${r}`, agg.arrKm - agg.depKm, "n", "#,##0"); // 공식 대체 (직접 값 입력)

    if (agg.commuteKm  > 0) sc(ws, `P${r}`, agg.commuteKm,  "n", "#,##0");
    if (agg.bizKm      > 0) sc(ws, `R${r}`, agg.bizKm,      "n", "#,##0");
    if (agg.personalKm > 0) sc(ws, `T${r}`, agg.personalKm, "n", "#,##0");
    if (agg.tollFee    > 0) sc(ws, `V${r}`, agg.tollFee,    "n", "#,##0");
  }

  // ── 합계 행 직접 계산 (공식 대체) ────────────────────────
  let totDist = 0, totBiz = 0, totPer = 0;
  for (const agg of dayMap.values()) {
    totDist += agg.arrKm - agg.depKm;
    totBiz  += agg.bizKm + agg.commuteKm;
    totPer  += agg.personalKm;
  }
  sc(ws, "J45", totDist, "n", "#,##0");
  sc(ws, "P45", totBiz,  "n", "#,##0");
  sc(ws, "T45", totPer,  "n", "#,##0");
  sc(ws, "V45",
    totDist > 0 ? Math.round((totBiz / totDist) * 1000) / 10 : 0,
    "n", "0.0"
  );

  // ── 출력 ──────────────────────────────────────────────────
  const outBuf  = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true });
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
