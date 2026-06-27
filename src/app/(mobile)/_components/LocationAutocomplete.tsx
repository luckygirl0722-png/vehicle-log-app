"use client";
import { useState, useRef, useEffect } from "react";

/* ── localStorage 이력 관리 ─────────────────────────────── */
const STORAGE_KEY = "samwoo_location_history";
const MAX_HISTORY = 50;

export function saveLocationHistory(loc: string) {
  if (!loc.trim()) return;
  try {
    const existing: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    const updated = [loc.trim(), ...existing.filter(l => l !== loc.trim())].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

function getHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch { return []; }
}

/* ── 초성 매칭 ─────────────────────────────────────────── */
const INITIALS = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const JAMO_RE  = /^[ㄱ-ㅎ]+$/; // 자음만으로 구성된 문자열

function getInitialOf(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) {
    return INITIALS[Math.floor((code - 0xAC00) / (21 * 28))];
  }
  return ch;
}

function matchesQuery(target: string, query: string): boolean {
  if (!query) return true;
  // 일반 포함 검사
  if (target.toLowerCase().includes(query.toLowerCase())) return true;
  // 초성만 입력된 경우
  if (JAMO_RE.test(query)) {
    const initials = [...target].map(getInitialOf).join("");
    return initials.includes(query);
  }
  return false;
}

/* ── 컴포넌트 ─────────────────────────────────────────── */
interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  /** 입력 후 포커스 아웃 시 이력에 즉시 저장할지 여부 (기본 false — 제출 시 저장 권장) */
  saveOnBlur?: boolean;
}

/* ── 최근 입력 버튼 (클라이언트 컴포넌트) ────────────────── */
interface RecentBtnProps {
  onSelect: (v: string) => void;
  current: string;
  max?: number;
}
export function RecentLocationButtons({ onSelect, current, max = 5 }: RecentBtnProps) {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    setRecent(getHistory().slice(0, max));
  }, [max]);
  if (!recent.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {recent.map(loc => (
        <button key={loc} type="button" onClick={() => onSelect(loc)}
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors
            ${current === loc
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border text-muted-foreground hover:text-foreground"}`}>
          🕐 {loc}
        </button>
      ))}
    </div>
  );
}

export default function LocationAutocomplete({
  id, value, onChange, placeholder, required, className, saveOnBlur = false,
}: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen]               = useState(false);
  const [activeIdx, setActiveIdx]     = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  /* 입력 변경 → 자동완성 목록 갱신 */
  function handleChange(v: string) {
    onChange(v);
    if (v.length > 0) {
      const matches = getHistory().filter(h => matchesQuery(h, v)).slice(0, 8);
      setSuggestions(matches);
      setOpen(matches.length > 0);
      setActiveIdx(-1);
    } else {
      setOpen(false);
    }
  }

  /* 포커스 시 이력 전체 표시 */
  function handleFocus() {
    if (!value) {
      const history = getHistory().slice(0, 8);
      if (history.length > 0) {
        setSuggestions(history);
        setOpen(true);
      }
    }
  }

  /* 항목 선택 */
  function handleSelect(loc: string) {
    onChange(loc);
    setOpen(false);
    setActiveIdx(-1);
  }

  /* 키보드 네비게이션 */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  /* 외부 클릭 시 닫기 */
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  /* saveOnBlur 옵션 */
  function handleBlur() {
    if (saveOnBlur && value.trim()) saveLocationHistory(value.trim());
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => handleChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className={className}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-border bg-background shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
              className={`w-full text-left px-4 py-3 text-sm border-b border-border last:border-0 transition-colors
                ${i === activeIdx ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
            >
              <span className="text-muted-foreground mr-2 text-xs">🕐</span>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
