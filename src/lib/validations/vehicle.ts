import { z } from "zod";

/** 차량번호 정규식: 숫자2-3자리 + 한글1자 + 숫자4자리 (예: 12가3456, 123나4567) */
const plateRegex = /^\d{2,3}[가-힣]\d{4}$/;

export const VehicleCreateSchema = z.object({
  plate_number: z
    .string()
    .min(1, "차량번호를 입력하세요.")
    .regex(plateRegex, "올바른 차량번호 형식이 아닙니다. (예: 12가3456)"),
  model: z
    .string()
    .min(1, "차종을 입력하세요.")
    .max(50, "차종은 50자 이내로 입력하세요."),
  purpose: z.enum(["영업용", "업무용"], {
    errorMap: () => ({ message: "용도는 영업용 또는 업무용이어야 합니다." }),
  }),
  note: z.string().max(200, "비고는 200자 이내로 입력하세요.").optional(),
});

export const VehicleUpdateSchema = VehicleCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export type VehicleCreateInput = z.infer<typeof VehicleCreateSchema>;
export type VehicleUpdateInput = z.infer<typeof VehicleUpdateSchema>;
