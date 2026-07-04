"use client";

/**
 * 국세청 업무용 승용차 운행기록부 양식 파서
 *
 * 컬럼 인덱스 (0-based, sheet_to_json header:1 기준):
 *   idx 3  (D) : 날짜
 *   idx 8  (I) : ⑤ 출발km (주행 전 계기판)
 *   idx 10 (K) : ⑥ 도착km (주행 후 계기판)
 *   idx 14 (O) : ⑧ 출퇴근용 km
 *   idx 16 (Q) : ⑨ 일반업무용 km
 *   idx 18 (S) : 개인사용 km
 *   idx 20 (U) : 하이패스 통행료
 *   idx 21 (V) : 기타 통행료
 *   idx 22 (W) : 비고
 *
 * 데이터 행: index 12~42 (1-based row 13~43, 31일분)
 * 운행유형 파생: O>0→출퇴근 / Q>0→업무 / S>0→개인사용 / 기본→업무
 */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

interface ParsedRow {
  rowNum:    number;
  date:      string;   // YYYY-MM-DD
  dep_km:    number;
  arr_km:    number;
  distance:  number;
  trip_type: string;
  toll_fee:  number;
  note:      string;
  error?:    string;
}

interface Props {
  vehicleId:    string;
  vehiclePlate: string;
}

/** 엑셀 날짜 직렬번호 또는 Date → "YYYY-MM-DD" */
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

