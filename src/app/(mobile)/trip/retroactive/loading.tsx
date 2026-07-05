export default function RetroactiveLoading() {
  return (
    <div className="p-4 space-y-4">
      {/* 제목 */}
      <div className="h-6 w-32 bg-muted rounded animate-pulse" />
      <div className="h-4 w-56 bg-muted rounded animate-pulse" />

      {/* 구간 정보 카드 */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2 animate-pulse">
        <div className="h-4 w-24 bg-amber-200 rounded" />
        <div className="flex gap-3">
          <div className="h-10 flex-1 bg-amber-200 rounded-lg" />
          <div className="h-10 w-8 bg-amber-200 rounded-lg" />
          <div className="h-10 flex-1 bg-amber-200 rounded-lg" />
        </div>
      </div>

      {/* 폼 필드 */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-1 animate-pulse">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-10 bg-muted rounded-lg" />
        </div>
      ))}

      {/* 버튼 */}
      <div className="h-12 bg-muted rounded-xl animate-pulse mt-2" />
    </div>
  );
}
