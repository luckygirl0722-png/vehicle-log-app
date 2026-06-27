export default function TripsLoading() {
  return (
    <div className="p-6 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 bg-muted rounded animate-pulse" />
        <div className="h-9 w-36 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* 필터 바 */}
      <div className="flex gap-2 flex-wrap">
        {[120, 100, 140, 100, 80].map((w, i) => (
          <div key={i} className="h-9 bg-muted rounded-lg animate-pulse" style={{ width: w }} />
        ))}
      </div>

      {/* 테이블 */}
      <div className="rounded-lg border bg-background overflow-hidden">
        <div className="flex gap-4 px-4 py-3 bg-muted/50 border-b">
          {[4, 3, 5, 4, 3, 3, 3, 3].map((cols, i) => (
            <div key={i} className={`h-3 w-${cols * 8} bg-muted rounded animate-pulse flex-1`} />
          ))}
        </div>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0 animate-pulse">
            <div className="h-4 flex-1 bg-muted rounded" />
            <div className="h-4 flex-1 bg-muted rounded" />
            <div className="h-4 flex-[2] bg-muted rounded" />
            <div className="h-4 flex-1 bg-muted rounded" />
            <div className="h-4 flex-1 bg-muted rounded" />
            <div className="h-5 w-16 bg-muted rounded-full" />
            <div className="h-5 w-14 bg-muted rounded-full" />
            <div className="h-7 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
