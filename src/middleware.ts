import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 미들웨어 — 모든 요청에서 세션을 갱신하고 라우트를 보호합니다
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 아래 경로를 제외한 모든 요청에 미들웨어 적용:
     * - _next/static  (정적 파일)
     * - _next/image   (이미지 최적화)
     * - favicon.ico, manifest.json, sw.js (PWA)
     * - public 폴더 이미지 파일
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
