"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * 이메일/비밀번호 로그인 Server Action
 * 로그인 성공 시 drivers 테이블 user_id 자동 연결
 */
export async function loginAction(formData: FormData) {
  const supabase = await createClient();

  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인에 실패했습니다." };

  // 역할 조회
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  // 이메일로 drivers 테이블 조회 → user_id 자동 연결 (첫 로그인 시)
  const { data: driverByEmail } = await supabase
    .from("drivers")
    .select("id, user_id")
    .eq("email", email)
    .maybeSingle();

  if (driverByEmail && !driverByEmail.user_id) {
    // 이메일이 일치하는 driver가 있고 아직 user_id가 없으면 연결
    await supabase
      .from("drivers")
      .update({ user_id: user.id })
      .eq("id", driverByEmail.id);
  }

  revalidatePath("/", "layout");
  const role = roleRow?.role ?? "driver";
  redirect(role === "admin" ? "/admin/dashboard" : "/");
}

/**
 * 로그아웃 Server Action
 */
export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
