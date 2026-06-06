/** 회사명 */
export const COMPANY_NAME = "삼우에레코주식회사";

/** 브랜드 컬러 */
const NAVY  = "#1F4E79";
const LGRAY = "#F9FAFB";
const BORDER = "#E5E7EB";
const TEXT  = "#111827";
const MUTED = "#6B7280";

/**
 * 이메일 공통 레이아웃 래퍼
 * 인라인 스타일 사용 (이메일 클라이언트 호환성)
 */
export function emailWrapper(body: string, companyName: string): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>차량 운행일지 알림</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Apple SD Gothic Neo',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
          style="background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">

          <!-- 헤더 -->
          <tr>
            <td style="background:${NAVY};padding:20px 28px;">
              <p style="margin:0;color:rgba(255,255,255,0.7);font-size:12px;">${companyName}</p>
              <p style="margin:4px 0 0;color:#FFFFFF;font-size:18px;font-weight:700;">차량 운행일지</p>
            </td>
          </tr>

          <!-- 본문 -->
          <tr>
            <td style="padding:28px;">
              ${body}
            </td>
          </tr>

          <!-- 푸터 -->
          <tr>
            <td style="background:${LGRAY};border-top:1px solid ${BORDER};padding:16px 28px;">
              <p style="margin:0;color:${MUTED};font-size:11px;line-height:1.6;">
                이 메일은 차량 운행일지 시스템에서 자동 발송되었습니다.<br>
                문의: 경영지원그룹 | ${companyName}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** 정보 행 컴포넌트 */
export function infoRow(label: string, value: string): string {
  return `
  <tr>
    <td style="padding:6px 0;color:#6B7280;font-size:13px;width:100px;">${label}</td>
    <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:500;">${value}</td>
  </tr>`;
}

/** 정보 테이블 컴포넌트 */
export function infoTable(rows: [string, string][]): string {
  return `
  <table cellpadding="0" cellspacing="0" width="100%"
    style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:12px 16px;margin:16px 0;">
    ${rows.map(([l, v]) => infoRow(l, v)).join("")}
  </table>`;
}

/** 버튼 컴포넌트 */
export function actionButton(text: string, href: string, color = "#1F4E79"): string {
  return `
  <a href="${href}"
    style="display:inline-block;background:${color};color:#FFFFFF;text-decoration:none;
           padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;margin-top:8px;">
    ${text}
  </a>`;
}

/** 상태 배지 */
export function statusBadge(status: "submitted" | "approved" | "rejected"): string {
  const configs = {
    submitted: { bg: "#FEF3C7", text: "#92400E", label: "승인 대기" },
    approved:  { bg: "#D1FAE5", text: "#065F46", label: "승인 완료" },
    rejected:  { bg: "#FEE2E2", text: "#991B1B", label: "반려됨"   },
  };
  const c = configs[status];
  return `<span style="background:${c.bg};color:${c.text};padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;">${c.label}</span>`;
}
