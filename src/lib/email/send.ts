import { resend, EMAIL_FROM } from "./resend";
import {
  buildSubmitNotificationHtml,
  buildSubmitNotificationSubject,
  type SubmitNotificationData,
} from "./templates/submit-notification";
import {
  buildApprovalNotificationHtml,
  buildApprovalNotificationSubject,
  type ApprovalNotificationData,
} from "./templates/approval-notification";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * 이메일 발송 실패 시 앱 동작에 영향을 주지 않도록
 * 모든 함수는 예외를 내부적으로 처리합니다.
 */

/**
 * 운전자 기록 제출 → 관리자 알림
 */
export async function sendSubmitNotification(params: {
  adminEmail:   string;
  data:         Omit<SubmitNotificationData, "appUrl">;
}): Promise<void> {
  try {
    await resend.emails.send({
      from:    EMAIL_FROM,
      to:      params.adminEmail,
      subject: buildSubmitNotificationSubject(params.data.driverName),
      html:    buildSubmitNotificationHtml({ ...params.data, appUrl: APP_URL }),
    });
  } catch (err) {
    // 이메일 실패가 주요 기능을 막지 않도록 로그만 출력
    console.error("[Email] 제출 알림 발송 실패:", err);
  }
}

/**
 * 관리자 승인/반려 → 운전자 알림
 */
export async function sendApprovalNotification(params: {
  driverEmail:  string;
  data:         Omit<ApprovalNotificationData, "appUrl">;
}): Promise<void> {
  try {
    await resend.emails.send({
      from:    EMAIL_FROM,
      to:      params.driverEmail,
      subject: buildApprovalNotificationSubject(params.data.action, params.data.depLocation),
      html:    buildApprovalNotificationHtml({ ...params.data, appUrl: APP_URL }),
    });
  } catch (err) {
    console.error("[Email] 승인/반려 알림 발송 실패:", err);
  }
}

/**
 * 관리자 이메일 목록 조회 헬퍼
 * user_roles 테이블에서 admin 역할 사용자 조회
 */
export async function getAdminEmails(supabase: any): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!data?.length) return [];

    // auth.users 에서 이메일 조회 (service role 필요)
    const { data: users } = await supabase.auth.admin.listUsers();
    const adminIds = new Set(data.map((r: any) => r.user_id));

    return users?.users
      ?.filter((u: any) => adminIds.has(u.id) && u.email)
      ?.map((u: any) => u.email) ?? [];
  } catch {
    return [];
  }
}

/**
 * 운전자 이메일 조회 헬퍼
 */
export async function getDriverEmail(supabase: any, driverId: string): Promise<string | null> {
  try {
    const { data: driver } = await supabase
      .from("drivers")
      .select("user_id")
      .eq("id", driverId)
      .single();

    if (!driver?.user_id) return null;

    const { data: { user } } = await supabase.auth.admin.getUserById(driver.user_id);
    return user?.email ?? null;
  } catch {
    return null;
  }
}
