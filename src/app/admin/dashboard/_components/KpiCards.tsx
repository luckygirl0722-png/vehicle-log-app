interface KpiCardsProps {
  currentMonth: {
    tripCount:      number;
    totalDistance:  number;
    totalToll:      number;
    submittedCount: number;
  };
  prevMonth: {
    tripCount:     number;
    totalDistance: number;
    totalToll:     number;
  };
}

function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const pct   = Math.round(((current - prev) / prev) * 100);
  const up    = pct >= 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

export default function KpiCards({ currentMonth, prevMonth }: KpiCardsProps) {
  const cards = [
    {
      label:   "이번 달 운행 건수",
      value:   currentMonth.tripCount.toLocaleString("ko-KR"),
      unit:    "건",
      delta:   <DeltaBadge current={currentMonth.tripCount}     prev={prevMonth.tripCount} />,
      icon:    "🚗",
      color:   "bg-blue-50 border-blue-100",
    },
    {
      label:   "이번 달 총 운행거리",
      value:   currentMonth.totalDistance.toLocaleString("ko-KR"),
      unit:    "km",
      delta:   <DeltaBadge current={currentMonth.totalDistance} prev={prevMonth.totalDistance} />,
      icon:    "📍",
      color:   "bg-emerald-50 border-emerald-100",
    },
    {
      label:   "이번 달 총 통행료",
      value:   currentMonth.totalToll.toLocaleString("ko-KR"),
      unit:    "원",
      delta:   <DeltaBadge current={currentMonth.totalToll}     prev={prevMonth.totalToll} />,
      icon:    "🛣",
      color:   "bg-amber-50 border-amber-100",
    },
    {
      label:   "승인 대기",
      value:   currentMonth.submittedCount.toLocaleString("ko-KR"),
      unit:    "건",
      delta:   null,
      icon:    "⏳",
      color:   currentMonth.submittedCount > 0
        ? "bg-red-50 border-red-200"
        : "bg-gray-50 border-gray-100",
      href:    "/admin/trips?status=submitted",
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(({ label, value, unit, delta, icon, color, href }) => {
        const inner = (
          <div className={`rounded-xl border p-5 space-y-3 ${color} ${href ? "hover:shadow-md transition-shadow cursor-pointer" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-medium">{label}</span>
              <span className="text-2xl">{icon}</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-foreground">{value}</span>
              <span className="text-sm text-muted-foreground mb-0.5">{unit}</span>
            </div>
            {delta && <div>{delta} <span className="text-xs text-muted-foreground">전월 대비</span></div>}
          </div>
        );
        return href
          ? <a key={label} href={href}>{inner}</a>
          : <div key={label}>{inner}</div>;
      })}
    </div>
  );
}
