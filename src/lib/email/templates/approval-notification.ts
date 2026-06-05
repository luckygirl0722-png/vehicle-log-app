import { emailWrapper, infoTable, actionButton, statusBadge, COMPANY_NAME } from "../templates/base";

export interface ApprovalNotificationData {
  driverName:   string;
  action:       "approved" | "rejected";
  comment:      string | null;
  vehiclePlate: string;
  depLocation:  string;
  arrLocation:  string;
  distanceKm:   number;
  purpose:      string;
  depTime:      string;
  appUrl:       string;
  tripId:       string;
}

/**
 * 관리자 승인/반려 시 → 운전자에게 발송하는 알림 이메일
 */
export function buildApprovalNotificationHtml(data: ApprovalNotificationData): string {
  const { action, driverName, comment } = data;
  const isApproved = action === "approved";

  const depDt  = new Date(data.depTime);
  const dateStr = depDt.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  const headline = isApproved
    ? "운행 기록이 <strong>승인</strong>되었습니다 ✅"
    : "운행 기록이 <strong>반려</strong>되었습니다 ❌";

  const desc = isApproved
    ? "제출하신 운행 기록이 승인 처리되었습니다."
    : "제출하신 운행 기록이 반려되었습니다. 사유를 확인하고 수정 후 재제출해주세요.";

  const commentBlock = comment
    ? `<div style="background:${isApproved ? "#D1FAE5" : "#FEE2E2"};border-radius:8px;padding:12px 16px;margin:16px 0;">
         <p style="margin:0 0 4px;font-size:12px;color:#6B7280;font-weight:600;">
           ${isApproved ? "승인 코멘트" : "반려 사유"}
         </p>
         <p style="margin:0;font-size:14px;color:${isApproved ? "#065F46" : "#991B1B"};">${comment}</p>
       </div>`
    : "";

  const ctaUrl   = isApproved
    ? `${data.appUrl}/my-trips`
    : `${data.appUrl}/trip/${data.tripId}/complete`;
  const ctaLabel = isApproved ? "내 기록 보기" : "반려 기록 확인하기";
  const ctaColor = isApproved ? "#065F46" : "#991B1B";

  const body = `
    <h2 style="margin:0 0 4px;font-size:18px;color:#111827;">${headline}</h2>
    <p style="margin:0 0 16px;color:#6B7280;font-size:14px;">${desc}</p>

    ${statusBadge(action)}
    ${commentBlock}

    ${infoTable([
      ["차량",     data.vehiclePlate],
      ["출발지",   data.depLocation],
      ["목적지",   data.arrLocation],
      ["운행거리", `${data.distanceKm.toLocaleString("ko-KR")} km`],
      ["업무목적", data.purpose],
      ["운행일",   dateStr],
    ])}

    ${actionButton(ctaLabel, ctaUrl, ctaColor)}
  `;

  return emailWrapper(body, COMPANY_NAME as string);
}

export function buildApprovalNotificationSubject(
  action: "approved" | "rejected",
  depLocation: string
): string {
  const label = action === "approved" ? "승인" : "반려";
  return `[차량일지] 운행 기록 ${label} 안내 (${depLocation} 출발)`;
}
