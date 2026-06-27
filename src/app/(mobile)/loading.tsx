export default function MobileHomeLoading() {
  return (
    <div className="p-4 space-y-4">
      {/* 월 헤더 스켈레톤 */}
      <div className="h-6 w-32 bg-muted rounded animate-pulse" />

      {/* 집계 카드 3개 */}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border bg-background p-3 space-y-2 animate-pulse">
            <div className="h-3 w-12 bg-muted rounded" />
            <div className="h-6 w-16 bg-muted rounded" />
            <div className="h-3 w-10 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* 최근 운행 헤더 */}
      <div className="h-5 w-24 bg-muted rounded animate-pulse mt-2" />

      {/* 운행 목록 스켈레톤 5행 */}
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border bg-background p-3 animate-pulse">
            <div className="flex items-center justify-between mb-2">
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-4 w-12 bg-muted rounded" />
            </div>
            <div className="h-3 w-40 bg-muted rounded mb-1" />
            <div className="h-3 w-28 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
