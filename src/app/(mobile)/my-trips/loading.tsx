export default function MyTripsLoading() {
  return (
    <div className="p-4 space-y-3">
      {/* 탭 스켈레톤 */}
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 w-20 bg-muted rounded-full animate-pulse" />
        ))}
      </div>

      {/* 월간 요약 카드 */}
      <div className="rounded-xl border bg-background p-4 animate-pulse">
        <div className="h-4 w-28 bg-muted rounded mb-3" />
        <div className="flex gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-12 bg-muted rounded" />
              <div className="h-5 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 운행 목록 */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-xl border bg-background p-3 animate-pulse">
          <div className="flex justify-between mb-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-4 w-14 bg-muted rounded" />
          </div>
          <div className="h-3 w-36 bg-muted rounded mb-1" />
          <div className="flex gap-2 mt-2">
            <div className="h-6 w-12 bg-muted rounded" />
            <div className="h-6 w-12 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
