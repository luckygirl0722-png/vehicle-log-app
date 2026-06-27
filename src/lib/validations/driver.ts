import { z } from "zod";

export const DriverCreateSchema = z.object({
  employee_no: z
    .string()
    .min(1, "사원번호를 입력하세요.")
    .max(20, "사원번호는 20자 이내로 입력하세요."),
  name: z
    .string()
    .min(1, "이름을 입력하세요.")
    .max(50, "이름은 50자 이내로 입력하세요."),
  department: z
    .string()
    .min(1, "부서를 입력하세요.")
    .max(50, "부서는 50자 이내로 입력하세요."),
  phone: z
    .string()
    .regex(/^010-\d{4}-\d{4}$/, "휴대폰 번호 형식이 올바르지 않습니다. (예: 010-1234-5678)")
    .optional()
    .or(z.literal("")),
  license_no: z
    .string()
    .max(30, "면허번호는 30자 이내로 입력하세요.")
    .optional(),
  user_id: z
    .string()
    .uuid("올바른 사용자 ID 형식이 아닙니다.")
    .optional()
    .nullable(),
});

export const DriverUpdateSchema = DriverCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export type DriverCreateInput = z.infer<typeof DriverCreateSchema>;
export type DriverUpdateInput = z.infer<typeof DriverUpdateSchema>;
