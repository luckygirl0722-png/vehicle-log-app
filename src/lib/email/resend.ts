import { Resend } from "resend";

/** Resend 클라이언트 싱글턴 */
export const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");

/** 발신 이메일 주소 */
export const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@samwooeleco.com";

/** 회사명 */
export const COMPANY_NAME = "삼우에레코주식회사";
