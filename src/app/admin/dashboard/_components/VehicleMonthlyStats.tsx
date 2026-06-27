import DashboardExcelButton from "./DashboardExcelButton";

interface VehicleRow {
  plate_number: string;
  model:        string;
  bizKm:        number;
  bizToll:      number;
  comKm:        number;
  comToll:      number;
  perKm:        number;
  perToll:      number;
  totalKm:      number;
}
interface Props { rows: VehicleRow[]; monthLabel: string; year: number; month: number; }

export default function VehicleMonthlyStats({ rows, monthLabel, year, month }: Props) {
  if (!rows.length) {
    return <div className="text-center text-sm text-muted-foreground py-8">이번 달 운행 기록이 없습니다</div>;
  }
  const fmt = (n: number) => n.toLocaleString("ko-KR");
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <DashboardExcelButton year={year} month={month} label={monthLabel} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">차량</th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">업무 km</th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">업무 통행료</th>
              <th className="px-3 py-2.5 text-right font-medium text-emerald-600">출퇴근 km</th>
              <th className="px-3 py-2.5 text-right font-medium text-emerald-600">통행료(출퇴근)</th>
              <th className="px-3 py-2.5 text-right font-medium text-orange-600">개인 km</th>
              <th className="px-3 py-2.5 text-right font-medium text-orange-600">통행료(개인)</th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">합계 km</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.plate_number} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-3 py-3">
                  <p className="font-medium">{r.plate_number}</p>
                  <p className="text-xs text-muted-foreground">{r.model}</p>
                </td>
                <td className="px-3 py-3 text-right">{r.bizKm > 0 ? `${fmt(r.bizKm)} km` : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-3 text-right">{r.bizToll > 0 ? `${fmt(r.bizToll)}원` : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-3 text-right text-emerald-700">{r.comKm > 0 ? `${fmt(r.comKm)} km` : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-3 text-right text-emerald-700">{r.comToll > 0 ? `${fmt(r.comToll)}원` : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-3 text-right text-orange-700">{r.perKm > 0 ? `${fmt(r.perKm)} km` : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-3 text-right text-orange-700">{r.perToll > 0 ? `${fmt(r.perToll)}원` : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-3 text-right font-semibold">{fmt(r.totalKm)} km</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30">
              <td className="px-3 py-2.5 font-semibold text-sm">합계</td>
              <td className="px-3 py-2.5 text-right font-semibold text-sm">{fmt(rows.reduce((s,r)=>s+r.bizKm,0))} km</td>
              <td className="px-3 py-2.5 text-right font-semibold text-sm">{fmt(rows.reduce((s,r)=>s+r.bizToll,0))}원</td>
              <td className="px-3 py-2.5 text-right font-semibold text-sm text-emerald-700">{fmt(rows.reduce((s,r)=>s+r.comKm,0))} km</td>
              <td className="px-3 py-2.5 text-right font-semibold text-sm text-emerald-700">{fmt(rows.reduce((s,r)=>s+r.comToll,0))}원</td>
              <td className="px-3 py-2.5 text-right font-semibold text-sm text-orange-700">{fmt(rows.reduce((s,r)=>s+r.perKm,0))} km</td>
              <td className="px-3 py-2.5 text-right font-semibold text-sm text-orange-700">{fmt(rows.reduce((s,r)=>s+r.perToll,0))}원</td>
              <td className="px-3 py-2.5 text-right font-semibold text-sm">{fmt(rows.reduce((s,r)=>s+r.totalKm,0))} km</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
