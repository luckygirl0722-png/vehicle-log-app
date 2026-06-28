import { NextRequest, NextResponse } from "next/server";
import { withAuth, badReq, serverErr } from "@/lib/api/auth-guard";
import * as XLSX from "xlsx";

const COMPANY_NAME = "삼우에레코주식회사";

/**
 * GET /api/reports/excel/trips
 * 운행현황 탭의 현재 필터 조건 전체 데이터를 Excel로 다운로드
 * 쿼리 파라미터: month, vehicle_id, driver_id, status
 */
export async function GET(request: NextRequest) {
  const { supabase, error } = await withAuth(true);
  if (error) return error;

  const sp         = new URL(request.url).searchParams;
  const monthParam = sp.get("month");
  const vehicleId  = sp.get("vehicle_id");
  const driverId   = sp.get("driver_id");
  const status     = sp.get("status");

  // ── 데이터 조회 (페이지네이션 없이 전체) ──────────────────────
  let query = supabase!
    .from("trip_logs")
    .select(`
      id, status, trip_type, departure_time, arrival_time,
      departure_location, arrival_location,
      departure_km, arrival_km, distance_km,
      toll_fee, purpose, note,
      vehicles(plate_number, model),
      drivers(name, employee_no)
    `)
    .order("departure_time", { ascending: true });

  if (monthParam) {
    const [y, m] = monthParam.split("-").map(Number);
    query = query
      .gte("departure_time", new Date(y, m - 1, 1).toISOString())
      .lt("departure_time",  new Date(y, m,     1).toISOString());
  }
  if (vehicleId) query = query.eq("vehicle_id", vehicleId);
  if (driverId)  query = query.eq("driver_id", driverId);
  if (status)    query = query.eq("status", status);

  const { data: trips, error: tErr } = await query;
  if (tErr) return serverErr(tErr.message);
  if (!trips?.length) return badReq("조건에 맞는 운행 기록이 없습니다.");

  // ── 라벨 ────────────────────────────────────────────────────
  const STATUS_LABEL: Record<string, string> = {
    draft: "미제출", submitted: "승인대기", approved: "승인완료", rejected: "반려됨",
  };
  const now    = new Date();
  const period = monthParam
    ? (() => { const [y,m] = monthParam.split("-"); return `${y}년 ${m}월`; })()
    : `${now.getFullYear()}년 전체`;
  const generatedAt = now.toLocaleString("ko-KR", { timeZone:"Asia/Seoul", year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit" });

  // ── 스타일 정의 ───────────────────────────────────────────
  const S = {
    title: {
      font: { bold: true, sz: 13, color: { rgb: "1F2937" } },
      alignment: { horizontal: "left", vertical: "center" },
    },
    sub: {
      font: { sz: 10, color: { rgb: "6B7280" } },
      alignment: { horizontal: "left", vertical: "center" },
    },
    hBase: {
      font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1E3A5F" }, patternType: "solid" },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: { top:{style:"thin",color:{rgb:"FFFFFF"}}, bottom:{style:"thin",color:{rgb:"FFFFFF"}},
                left:{style:"thin",color:{rgb:"FFFFFF"}}, right:{style:"thin",color:{rgb:"FFFFFF"}} },
    },
    data: {
      font: { sz: 10 },
      alignment: { horizontal: "left", vertical: "center" },
      border: { top:{style:"thin",color:{rgb:"E5E7EB"}}, bottom:{style:"thin",color:{rgb:"E5E7EB"}},
                left:{style:"thin",color:{rgb:"E5E7EB"}}, right:{style:"thin",color:{rgb:"E5E7EB"}} },
    },
    dataC: {
      font: { sz: 10 },
      alignment: { horizontal: "center", vertical: "center" },
      border: { top:{style:"thin",color:{rgb:"E5E7EB"}}, bottom:{style:"thin",color:{rgb:"E5E7EB"}},
                left:{style:"thin",color:{rgb:"E5E7EB"}}, right:{style:"thin",color:{rgb:"E5E7EB"}} },
    },
    num: {
      font: { sz: 10 },
      alignment: { horizontal: "right", vertical: "center" },
      border: { top:{style:"thin",color:{rgb:"E5E7EB"}}, bottom:{style:"thin",color:{rgb:"E5E7EB"}},
                left:{style:"thin",color:{rgb:"E5E7EB"}}, right:{style:"thin",color:{rgb:"E5E7EB"}} },
      numFmt: "#,##0",
    },
    foot: {
      font: { bold: true, sz: 10 },
      fill: { fgColor: { rgb: "F3F4F6" }, patternType: "solid" },
      alignment: { horizontal: "right", vertical: "center" },
      border: { top:{style:"medium",color:{rgb:"9CA3AF"}}, bottom:{style:"medium",color:{rgb:"9CA3AF"}},
                left:{style:"thin",color:{rgb:"E5E7EB"}}, right:{style:"thin",color:{rgb:"E5E7EB"}} },
      numFmt: "#,##0",
    },
    footL: {
      font: { bold: true, sz: 10 },
      fill: { fgColor: { rgb: "F3F4F6" }, patternType: "solid" },
      alignment: { horizontal: "left", vertical: "center" },
      border: { top:{style:"medium",color:{rgb:"9CA3AF"}}, bottom:{style:"medium",color:{rgb:"9CA3AF"}},
                left:{style:"thin",color:{rgb:"E5E7EB"}}, right:{style:"thin",color:{rgb:"E5E7EB"}} },
    },
    biz:  { fill: { fgColor: { rgb: "EFF6FF" }, patternType: "solid" } },
    com:  { fill: { fgColor: { rgb: "ECFDF5" }, patternType: "solid" } },
    per:  { fill: { fgColor: { rgb: "FFF7ED" }, patternType: "solid" } },
  };

  const TYPE_ROW_FILL: Record<string, any> = {
    "업무":     S.biz,
    "출퇴근":   S.com,
    "개인사용": S.per,
  };

  // ── 워크시트 빌드 ─────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};
  const R  = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });
  const cs = (v: any, t: "s"|"n", s: any): XLSX.CellObject => ({ v, t, s });

  // 헤더 컬럼 정의 (총 14열)
  const COLS = [
    { h: "No",      w: 5  },
    { h: "출발일시", w: 18 },
    { h: "도착일시", w: 18 },
    { h: "차량번호", w: 14 },
    { h: "운전자",   w: 10 },
    { h: "운행유형", w: 10 },
    { h: "출발지",   w: 20 },
    { h: "도착지",   w: 20 },
    { h: "출발km",   w: 10 },
    { h: "도착km",   w: 10 },
    { h: "운행거리(km)", w: 13 },
    { h: "통행료(원)",   w: 12 },
    { h: "목적/비고",    w: 28 },
    { h: "상태",         w: 10 },
  ];
  const LAST_COL = COLS.length - 1;

  // Row 0: 제목
  ws[R(0,0)] = cs(`${period} 운행현황 — ${COMPANY_NAME}`, "s", S.title);
  // Row 1: 부제
  ws[R(1,0)] = cs(`생성일시: ${generatedAt}  /  총 ${trips.length}건`, "s", S.sub);
  // Row 2: 빈 줄

  // Row 3: 헤더
  COLS.forEach(({ h }, c) => {
    ws[R(3, c)] = cs(h, "s", S.hBase);
  });

  // Row 4~: 데이터
  const fmt = (iso: string | null) => iso
    ? new Date(iso).toLocaleString("ko-KR", { timeZone:"Asia/Seoul", year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit" })
    : "—";

  trips.forEach((trip: any, i) => {
    const row   = 4 + i;
    const type  = trip.trip_type ?? "업무";
    const rFill = TYPE_ROW_FILL[type] ?? {};
    const dStyle = { ...S.data,  ...(rFill.fill ? { fill: rFill.fill } : {}) };
    const cStyle = { ...S.dataC, ...(rFill.fill ? { fill: rFill.fill } : {}) };
    const nStyle = { ...S.num,   ...(rFill.fill ? { fill: rFill.fill } : {}) };

    const purposeNote = [trip.purpose, trip.note].filter(Boolean).join(" / ");

    ws[R(row, 0)]  = cs(i + 1,                               "n", cStyle);
    ws[R(row, 1)]  = cs(fmt(trip.departure_time),            "s", cStyle);
    ws[R(row, 2)]  = cs(fmt(trip.arrival_time),              "s", cStyle);
    ws[R(row, 3)]  = cs(trip.vehicles?.plate_number ?? "—",  "s", dStyle);
    ws[R(row, 4)]  = cs(trip.drivers?.name ?? "—",           "s", cStyle);
    ws[R(row, 5)]  = cs(type,                                "s", cStyle);
    ws[R(row, 6)]  = cs(trip.departure_location ?? "—",      "s", dStyle);
    ws[R(row, 7)]  = cs(trip.arrival_location ?? "운행중",   "s", dStyle);
    ws[R(row, 8)]  = { v: trip.departure_km ?? 0,            t: "n", s: nStyle, z: "#,##0" };
    ws[R(row, 9)]  = { v: trip.arrival_km ?? 0,              t: "n", s: nStyle, z: "#,##0" };
    ws[R(row, 10)] = { v: trip.distance_km ?? 0,             t: "n", s: nStyle, z: "#,##0" };
    ws[R(row, 11)] = { v: trip.toll_fee ?? 0,                t: "n", s: nStyle, z: "#,##0" };
    ws[R(row, 12)] = cs(purposeNote,                         "s", dStyle);
    ws[R(row, 13)] = cs(STATUS_LABEL[trip.status] ?? trip.status, "s", cStyle);
  });

  // 합계 행
  const footRow = 4 + trips.length;
  for (let c = 0; c < COLS.length; c++) {
    if (c === 0) { ws[R(footRow, c)] = cs("합계", "s", S.footL); continue; }
    if (c === 10) { ws[R(footRow, c)] = { v: trips.reduce((s:number,t:any)=>s+(t.distance_km??0),0), t:"n", s:S.foot, z:"#,##0" }; continue; }
    if (c === 11) { ws[R(footRow, c)] = { v: trips.reduce((s:number,t:any)=>s+(t.toll_fee??0),0),    t:"n", s:S.foot, z:"#,##0" }; continue; }
    ws[R(footRow, c)] = cs("", "s", S.footL);
  }

  // 범위 / 열 너비 / 행 높이
  ws["!ref"]  = XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:footRow,c:LAST_COL} });
  ws["!cols"] = COLS.map(({ w }) => ({ wch: w }));
  ws["!rows"] = [
    { hpt: 22 }, // 제목
    { hpt: 16 }, // 부제
    { hpt: 6  }, // 빈 줄
    { hpt: 22 }, // 헤더
    ...trips.map(() => ({ hpt: 20 })),
    { hpt: 22 }, // 합계
  ];
  ws["!merges"] = [
    { s:{r:0,c:0}, e:{r:0,c:LAST_COL} },
    { s:{r:1,c:0}, e:{r:1,c:LAST_COL} },
    { s:{r:2,c:0}, e:{r:2,c:LAST_COL} },
    { s:{r:footRow,c:0}, e:{r:footRow,c:9} },
    { s:{r:footRow,c:12}, e:{r:footRow,c:LAST_COL} },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "운행현황");

  const buf = XLSX.write(wb, { type:"buffer", bookType:"xlsx", cellStyles:true });
  const fileName = `운행현황_${period.replace(/\s/g,"")}.xlsx`;
  const encoded  = encodeURIComponent(fileName);

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
    },
  });
}