export default function ExcelUploadSection({ vehicleId, vehiclePlate }: Props) {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep]           = useState<"idle"|"preview"|"done">("idle");
  const [rows, setRows]           = useState<ParsedRow[]>([]);
  const [fileName, setFileName]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<string|null>(null);
  const [apiError, setApiError]   = useState<string|null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setApiError(null);
    setDebugInfo("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array", cellDates: false, cellNF: false });
        const ws = wb.Sheets[wb.SheetNames[0]];

        // sheet_to_json 방식 (formula 캐시 없는 파일도 대응)
        const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, {
          header:  1,
          raw:     true,
          defval:  null,
          blankrows: true,
        }) as unknown[][];

        const parsed: ParsedRow[] = [];
        let skipped = 0;

        // 데이터 행: index 12~42 (row 13~43)
        for (let i = 12; i <= 42; i++) {
          const row = aoa[i];
          if (!row) { skipped++; continue; }

          const dateVal = row[3];   // D
          const depKm   = toNum(row[8]);   // I
          const arrKm   = toNum(row[10]);  // K
          const comKm   = toNum(row[14]);  // O
          const bizKm   = toNum(row[16]);  // Q
          const perKm   = toNum(row[18]);  // S
          const tollHp  = toNum(row[20]);  // U
          const tollEtc = toNum(row[21]);  // V
          const noteVal = String(row[22] ?? "").trim();

          // km 모두 0이면 운행 없는 날 — 건너뜀
          if (!depKm && !arrKm) { skipped++; continue; }
          if (!dateVal) { skipped++; continue; }

          // 운행유형 파생
          let trip_type = "업무";
          if (comKm > 0)      trip_type = "출퇴근";
          else if (perKm > 0) trip_type = "개인사용";
          else if (bizKm > 0) trip_type = "업무";

          const dateStr = toDateStr(dateVal);
          const errors: string[] = [];
          if (!dateStr || dateStr.length < 8) errors.push("날짜 오류");
          if (arrKm <= depKm)                  errors.push("도착km ≤ 출발km");

          parsed.push({
            rowNum:   i - 11,
            date:     dateStr,
            dep_km:   depKm,
            arr_km:   arrKm,
            distance: arrKm - depKm,
            trip_type,
            toll_fee: tollHp + tollEtc,
            note:     noteVal,
            error:    errors.length ? errors.join(", ") : undefined,
          });
        }

        // 디버그 정보 (0건인 경우 원인 파악용)
        if (parsed.length === 0) {
          const sample = aoa[12];
          setDebugInfo(
            `행 수: ${aoa.length} / 샘플(13행): D=${sample?.[3]} I=${sample?.[8]} K=${sample?.[10]}`
          );
        }

        setRows(parsed);
        setStep("preview");
      } catch (err: unknown) {
        setApiError(`파일 파싱 오류: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const validRows   = rows.filter(r => !r.error);
  const invalidRows = rows.filter(r => r.error);

  async function handleUpload() {
    if (!validRows.length) return;
    setLoading(true);
    setApiError(null);

    const payload = validRows.map(r => ({
      departure_time: r.date,
      arrival_time:   r.date,
      departure_km:   r.dep_km,
      arrival_km:     r.arr_km,
      toll_fee:       r.toll_fee,
      trip_type:      r.trip_type,
      note:           r.note || undefined,
    }));

    const res = await fetch("/api/trips/bulk", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ vehicle_id: vehicleId, rows: payload }),
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
    setResult(null); setApiError(null); setDebugInfo("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const TYPE_COLOR: Record<string, string> = {
    "업무":     "bg-blue-100 text-blue-700",
    "출퇴근":   "bg-emerald-100 text-emerald-700",
    "개인사용": "bg-orange-100 text-orange-700",
  };

  return (
    <div className="hidden md:block mx-4 mb-4">
      <div className="rounded-2xl border border-border bg-background overflow-hidden">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div>
            <p className="text-sm font-semibold">📊 Excel 일괄 업로드</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              국세청 업무용 승용차 운행기록부 양식 지원 · PC에서만 사용 가능
            </p>
          </div>
          <a href="/차량운행기록부_양식.xlsx" download
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted transition-colors shrink-0">
            📥 양식 다운로드
          </a>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* ── idle ── */}
          {step === "idle" && (
            <div>
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                <p className="text-sm font-medium">📂 운행기록부 Excel 파일 선택</p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx · 국세청 업무용 승용차 운행기록부</p>
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
                    파싱 결과 ·{" "}
                    <span className="text-emerald-600 font-medium">정상 {validRows.length}건</span>
                    {invalidRows.length > 0 &&
                      <span className="text-amber-600 font-medium"> · 오류(제외) {invalidRows.length}건</span>}
                  </p>
                </div>
                <button onClick={handleReset}
                  className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5">
                  다시 선택
                </button>
              </div>

              {/* 데이터 없음 */}
              {rows.length === 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
                  <p className="text-sm font-semibold text-amber-700">⚠️ 파싱된 데이터가 없습니다</p>
                  <p className="text-xs text-amber-700">가능한 원인:</p>
                  <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                    <li>국세청 양식에 운행 데이터(출발km·도착km)를 아직 입력하지 않았습니다</li>
                    <li>파일이 국세청 업무용 승용차 운행기록부 서식이 아닙니다</li>
                    <li>저장 시 수식 결과값이 포함되지 않았습니다 (다른 이름으로 저장 후 재시도)</li>
                  </ul>
                  {debugInfo && (
                    <p className="text-xs text-amber-600 mt-1 font-mono bg-amber-100 px-2 py-1 rounded">
                      진단: {debugInfo}
                    </p>
                  )}
                </div>
              )}

              {/* 안내 (데이터 있을 때만) */}
              {rows.length > 0 && (
                <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-xs text-blue-700 space-y-0.5">
                  <p className="font-semibold">ℹ️ 국세청 양식 업로드 안내</p>
                  <p>출발지·도착지·시간은 양식에 없으므로 <span className="font-semibold">"미입력"</span>으로 저장됩니다.</p>
                  <p>운행유형은 ⑧출퇴근·⑨업무·개인사용 열의 값으로 자동 판별합니다.</p>
                </div>
              )}

              {/* 오류 행 */}
              {invalidRows.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-700">⚠️ 제외된 행 (운행 없는 날 또는 오류)</p>
                  {invalidRows.slice(0,5).map(r => (
                    <p key={r.rowNum} className="text-xs text-amber-700">
                      {r.date} — {r.error}
                    </p>
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
                        {["날짜","출발km","도착km","운행km","유형","통행료","비고"].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {validRows.map(r => (
                        <tr key={r.rowNum} className="hover:bg-muted/30">
                          <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
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
                          <td className="px-3 py-2 max-w-32 truncate text-muted-foreground">{r.note || "—"}</td>
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
                  <button onClick={handleReset}
                    className="flex-1 rounded-xl border border-border py-3 text-sm font-medium bg-background">
                    취소
                  </button>
                  <button onClick={handleUpload} disabled={loading}
                    className="flex-1 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold disabled:opacity-50">
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
              <button onClick={handleReset}
                className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-4 py-2">
                다시 업로드
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
