"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * 국세청 업무용 승용차 운행기록부 양식 자동 감지 파서
 *
 * [구 양식] I11 = "⑤ 주행 전 계기판의 거리(km)"
 *   D(3)=날짜  I(8)=출발km  K(10)=도착km
 *   O(14)=출퇴근  Q(16)=업무  S(18)=개인  U(20)=하이패스  V(21)=기타
 *
 * [신 양식] I11 = "도착지" (도착지 컬럼 추가 버전)
 *   D(3)=날짜  I(8)=도착지  J(9)=출발km  L(11)=도착km
 *   P(15)=출퇴근  R(17)=업무  T(19)=개인  V(21)=하이패스  W(22)=기타
 *
 * 데이터 행: index 12~42 (엑셀 행 13~43)
 */

interface ParsedRow {
  rowNum:    number;
  date:      string;
  arr_loc:   string;
  dep_km:    number;
  arr_km:    number;
  distance:  number;
  trip_type: string;
  toll_fee:  number;
  error?:    string;
}
interface Props { vehicleId: string; vehiclePlate: string; }

function toDateStr(val: unknown): string {
  if (typeof val === "number" && val > 0) {
    const d = new Date((val - 25569) * 86400 * 1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
  }
  if (val instanceof Date) {
    return `${val.getFullYear()}-${String(val.getMonth()+1).padStart(2,"0")}-${String(val.getDate()).padStart(2,"0")}`;
  }
  const s = String(val ?? "").trim();
  const m = s.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
  return s;
}
function toNum(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

const TYPE_COLOR: Record<string, string> = {
  "업무":     "bg-blue-100 text-blue-700",
  "출퇴근":   "bg-emerald-100 text-emerald-700",
  "개인사용": "bg-orange-100 text-orange-700",
};

export default function ExcelUploadSection({ vehicleId }: Props) {
  const router   = useRouter();
  const fileRef  = useRef<HTMLInputElement>(null);
  const [step, setStep]           = useState<"idle"|"preview"|"done">("idle");
  const [rows, setRows]           = useState<ParsedRow[]>([]);
  const [fileName, setFileName]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<string|null>(null);
  const [apiError, setApiError]   = useState<string|null>(null);
  const [debugInfo, setDebugInfo] = useState("");
  const [formatLabel, setFormatLabel] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setApiError(null);
    setDebugInfo("");
    setFormatLabel("");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const XLSX = await import("xlsx");
        const wb  = XLSX.read(ev.target?.result, { type: "array", cellDates: false, cellNF: false });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, {
          header: 1, raw: true, defval: null, blankrows: true,
        }) as unknown[][];

        // ── 양식 자동 감지 ──
        // I11(row10, idx8) 헤더로 구분: "도착지" → 신 양식, "주행 전" → 구 양식
        const headerRow10 = aoa[10] as unknown[];
        const i11Header   = String(headerRow10?.[8] ?? "").trim();
        const isNewFormat = i11Header === "도착지" || i11Header.includes("도착");
        setFormatLabel(isNewFormat ? "신 양식 (도착지 포함)" : "구 양식 (국세청 원본)");

        const parsed: ParsedRow[] = [];
        for (let i = 12; i <= 42; i++) {
          const row = aoa[i];
          if (!row) continue;

          const dateVal = row[3]; // D열 (공통)
          let arrLoc: string;
          let depKm:  number;
          let arrKm:  number;
          let comKm:  number;
          let bizKm:  number;
          let perKm:  number;
          let tollHp: number;
          let tollEtc:number;

          if (isNewFormat) {
            // 신 양식: I=도착지 J=출발km L=도착km P=출퇴근 R=업무 T=개인 V=하이패스 W=기타
            arrLoc  = String(row[8]  ?? "").trim();
            depKm   = toNum(row[9]);   // J
            arrKm   = toNum(row[11]);  // L
            comKm   = toNum(row[15]); // P
            bizKm   = toNum(row[17]); // R
            perKm   = toNum(row[19]); // T
            tollHp  = toNum(row[21]); // V
            tollEtc = toNum(row[22]); // W
          } else {
            // 구 양식: I=출발km K=도착km O=출퇴근 Q=업무 S=개인 U=하이패스 V=기타
            arrLoc  = "";
            depKm   = toNum(row[8]);   // I
            arrKm   = toNum(row[10]);  // K
            comKm   = toNum(row[14]); // O
            bizKm   = toNum(row[16]); // Q
            perKm   = toNum(row[18]); // S
            tollHp  = toNum(row[20]); // U
            tollEtc = toNum(row[21]); // V
          }

          if (!depKm && !arrKm) continue;
          if (!dateVal)         continue;

          let trip_type = "업무";
          if (comKm > 0)       trip_type = "출퇴근";
          else if (perKm > 0)  trip_type = "개인사용";
          else if (bizKm > 0)  trip_type = "업무";

          const dateStr  = toDateStr(dateVal);
          const errors: string[] = [];
          if (!dateStr || dateStr.length < 8) errors.push("날짜 오류");
          if (arrKm <= depKm)                 errors.push("도착km ≤ 출발km");

          parsed.push({
            rowNum:   i - 11,
            date:     dateStr,
            arr_loc:  arrLoc,
            dep_km:   depKm,
            arr_km:   arrKm,
            distance: arrKm - depKm,
            trip_type,
            toll_fee: tollHp + tollEtc,
            error:    errors.length ? errors.join(", ") : undefined,
          });
        }

        if (parsed.length === 0) {
          const s = aoa[12] as unknown[];
          const fmt = isNewFormat ? "신양식" : "구양식";
          const kmIdx = isNewFormat ? `J(9)=${s?.[9]}` : `I(8)=${s?.[8]}`;
          setDebugInfo(`${fmt} / 총행수:${aoa.length} / 13행: D=${s?.[3]} ${kmIdx}`);
        }
        setRows(parsed);
        setStep("preview");
      } catch (err: unknown) {
        setApiError(`파싱 오류: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const validRows   = rows.filter(r => !r.error);
  const invalidRows = rows.filter(r =>  r.error);
  const hasArrLoc   = validRows.some(r => r.arr_loc);

  async function handleUpload() {
    if (!validRows.length) return;
    setLoading(true);
    setApiError(null);
    const payload = validRows.map(r => ({
      departure_time:   r.date,
      arrival_time:     r.date,
      ...(r.arr_loc ? { arrival_location: r.arr_loc } : {}),
      departure_km:     r.dep_km,
      arrival_km:       r.arr_km,
      toll_fee:         r.toll_fee,
      trip_type:        r.trip_type,
    }));
    const res  = await fetch("/api/trips/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicle_id: vehicleId, rows: payload }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setApiError(data.details?.join("\n") ?? data.error ?? "업로드 실패");
      return;
    }
    setResult(`${data.inserted}건 등록 완료 (승인 대기)`);
    setStep("done");
    setTimeout(() => router.refresh(), 1500);
  }

  function handleReset() {
    setStep("idle"); setRows([]); setFileName("");
    setResult(null); setApiError(null); setDebugInfo(""); setFormatLabel("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="hidden md:block mx-4 mb-4">
      <div className="rounded-2xl border border-border bg-background overflow-hidden">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div>
            <p className="text-sm font-semibold">📊 Excel 일괄 업로드</p>
            <p className="text-xs text-muted-foreground mt-0.5">국세청 업무용 승용차 운행기록부 양식 지원 · PC 전용</p>
          </div>
          <a
            href="/차량운행기록부_양식.xlsx"
            download
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted transition-colors shrink-0"
          >
            📥 양식 다운로드
          </a>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* ── idle ── */}
          {step === "idle" && (
            <div>
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                <p className="text-sm font-medium">📂 운행기록부 Excel 파일 선택</p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx · 국세청 업무용 승용차 운행기록부 (구/신 양식 모두 지원)</p>
                <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
              </label>
              {apiError && <p className="mt-2 text-xs text-destructive">{apiError}</p>}
            </div>
          )}

          {/* ── preview ── */}
          {step === "preview" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">📄 {fileName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatLabel && <span className="text-primary/70 font-medium">[{formatLabel}]</span>}
                    {" "}파싱 결과 · <span className="text-emerald-600 font-medium">정상 {validRows.length}건</span>
                    {invalidRows.length > 0 && (
                      <span className="text-amber-600 font-medium"> · 제외 {invalidRows.length}건</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5"
                >
                  다시 선택
                </button>
              </div>

              {/* 0건 경고 */}
              {rows.length === 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1.5">
                  <p className="text-sm font-semibold text-amber-700">⚠️ 파싱된 데이터가 없습니다</p>
                  <p className="text-xs text-amber-700">• 양식에 출발km·도착km을 아직 입력하지 않은 경우</p>
                  <p className="text-xs text-amber-700">• 수식 결과값 없이 저장된 경우 → 엑셀에서 다른 이름으로 저장 후 재시도</p>
                  <p className="text-xs text-amber-700">• 지원 양식: 국세청 업무용 승용차 운행기록부 (구/신 모두 가능)</p>
                  {debugInfo && (
                    <p className="text-xs font-mono bg-amber-100 text-amber-600 px-2 py-1 rounded mt-1">
                      진단: {debugInfo}
                    </p>
                  )}
                </div>
              )}

              {/* 정상 데이터 안내 */}
              {rows.length > 0 && (
                <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-xs text-blue-700 space-y-0.5">
                  <p className="font-semibold">ℹ️ 업로드 안내</p>
                  <p>출발지·시간은 <span className="font-semibold">"미입력"</span>으로 저장됩니다. 필요 시 앱에서 수정하세요.</p>
                  {hasArrLoc && <p>도착지는 양식에 입력된 값이 함께 저장됩니다.</p>}
                </div>
              )}

              {/* 오류 행 */}
              {invalidRows.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-700">⚠️ 제외된 행 (운행 없는 날 포함)</p>
                  {invalidRows.slice(0, 5).map(r => (
                    <p key={r.rowNum} className="text-xs text-amber-700">{r.date} — {r.error}</p>
                  ))}
                  {invalidRows.length > 5 && (
                    <p className="text-xs text-amber-600">외 {invalidRows.length - 5}건</p>
                  )}
                </div>
              )}

              {/* 미리보기 테이블 */}
              {validRows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted">
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">날짜</th>
                        {hasArrLoc && <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">도착지</th>}
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">출발km</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">도착km</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">운행km</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">유형</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">통행료</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {validRows.map(r => (
                        <tr key={r.rowNum} className="hover:bg-muted/30">
                          <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                          {hasArrLoc && (
                            <td className="px-3 py-2 max-w-28 truncate text-muted-foreground">
                              {r.arr_loc || <span className="opacity-40">미입력</span>}
                            </td>
                          )}
                          <td className="px-3 py-2 whitespace-nowrap text-right">{r.dep_km.toLocaleString("ko-KR")}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right">{r.arr_km.toLocaleString("ko-KR")}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-primary">{r.distance.toLocaleString("ko-KR")}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 font-medium ${TYPE_COLOR[r.trip_type] ?? "bg-gray-100"}`}>
                              {r.trip_type}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-right">
                            {r.toll_fee > 0 ? r.toll_fee.toLocaleString("ko-KR") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {apiError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <p className="text-sm text-destructive whitespace-pre-line">{apiError}</p>
                </div>
              )}

              {validRows.length > 0 && (
                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    className="flex-1 rounded-xl border border-border py-3 text-sm font-medium bg-background"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    {loading ? "업로드 중..." : `✅ ${validRows.length}건 등록하기`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── done ── */}
          {step === "done" && (
            <div className="text-center py-6 space-y-3">
              <p className="text-3xl">✅</p>
              <p className="text-sm font-semibold text-emerald-700">{result}</p>
              <p className="text-xs text-muted-foreground">잠시 후 목록이 갱신됩니다</p>
              <button
                onClick={handleReset}
                className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-4 py-2"
              >
                다시 업로드
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
