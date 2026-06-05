"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * 이메일/비밀번호 로그인 Server Action
 */
export async function loginAction(formData: FormData) {
  const supabase = await createClient();

  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // 역할 조회 후 분기
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인에 실패했습니다." };

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

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
