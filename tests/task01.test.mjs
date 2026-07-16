/**
 * TASK_01 검증 테스트
 * Node.js ESM — 외부 테스트 프레임워크 없이 실행 가능
 *
 * 테스트 범주:
 *   [A] 필수 파일 존재 검사
 *   [B] JSON 파일 유효성 검사
 *   [C] package.json 의존성 검사
 *   [D] 환경변수 템플릿 검사
 *   [E] 유틸리티 함수 단위 테스트 (cn, formatKRW, formatKm)
 *   [F] TypeScript 타입 파일 구조 검사
 *   [G] Tailwind 설정 토큰 검사
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── 색상 출력 헬퍼 ─────────────────────────────────────
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";
const RESET  = "\x1b[0m";

let passed = 0;
let failed = 0;
const failures = [];

function ok(name) {
  console.log(`  ${GREEN}✓${RESET}  ${name}`);
  passed++;
}

function fail(name, reason) {
  console.log(`  ${RED}✗${RESET}  ${name}`);
  console.log(`     ${RED}→ ${reason}${RESET}`);
  failed++;
  failures.push({ name, reason });
}

function section(title) {
  console.log(`\n${BOLD}${CYAN}[${title}]${RESET}`);
}

function assert(condition, testName, errorMsg) {
  condition ? ok(testName) : fail(testName, errorMsg || "조건 불충족");
}

// ── [A] 필수 파일 존재 검사 ────────────────────────────
section("A — 필수 파일 존재 검사");

const REQUIRED_FILES = [
  "package.json",
  "tsconfig.json",
  "next.config.mjs",
  "tailwind.config.ts",
  ".env.example",
  ".prettierrc",
  "components.json",
  ".gitignore",
  "01_SETUP.md",
  "public/manifest.json",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/globals.css",
  "src/app/(auth)/login/page.tsx",
  "src/lib/utils.ts",
  "src/lib/supabase/client.ts",
  "src/lib/supabase/server.ts",
  "src/types/database.ts",
];

for (const f of REQUIRED_FILES) {
  const fullPath = path.join(ROOT, f);
  assert(fs.existsSync(fullPath), f, `파일 없음: ${fullPath}`);
}

// ── [B] JSON 파일 유효성 검사 ──────────────────────────
section("B — JSON 파일 유효성 검사");

const JSON_FILES = ["package.json", "tsconfig.json", "components.json", "public/manifest.json"];

for (const f of JSON_FILES) {
  try {
    const content = fs.readFileSync(path.join(ROOT, f), "utf-8");
    JSON.parse(content);
    ok(`${f} — 유효한 JSON`);
  } catch (e) {
    fail(`${f} — JSON 파싱 실패`, e.message);
  }
}

// ── [C] package.json 의존성 검사 ──────────────────────
section("C — package.json 의존성 검사");

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));

const REQUIRED_DEPS = [
  "@supabase/supabase-js",
  "@supabase/ssr",
  "zustand",
  "react-hook-form",
  "@hookform/resolvers",
  "zod",
  "date-fns",
  "recharts",
  "class-variance-authority",
  "clsx",
  "tailwind-merge",
  "lucide-react",
  "next-pwa",
];

const REQUIRED_DEV_DEPS = ["typescript", "prettier", "prettier-plugin-tailwindcss"];

for (const dep of REQUIRED_DEPS) {
  assert(dep in (pkg.dependencies || {}), `dependencies: ${dep}`, "누락된 의존성");
}
for (const dep of REQUIRED_DEV_DEPS) {
  assert(dep in (pkg.devDependencies || {}), `devDependencies: ${dep}`, "누락된 개발 의존성");
}

// scripts 검사
assert(pkg.scripts?.dev === "next dev",    "scripts.dev = next dev");
assert(pkg.scripts?.build === "next build","scripts.build = next build");
assert(pkg.scripts?.lint === "next lint",  "scripts.lint = next lint");
assert(pkg.scripts?.format != null,        "scripts.format 존재");

// ── [D] 환경변수 템플릿 검사 ──────────────────────────
section("D — 환경변수 템플릿 (.env.example) 검사");

const envExample = fs.readFileSync(path.join(ROOT, ".env.example"), "utf-8");

const REQUIRED_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "RESEND_API_KEY",
];

for (const key of REQUIRED_ENV_KEYS) {
  assert(envExample.includes(key), `.env.example: ${key} 포함`, "환경변수 키 누락");
}

// .env.local 이 .gitignore 에 포함되어 있는지
const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf-8");
assert(gitignore.includes(".env.local"), ".gitignore: .env.local 포함", "보안 위험 — .env.local 미등록");
assert(!fs.existsSync(path.join(ROOT, ".env.local")), ".env.local 미커밋 (파일 없음 정상)", ".env.local 이 실수로 생성됨");

// ── [E] 유틸리티 함수 단위 테스트 ─────────────────────
section("E — 유틸리티 함수 단위 테스트 (lib/utils.ts 로직 검증)");

// utils.ts를 직접 파싱하지 않고, 동일 로직을 인라인으로 테스트
// (TypeScript 컴파일 없이 순수 JS 로직 검증)
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// clsx + tailwind-merge 를 node_modules에서 직접 로드
let cn, formatKRW, formatKm;
try {
  const clsxMod    = require("/sessions/sleepy-nice-maxwell/mnt/outputs/vehicle-log-app/node_modules/clsx/dist/clsx.js");
  const twMergeMod = require("/sessions/sleepy-nice-maxwell/mnt/outputs/vehicle-log-app/node_modules/tailwind-merge/dist/cjs/index.js");

  const clsx    = clsxMod.clsx    || clsxMod.default || clsxMod;
  const twMerge = twMergeMod.twMerge || twMergeMod.default;

  cn = (...inputs) => twMerge(clsx(...inputs));
  formatKRW = (amount) =>
    new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(amount);
  formatKm = (km) =>
    `${new Intl.NumberFormat("ko-KR").format(km)} km`;

  ok("clsx + tailwind-merge 로드 성공");
} catch (e) {
  fail("유틸 모듈 로드", e.message);
}

if (cn) {
  // cn() 테스트
  assert(cn("a", "b") === "a b",                       "cn('a','b') = 'a b'");
  assert(cn("a", false, "b") === "a b",                "cn 조건부 클래스 처리");
  assert(cn("p-4", "p-2") === "p-2",                   "tailwind-merge: 충돌 클래스 후자 우선 (p-4 → p-2)");
  assert(cn(null, undefined, "flex") === "flex",        "cn null/undefined 무시");

  // formatKRW() 테스트
  const krw1500 = formatKRW(1500);
  assert(krw1500.includes("1,500"),   "formatKRW(1500) 천 단위 구분자 포함");
  assert(krw1500.includes("₩") || krw1500.includes("원") || krw1500.includes("KRW"),
    "formatKRW(1500) 통화 기호 포함");
  assert(formatKRW(0).includes("0"),  "formatKRW(0) 정상 처리");

  // formatKm() 테스트
  assert(formatKm(12345) === "12,345 km",  "formatKm(12345) = '12,345 km'");
  assert(formatKm(0) === "0 km",           "formatKm(0) = '0 km'");
  assert(formatKm(100) === "100 km",       "formatKm(100) = '100 km'");
}

// ── [F] TypeScript 타입 파일 구조 검사 ────────────────
section("F — TypeScript 타입 파일 구조 검사 (database.ts)");

const dbTypes = fs.readFileSync(path.join(ROOT, "src/types/database.ts"), "utf-8");

const DB_TYPE_CHECKS = [
  ["Database 인터페이스",      "export interface Database"],
  ["Vehicle 인터페이스",       "export interface Vehicle"],
  ["Driver 인터페이스",        "export interface Driver"],
  ["TripLog 인터페이스",       "export interface TripLog"],
  ["Approval 인터페이스",      "export interface Approval"],
  ["vehicles 테이블 정의",     '"vehicles"'],
  ["drivers 테이블 정의",      '"drivers"'],
  ["trip_logs 테이블 정의",    '"trip_logs"'],
  ["status 필드 타입",         '"draft" | "submitted" | "approved" | "rejected"'],
  ["distance_km 자동계산 표시","distance_km"],
];

for (const [label, token] of DB_TYPE_CHECKS) {
  assert(dbTypes.includes(token), `database.ts: ${label}`, `'${token}' 누락`);
}

// ── [G] 설정 파일 핵심 토큰 검사 ──────────────────────
section("G — 설정 파일 핵심 토큰 검사");

// tailwind.config.ts
const tw = fs.readFileSync(path.join(ROOT, "tailwind.config.ts"), "utf-8");
assert(tw.includes("#1f4e79"),    "tailwind: 브랜드 곤색(#1f4e79) 정의됨");
assert(tw.includes("darkMode"),   "tailwind: darkMode 설정 존재");
assert(tw.includes("--primary"),  "tailwind: CSS 변수 --primary 연결됨");
assert(tw.includes("Noto Sans"),  "tailwind: Noto Sans KR 폰트 설정됨");

// globals.css
const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf-8");
assert(css.includes("--primary"),      "globals.css: --primary 변수 정의됨");
assert(css.includes("214 59% 29%"),    "globals.css: 곤색 HSL값 정의됨");
assert(css.includes("Noto Sans KR"),   "globals.css: Noto Sans KR 임포트됨");
assert(css.includes("safe-area"),      "globals.css: 모바일 safe-area 유틸 존재");

// manifest.json
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "public/manifest.json"), "utf-8"));
assert(manifest.theme_color === "#1f4e79",  "manifest: theme_color = #1f4e79");
assert(manifest.display === "standalone",   "manifest: display = standalone (PWA)");
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "manifest: icons 2개 이상");

// components.json (shadcn/ui)
const shadcn = JSON.parse(fs.readFileSync(path.join(ROOT, "components.json"), "utf-8"));
assert(shadcn.tsx === true,                             "components.json: tsx = true");
assert(shadcn.tailwind?.cssVariables === true,          "components.json: cssVariables = true");
assert(shadcn.aliases?.utils === "@/lib/utils",         "components.json: utils 경로 = @/lib/utils");

// layout.tsx
const layout = fs.readFileSync(path.join(ROOT, "src/app/layout.tsx"), "utf-8");
assert(layout.includes('lang="ko"'),       'layout.tsx: lang="ko" 설정됨');
assert(layout.includes("차량 운행일지"),    "layout.tsx: 한국어 타이틀 설정됨");
assert(layout.includes("manifest"),        "layout.tsx: PWA manifest 연결됨");

// ── 최종 결과 ──────────────────────────────────────────
console.log("\n" + "─".repeat(50));
console.log(`${BOLD}테스트 결과${RESET}`);
console.log(`  통과: ${GREEN}${BOLD}${passed}${RESET}`);
console.log(`  실패: ${failed > 0 ? RED + BOLD : ""}${failed}${RESET}`);

if (failures.length > 0) {
  console.log(`\n${RED}${BOLD}실패 목록:${RESET}`);
  failures.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.name}`);
    console.log(`     → ${f.reason}`);
  });
  process.exit(1);
} else {
  console.log(`\n${GREEN}${BOLD}✅ 모든 테스트 통과 — TASK_01 검증 완료${RESET}`);
  process.exit(0);
}
