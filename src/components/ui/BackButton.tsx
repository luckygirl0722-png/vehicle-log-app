"use client";
export default function BackButton() {
  return (
    <button onClick={() => window.history.back()}
      className="w-full text-sm text-muted-foreground py-2 hover:text-foreground transition-colors">
      ← 뒤로
    </button>
  );
}
