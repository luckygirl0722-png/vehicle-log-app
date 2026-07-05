export default function MonthCloseLoading() {
  return (
    <div className="p-6 max-w-3xl space-y-4">
      <div className="h-7 w-40 bg-muted rounded animate-pulse" />
      <div className="h-4 w-72 bg-muted rounded animate-pulse" />
      <div className="rounded-xl border border-border overflow-hidden animate-pulse">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="ml-auto h-4 w-12 bg-muted rounded" />
            <div className="h-6 w-16 bg-muted rounded-full" />
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-7 w-16 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
