"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "pwa-install-dismissed";

/**
 * PWA 설치 유도 배너 (모바일 홈)
 * - beforeinstallprompt 이벤트 감지
 * - 사용자가 닫으면 localStorage에 기록 (재노출 방지)
 * - 이미 설치됐거나 dismissed 이력 있으면 표시 안 함
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow]                     = useState(false);

  useEffect(() => {
    // 이미 설치됨 (standalone 모드)
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // 이전에 닫은 적 있음
    if (localStorage.getItem(STORAGE_KEY) === "1") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="mx-4 mb-1 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        {/* 앱 아이콘 */}
        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shrink-0">
          <span className="text-xl">🚗</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">앱으로 설치하기</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            홈 화면에 추가하면 더 빠르게 실행할 수 있습니다
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleInstall}
              className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium
                         active:opacity-80 transition-opacity"
            >
              설치
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg border border-border text-muted-foreground px-3 py-1.5 text-xs
                         active:bg-muted transition-colors"
            >
              나중에
            </button>
          </div>
        </div>

        {/* 닫기 */}
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground p-1 -mt-1 -mr-1"
          aria-label="닫기"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
