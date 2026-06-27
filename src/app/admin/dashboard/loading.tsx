export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* 페이지 제목 */}
      <div className="h-7 w-32 bg-muted rounded animate-pulse" />

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-background p-4 space-y-2 animate-pulse">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-8 w-16 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* 차트 영역 2개 */}
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border bg-background p-4 animate-pulse">
            <div className="h-4 w-28 bg-muted rounded mb-4" />
            <div className="h-48 bg-muted rounded-lg" />
          </div>
        ))}
      </div>

      {/* 집계 테이블 */}
      <div className="rounded-xl border bg-background animate-pulse">
        <div className="p-4 border-b">
          <div className="h-5 w-32 bg-muted rounded" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-4 w-16 bg-muted rounded" />
            <div className="h-4 w-16 bg-muted rounded" />
            <div className="h-4 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
