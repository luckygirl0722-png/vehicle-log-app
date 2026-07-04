"use client";

/**
 * 국세청 업무용 승용차 운행기록부 양식 파서
 *
 * 컬럼 매핑 (1-based):
 *   C(3)  : 번호
 *   D(4)  : 날짜
 *   E(5)  : 부서
 *   G(7)  : 성명
 *   I(9)  : ⑤ 출발km (주행 전 계기판)
 *   K(11) : ⑥ 도착km (주행 후 계기판)
 *   M(13) : ⑦ 주행거리 (수식, 무시)
 *   O(15) : ⑧ 출퇴근용 km
 *   Q(17) : ⑨ 일반업무용 km
 *   S(19) : 개인사용 km
 *   U(21) : 하이패스 통행료
 *   V(22) : 기타 통행료
 *   W(23) : ⑩ 비고
 *
 * 운행유형 파생: O>0→출퇴근 / Q>0→업무 / S>0→개인사용 / 기본→업무
 * 출발시간/도착시간: 없으므로 API에서 09:00/18:00 기본값 사용
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

const VALID_TYPES = ["업무", "출퇴근", "개인사용"];

/** 엑셀 날짜 직렬번호 또는 Date → "YYYY-MM-DD" */
function toDateStr(val: unknown): string {
  if (typeof val === "number" && val > 0) {
    const d = new Date((val - 25569) * 86400 * 1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
  }
  if (val instanceof Date) {
    return `${val.getUTCFullYear()}-${String(val.getUTCMonth()+1).padStart(2,"0")}-${String(val.getUTCDate()).padStart(2,"0")}`;
  }
  const s = String(val ?? "").trim();
  const m = s.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
  return s;
}

function toNum(val: unknown): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export default function ExcelUploadSection({ vehicleId, vehiclePlate }: Props) {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep]         = useState<"idle"|"preview"|"done">("idle");
  const [rows, setRows]         = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<string|null>(null);
  const [apiError, setApiError] = useState<string|null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setApiError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed: ParsedRow[] = [];

        // 국세청 양식: 데이터 행 13~43 (0-based row 12~42)
        for (let r = 12; r <= 42; r++) {
          const get = (c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v;

          // 1-based col → 0-based: D=3, E=4, G=6, I=8, K=10, O=14, Q=16, S=18, U=20, V=21, W=22
          const dateVal  = get(3);   // D: 날짜
          const depKm    = toNum(get(8));   // I: 출발km
          const arrKm    = toNum(get(10));  // K: 도착km
          const comKm    = toNum(get(14));  // O: 출퇴근용
          const bizKm    = toNum(get(16));  // Q: 업무용
          const perKm    = toNum(get(18));  // S: 개인사용
          const tollHp   = toNum(get(20));  // U: 하이패스
          const tollEtc  = toNum(get(21));  // V: 기타
          const noteVal  = String(get(22) ?? "").trim(); // W: 비고

          // 빈 행 건너뜀 (출발km·도착km 모두 0이면)
          if (!depKm && !arrKm) continue;
          if (!dateVal) continue;

          // 운행유형 파생
          let trip_type = "업무";
          if (comKm > 0) trip_type = "출퇴근";
          else if (perKm > 0) trip_type = "개인사용";
          else if (bizKm > 0) trip_type = "업무";

          const dateStr = toDateStr(dateVal);
          const errors: string[] = [];
          if (!dateStr || dateStr.length < 8) errors.push("날짜 오류");
          if (arrKm <= depKm) errors.push("도착km ≤ 출발km");

          parsed.push({
            rowNum:    r - 11,   // 1-based
            date:      dateStr,
            dep_km:    depKm,
            arr_km:    arrKm,
            distance:  arrKm - depKm,
            trip_type,
            toll_fee:  tollHp + tollEtc,
            note:      noteVal,
            error:     errors.length ? errors.join(", ") : undefined,
          });
        }

        setRows(parsed);
        setStep("preview");
      } catch {
        setApiError("파일을 읽을 수 없습니다. 국세청 운행기록부 양식(.xlsx)인지 확인하세요.");
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

    // departure_location/arrival_location 없음 → API에서 "미입력" 처리
    const payload = validRows.map(r => ({
      departure_time: r.date,   // API에서 "YYYY-MM-DD" → 09:00 보정
      arrival_time:   r.date,   // API에서 "YYYY-MM-DD" → 18:00 보정
      departure_km:   r.dep_km,
      arrival_km:     r.arr_km,
      toll_fee:       r.toll_fee,
      trip_type:      r.trip_type,
      note:           r.note || undefined,
    }));

    const res = await fetch("/api/trips/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicle_id: vehicleId, rows: payload }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      const detail = data.details?.join("\n") ?? data.error ?? "업로드 실패";
      setApiError(detail);
      return;
    }

    setResult(`${data.inserted}건 등록 완료 (승인 대기 상태)`);
    setStep("done");
    setTimeout(() => { router.refresh(); }, 1500);
  }

  function handleReset() {
    setStep("idle"); setRows([]); setFileName("");
    setResult(null); setApiError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const TYPE_COLOR: Record<string,string> = {
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
                <p className="text-xs text-muted-foreground mt-1">.xlsx 파일 · 국세청 양식</p>
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
                    파싱 결과 · <span className="text-emerald-600 font-medium">정상 {validRows.length}건</span>
                    {invalidRows.length > 0 && <span className="text-destructive font-medium"> · 오류 {invalidRows.length}건 제외</span>}
                  </p>
                </div>
                <button onClick={handleReset}
                  className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5">
                  다시 선택
                </button>
              </div>

              {/* 안내 */}
              <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-xs text-blue-700 space-y-0.5">
                <p className="font-semibold">ℹ️ 국세청 양식 업로드 안내</p>
                <p>출발지·도착지·시간은 양식에 없으므로 <span className="font-semibold">"미입력"</span>으로 저장됩니다. 필요 시 앱에서 수정하세요.</p>
                <p>운행유형은 출퇴근용(⑧)·업무용(⑨)·개인사용 열의 값으로 자동 판별합니다.</p>
              </div>

              {invalidRows.length > 0 && (
                <div className="rounded-xl bg-destructive/5 border border-destructive/20 px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-destructive">⚠️ 오류 행 (제외됨)</p>
                  {invalidRows.map(r => (
                    <p key={r.rowNum} className="text-xs text-destructive">
                      {r.date} — {r.error}
                    </p>
                  ))}
                </div>
              )}

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
