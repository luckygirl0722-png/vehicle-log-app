import { redirect } from "next/navigation";

/**
 * 루트 진입점
 * TASK_03 인증 미들웨어 구현 후 역할 기반 리다이렉트로 교체됨
 */
export default function RootPage() {
  redirect("/login");
}
