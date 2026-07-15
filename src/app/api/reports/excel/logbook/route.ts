import { NextRequest, NextResponse } from "next/server";
import { withAuth, badReq, serverErr } from "@/lib/api/auth-guard";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import fs from "fs";
import path from "path";

/**
 * GET /api/reports/excel/logbook?vehicle_id=...&month=YYYY-MM
 *
 * 국세청 업무용 승용차 운행기록부 양식에 DB 운행 기록을 채워 반환합니다.
 *
 * ★ 서식 보존 방식 (v2 — 순수 JSZip XML 조작):
 *   SheetJS를 사용하지 않고 JSZip으로 sheet1.xml을 직접 수정합니다.
 *   → styles.xml, theme1.xml, sharedStrings.xml 등 서식 파일이 원본 그대로 유지
 *   → s 인덱스 재번호매김 없음 → 테두리·배경색·요일 하이라이트 100% 보존
 */

const svc = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Excel 날짜 시리얼 계산 ─────────────────────────────────────────────────
function toSerial(y: number, mo: number, d: number): number {
  // Excel: 1900-01-01 = 1 (25569 offset from Unix epoch)
  return Math.floor(Date.UTC(y, mo - 1, d) / 86400000) + 25569;
}

// ── XML 특수문자 이스케이프 ────────────────────────────────────────────────
function xe(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── 속성에서 t="..." 제거 ─────────────────────────────────────────────────
function rmT(attrs: string): string {
  return attrs.replace(/ t="[^"]*"/, "");
}

/**
 * sheet1.xml 에서 특정 셀에 숫자 값 설정 (s 인덱스 보존)
 *
 * - content 있는 셀: 수식(f) + 기존값 제거, t 속성 제거, <v>val</v> 교체
 * - 자기닫힘 셀: <v>val</v> 삽입
 * - (?<!/) negative lookbehind: /> (자기닫힘) 과 > (내용 있는 셀) 을 구별
 */
function setNum(xml: string, ref: string, val: number): string {
  const r = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // content 셀: > 앞에 / 없음
  const reC = new RegExp(`<c r="${r}"([^>]*)(?<![/])>[\\s\\S]*?</c>`);
  const mC  = reC.exec(xml);
  if (mC) {
    return xml.replace(mC[0], `<c r="${ref}"${rmT(mC[1])}><v>${val}</v></c>`);
  }
  // 자기닫힘
  return xml.replace(
    new RegExp(`<c r="${r}"([^/]*)/>`, "g"),
    (_, a) => `<c r="${ref}"${a}><v>${val}</v></c>`
  );
}

/**
 * sheet1.xml 에서 특정 셀에 인라인 문자열 설정 (s 인덱스 보존)
 * t="inlineStr", <is><t>val</t></is>
 */
function setStr(xml: string, ref: string, val: string): string {
  const r = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const v = xe(val);
  const make = (a: string) =>
    `<c r="${ref}"${rmT(a)} t="inlineStr"><is><t>${v}</t></is></c>`;
  const reC = new RegExp(`<c r="${r}"([^>]*)(?<![/])>[\\s\\S]*?</c>`);
  const mC  = reC.exec(xml);
  if (mC) {
    return xml.replace(mC[0], make(mC[1]));
  }
  return xml.replace(
    new RegExp(`<c r="${r}"([^/]*)/>`, "g"),
    (_, a) => make(a)
  );
}

/**
 * sheet1.xml 에서 특정 셀을 빈 자기닫힘으로 교체 (s 보존, v/f 제거)
 * 해당 월보다 날짜가 큰 행(예: 2월의 29~31행)을 비울 때 사용
 */
function clearCell(xml: string, ref: string): string {
  const r = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reC = new RegExp(`<c r="${r}"([^>]*)(?<![/])>[\\s\\S]*?</c>`);
  const mC  = reC.exec(xml);
  if (mC) {
    return xml.replace(mC[0], `<c r="${ref}"${rmT(mC[1])}/>`);
  }
  return xml; // 이미 자기닫힘이면 그대로
}

// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sp         = new URL(request.url).searchParams;
  const vehicleId  = sp.get("vehicle_id");
  const monthParam = sp.get("month");

  // ── 진단용 ping ───────────────────────────────────────────────────────────
  if (sp.get("ping") === "1") {
    return NextResponse.json({
      ok:      true,
      v:       "2026-07-15-g",
      env_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      env_svc: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
  }

  try {
    const { error } = await withAuth(true);
    if (error) return error;

    if (!vehicleId)  return badReq("vehicle_id 파라미터가 필요합니다.");
    if (!monthParam) return badReq("month 파라미터가 필요합니다. (예: 2026-07)");

    const [y, mo] = monthParam.split("-").map(Number);
    if (!y || !mo || mo < 1 || mo > 12)
      return badReq(`month 형식 오류: "${monthParam}"`);

    // ── 차량 정보 ─────────────────────────────────────────────────────────
    const { data: vehicle, error: vErr } = await svc
      .from("vehicles")
      .select("plate_number, model")
      .eq("id", vehicleId)
      .single();
    if (vErr || !vehicle)
      return badReq(`차량을 찾을 수 없습니다. (vehicle_id: ${vehicleId})`);

    // ── 운행 기록 조회 (해당 월 KST 기준) ────────────────────────────────
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
      .not("arrival_km",   "is", null)
      .not("departure_km", "is", null)
      .order("departure_time", { ascending: true });
    if (tErr) return serverErr(`DB 조회 오류: ${tErr.message}`);

    // ── 일별 집계 ─────────────────────────────────────────────────────────
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
      const kstStr  = new Date(trip.departure_time).toLocaleString("en-CA", {
        timeZone: "Asia/Seoul",
      });
      const day = parseInt(kstStr.split(",")[0].trim().split("-")[2], 10);
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
        const a   = dayMap.get(day)!;
        a.arrKm   = arrKm;
        a.arrLoc  = trip.arrival_location || a.arrLoc;
      }

      const a  = dayMap.get(day)!;
      const km = Number(trip.distance_km) || 0;
      if      (trip.trip_type === "출퇴근")   a.commuteKm  += km;
      else if (trip.trip_type === "개인사용")  a.personalKm += km;
      else                                    a.bizKm      += km;
      a.tollFee += Number(trip.toll_fee) || 0;

      const dObj = trip.drivers as unknown as { name?: string } | { name?: string }[] | null;
      const name = Array.isArray(dObj) ? dObj[0]?.name : dObj?.name;
      if (name) a.drivers.add(name);
    }

    // ── 템플릿 JSZip 로드 ─────────────────────────────────────────────────
    const tplPath = path.join(process.cwd(), "public", "차량운행기록부_양식.xlsx");
    let tplBuf: Buffer;
    try {
      tplBuf = fs.readFileSync(tplPath);
    } catch (e) {
      return serverErr(`템플릿 파일 읽기 실패: ${e instanceof Error ? e.message : e}`);
    }

    const zip    = await JSZip.loadAsync(tplBuf);
    const sheetF = zip.file("xl/worksheets/sheet1.xml");
    if (!sheetF) return serverErr("템플릿 sheet1.xml을 찾을 수 없습니다.");
    let xml       = await sheetF.async("string");
    const lastDay = new Date(y, mo, 0).getDate();

    // ── 헤더: 기간·차량 정보 ──────────────────────────────────────────────
    // E3(s=80, numFmtId=14)·G3(s=56, numFmtId=14): Excel 날짜 형식 → date serial 그대로
    xml = setNum(xml, "E3", toSerial(y, mo, 1));
    xml = setNum(xml, "G3", toSerial(y, mo, lastDay));
    // 차종: C7:D7 병합 셀 → 최상단 왼쪽(C7)에 값 입력 (s=42, numFmtId=0)
    // 차량번호: E7:H7 병합 셀 → 최상단 왼쪽(E7)에 값 입력 (s=42, numFmtId=0)
    xml = setStr(xml, "C7", vehicle.model || "—");
    xml = setStr(xml, "E7", vehicle.plate_number);

    // ── 날짜 행 D13~D43 ───────────────────────────────────────────────────
    // D13(s=12, numFmtId=176="mm/dd/aaa")·D14-D43(s=14, numFmtId=176)
    for (let d = 1; d <= 31; d++) {
      const row = 12 + d;
      if (d <= lastDay) {
        xml = setNum(xml, `D${row}`, toSerial(y, mo, d));
      } else {
        // 해당 월보다 큰 날짜 행: 날짜·거리 셀 비우기
        xml = clearCell(xml, `D${row}`);
        xml = clearCell(xml, `N${row}`);
      }
    }

    // ── 데이터 행 입력 ────────────────────────────────────────────────────
    for (const [day, a] of dayMap) {
      if (day < 1 || day > 31) continue;
      const row = 12 + day;
      // G: 운전자명(s=55,numFmtId=0)  I: 도착지(s=93,numFmtId=0)
      if (a.drivers.size) xml = setStr(xml, `G${row}`, [...a.drivers].join(", "));
      if (a.arrLoc)       xml = setStr(xml, `I${row}`, a.arrLoc);
      // J: 출발km(s=71,numFmtId=41=#,##0)  L: 도착km(s=72)
      xml = setNum(xml, `J${row}`, a.depKm);
      xml = setNum(xml, `L${row}`, a.arrKm);
      // N: 운행거리(s=67,numFmtId=0)
      xml = setNum(xml, `N${row}`, a.arrKm - a.depKm);
      // P: 출퇴근km(s=54)  R: 업무km(s=55)  T: 개인사용km(s=55)  V: 통행료(s=13,numFmtId=41)
      if (a.commuteKm  > 0) xml = setNum(xml, `P${row}`, a.commuteKm);
      if (a.bizKm      > 0) xml = setNum(xml, `R${row}`, a.bizKm);
      if (a.personalKm > 0) xml = setNum(xml, `T${row}`, a.personalKm);
      if (a.tollFee    > 0) xml = setNum(xml, `V${row}`, a.tollFee);
    }

    // ── 합계 행 45 ────────────────────────────────────────────────────────
    let totDist = 0, totBiz = 0, totPer = 0;
    for (const a of dayMap.values()) {
      totDist += a.arrKm - a.depKm;
      totBiz  += a.bizKm + a.commuteKm;
      totPer  += a.personalKm;
    }
    // J45(s=38,numFmtId=41)  P45(s=38)  T45(s=52)
    xml = setNum(xml, "J45", totDist);
    xml = setNum(xml, "P45", totBiz);
    xml = setNum(xml, "T45", totPer);
    // V45(s=36,numFmtId=9="0%"): 원시 비율 저장 → Excel이 % 표시
    xml = setNum(xml, "V45", totDist > 0 ? totBiz / totDist : 0);

    // ── sheet1.xml 저장 + calcChain 제거 ─────────────────────────────────
    zip.file("xl/worksheets/sheet1.xml", xml);

    // calcChain.xml 제거: 수식을 값으로 교체했으므로 기존 chain은 무효
    zip.remove("xl/calcChain.xml");

    // [Content_Types].xml 에서 calcChain 참조 제거 (Excel의 파일 무결성 경고 방지)
    const ctFile = zip.file("[Content_Types].xml");
    if (ctFile) {
      let ct = await ctFile.async("string");
      ct = ct.replace(/<Override[^>]*calcChain[^>]*\/>/g, "");
      zip.file("[Content_Types].xml", ct);
    }

    // ── ZIP 생성 및 반환 ──────────────────────────────────────────────────
    const finalBuf = await zip.generateAsync({
      type:               "nodebuffer",
      compression:        "DEFLATE",
      compressionOptions: { level: 6 },
    }) as Buffer;

    const fname   = `차량운행기록부_${vehicle.plate_number}_${y}년${mo}월.xlsx`;
    const encoded = encodeURIComponent(fname);

    return new NextResponse(finalBuf, {
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
      },
    });

  } catch (err) {
    let safeMsg = "unknown error";
    try {
      safeMsg = err instanceof Error
        ? `${err.name}: ${err.message}`
        : String(err).slice(0, 200);
    } catch { safeMsg = "msg_extraction_failed"; }

    console.error("[logbook] CATCH:", safeMsg);

    try {
      return NextResponse.json(
        { error: `서버 오류[${monthParam ?? "?"}]: ${safeMsg}` },
        { status: 200 }
      );
    } catch {
      return new Response(`CATCH_FAIL: ${safeMsg}`, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  }
}
