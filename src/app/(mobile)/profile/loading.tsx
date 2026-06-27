export default function ProfileLoading() {
  return (
    <div className="p-4 space-y-4">
      {/* 아바타 + 이름 */}
      <div className="flex flex-col items-center py-4 space-y-2">
        <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
        <div className="h-5 w-24 bg-muted rounded animate-pulse" />
        <div className="h-3 w-36 bg-muted rounded animate-pulse" />
      </div>

      {/* 정보 카드 */}
      <div className="rounded-xl border bg-background p-4 space-y-3 animate-pulse">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 w-16 bg-muted rounded" />
            <div className="h-3 w-28 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* 비밀번호 변경 폼 */}
      <div className="rounded-xl border bg-background p-4 space-y-3 animate-pulse">
        <div className="h-4 w-28 bg-muted rounded" />
        {[0, 1].map((i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-10 bg-muted rounded-lg" />
          </div>
        ))}
        <div className="h-10 bg-muted rounded-lg" />
      </div>
    </div>
  );
}
