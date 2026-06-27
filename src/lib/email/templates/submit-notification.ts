import { emailWrapper, infoTable, actionButton, statusBadge, COMPANY_NAME } from "../templates/base";

export interface SubmitNotificationData {
  driverName:   string;
  department:   string;
  vehiclePlate: string;
  depLocation:  string;
  arrLocation:  string;
  distanceKm:   number;
  tollFee:      number;
  purpose:      string;
  depTime:      string;   // ISO 날짜 문자열
  appUrl:       string;   // 앱 기본 URL
  tripId:       string;
}

/**
 * 운전자 기록 제출 시 → 관리자에게 발송하는 알림 이메일
 */
export function buildSubmitNotificationHtml(data: SubmitNotificationData): string {
  const depDt = new Date(data.depTime);
  const dateStr = depDt.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  const body = `
    <h2 style="margin:0 0 4px;font-size:18px;color:#111827;">운행 기록 승인 요청</h2>
    <p style="margin:0 0 16px;color:#6B7280;font-size:14px;">
      ${data.driverName} 님(${data.department})이 운행 기록을 제출했습니다.
    </p>

    ${statusBadge("submitted")}

    ${infoTable([
      ["운전자",   `${data.driverName} (${data.department})`],
      ["차량",     data.vehiclePlate],
      ["출발지",   data.depLocation],
      ["목적지",   data.arrLocation],
      ["운행거리", `${data.distanceKm.toLocaleString("ko-KR")} km`],
      ["통행료",   data.tollFee > 0 ? `${data.tollFee.toLocaleString("ko-KR")}원` : "없음"],
      ["업무목적", data.purpose],
      ["운행일",   dateStr],
    ])}

    <p style="color:#374151;font-size:14px;margin:16px 0 8px;">
      아래 버튼을 눌러 승인 관리 페이지에서 처리해주세요.
    </p>
    ${actionButton("✅ 승인 관리 페이지로 이동", `${data.appUrl}/admin/approvals`)}
  `;

  return emailWrapper(body, COMPANY_NAME as string);
}

export function buildSubmitNotificationSubject(driverName: string): string {
  return `[차량일지] ${driverName} 님의 운행 기록 승인 요청`;
}
