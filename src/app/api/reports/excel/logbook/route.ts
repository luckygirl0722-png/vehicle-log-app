import { NextRequest, NextResponse } from "next/server";
import { withAuth, badReq, serverErr } from "@/lib/api/auth-guard";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import fs from "fs";
import path from "path";

/**
 * GET /api/reports/excel/logbook?vehicle_id=...&month=YYYY-MM
 *
 * 국세청 업무용 승용차 운행기록부 양식에 DB 운행 기록을 채워 반환합니다.
 *
 * 서식 보존 방식:
 *   1. SheetJS로 템플릿 읽기 + 데이터 채우기 (sc() 헬퍼로 s 인덱스 보존)
 *   2. SheetJS로 xlsx 출력
 *   3. JSZip으로 템플릿의 xl/styles.xml 을 출력 파일에 주입
 *      → 셀의 s 인덱스가 원본 스타일 테이블을 그대로 참조하므로 테두리·배경색 복원
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
 * 셀에 값을 쓰되 기존 셀의 스타일 인덱스(s)를 보존한다.
 * 빈 셀(ws[addr] === undefined)도 템플릿에서 s 속성을 가져와 보존한다.
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

  // ── 운행 기록 (해당 월 KST 기준) ──────────────────────────
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

  // ── 템플릿 읽기 ───────────────────────────────────────────
  const templatePath = path.join(process.cwd(), "public", "차량운행기록부_양식.xlsx");
  let templateBuf: Buffer;
  try {
    templateBuf = fs.readFileSync(templatePath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return serverErr(`템플릿 파일 읽기 실패: ${msg}`);
  }

  const wb = XLSX.read(templateBuf, { type: "buffer", cellStyles: true });
  const ws = wb.Sheets[wb.SheetNames[0]];

  const lastDay = new Date(y, mo, 0).getDate();
  const dateFmt = (ws["D13"]?.z as string | undefined) ?? "mm-dd-aaa";

  // ── 헤더 셀 입력 ─────────────────────────────────────────
  sc(ws, "E3", toExcelSerial(y, mo, 1),       "n", "yyyy-mm-dd");
  sc(ws, "G3", toExcelSerial(y, mo, lastDay), "n", "yyyy-mm-dd");
  sc(ws, "D7", vehicle.model || "—",           "s");
  sc(ws, "F7", vehicle.plate_number,            "s");

  // ── D열 날짜 직접 입력 ────────────────────────────────────
  for (let d = 1; d <= 31; d++) {
    const r = 12 + d;
    if (d <= lastDay) {
      sc(ws, `D${r}`, toExcelSerial(y, mo, d), "n", dateFmt);
    } else {
      sc(ws, `D${r}`, "", "s");
      sc(ws, `N${r}`, "", "s");
    }
  }

  // ── 데이터 행 입력 ────────────────────────────────────────
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

  // ── 합계 행 ──────────────────────────────────────────────
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

  // ── SheetJS 출력 ──────────────────────────────────────────
  const outputBuf = XLSX.write(wb, {
    type: "buffer", bookType: "xlsx", cellStyles: true,
  }) as Buffer;

  // ── JSZip으로 스타일 파일 주입 ────────────────────────────
  // SheetJS가 데이터와 s 인덱스를 올바르게 쓰지만 styles.xml이 손실될 수 있으므로
  // 원본 템플릿의 xl/styles.xml 과 xl/theme/theme1.xml 을 그대로 복사한다.
  let finalBuf: Buffer;
  try {
    const [templateZip, outputZip] = await Promise.all([
      JSZip.loadAsync(templateBuf),
      JSZip.loadAsync(outputBuf),
    ]);

    for (const xmlPath of ["xl/styles.xml", "xl/theme/theme1.xml"]) {
      const file = templateZip.file(xmlPath);
      if (file) {
        outputZip.file(xmlPath, await file.async("uint8array"));
      }
    }

    finalBuf = await outputZip.generateAsync({
      type:               "nodebuffer",
      compression:        "DEFLATE",
      compressionOptions: { level: 6 },
    }) as Buffer;
  } catch (e) {
    // JSZip 실패 시 스타일 없는 버전이라도 반환
    console.error("JSZip style injection failed:", e);
    finalBuf = outputBuf;
  }

  // ── 응답 ──────────────────────────────────────────────────
  const period  = `${y}년${mo}월`;
  const fname   = `차량운행기록부_${vehicle.plate_number}_${period}.xlsx`;
  const encoded = encodeURIComponent(fname);

  return new NextResponse(finalBuf, {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
    },
  });
}
