import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const adminClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await adminClient
    .from("user_roles").select("role").eq("user_id", user.id).single();
  return data?.role === "admin" ? user : null;
}

// GET — 마감 목록 조회
export async function GET() {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await adminClient
    .from("monthly_closings")
    .select("year, month, closed_at, memo")
    .order("year",  { ascending: false })
    .order("month", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ closings: data ?? [] });
}

// POST — 마감 처리
export async function POST(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { year, month, memo } = await req.json() as { year: number; month: number; memo?: string };
  if (!year || !month) return NextResponse.json({ error: "year, month required" }, { status: 400 });

  const { error } = await adminClient
    .from("monthly_closings")
    .upsert({ year, month, memo: memo ?? null, closed_by: user.id, closed_at: new Date().toISOString() },
             { onConflict: "year,month" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — 마감 해제
export async function DELETE(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { year, month } = await req.json() as { year: number; month: number };

  const { error } = await adminClient
    .from("monthly_closings")
    .delete()
    .eq("year", year)
    .eq("month", month);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
