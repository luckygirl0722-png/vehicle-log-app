import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RetroactiveForm from "./_components/RetroactiveForm";

interface Props {
  searchParams: Promise<{ vehicle_id?: string; from_km?: string; to_km?: string }>;
}

export default async function RetroactivePage({ searchParams }: Props) {
  const sp = await searchParams;
  const vehicleId = sp.vehicle_id ?? "";
  const fromKm    = parseInt(sp.from_km ?? "", 10);
  const toKm      = parseInt(sp.to_km   ?? "", 10);

  if (!vehicleId || isNaN(fromKm) || isNaN(toKm) || toKm <= fromKm) {
    redirect("/vehicle-trips");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 본인 driver 정보
  const { data: myDriver } = await supabase
    .from("drivers")
    .select("id, name")
    .eq("user_id", user.id)
    .single();

  if (!myDriver) redirect("/vehicle-trips");

  // 이 차량에 배정된 운전자인지 확인
  const { data: assignment } = await supabase
    .from("vehicle_drivers")
    .select("vehicle_id")
    .eq("vehicle_id", vehicleId)
    .eq("driver_id", myDriver.id)
    .maybeSingle();

  if (!assignment) redirect("/vehicle-trips");

  // 차량 정보
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, plate_number, model")
    .eq("id", vehicleId)
    .single();

  if (!vehicle) redirect("/vehicle-trips");

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <a href="/vehicle-trips" className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <div>
          <h1 className="text-base font-bold">소급 운행 입력</h1>
          <p className="text-xs text-muted-foreground">누락된 구간을 직접 입력합니다</p>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="px-4 py-4 pb-8">
        <RetroactiveForm
          vehicleId={vehicle.id}
          plateNumber={vehicle.plate_number}
          vehicleModel={vehicle.model ?? ""}
          fromKm={fromKm}
          toKm={toKm}
          driverName={myDriver.name}
        />
      </div>
    </div>
  );
}
