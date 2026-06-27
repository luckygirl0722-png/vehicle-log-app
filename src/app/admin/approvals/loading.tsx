export default function ApprovalsLoading() {
  return (
    <div className="p-6 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-28 bg-muted rounded animate-pulse" />
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-9 w-24 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 w-20 bg-muted rounded-full animate-pulse" />
        ))}
      </div>

      {/* 카드 목록 */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-background p-4 animate-pulse">
          <div className="flex justify-between mb-3">
            <div className="space-y-1">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
            <div className="h-5 w-16 bg-muted rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-3 bg-muted rounded" />
            ))}
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-16 bg-muted rounded" />
            <div className="h-8 w-16 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
