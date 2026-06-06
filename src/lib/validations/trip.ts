import { z } from "zod";

/** 출발 등록 스키마 */
export const TripStartSchema = z.object({
  vehicle_id:           z.string().uuid("올바른 차량 ID가 아닙니다."),
  driver_id:            z.string().uuid("올바른 운전자 ID가 아닙니다."),
  departure_location:   z.string().min(1, "출발지를 입력하세요.").max(200),
  departure_km:         z
    .number({ invalid_type_error: "출발 km는 숫자여야 합니다." })
    .int("출발 km는 정수여야 합니다.")
    .min(0, "출발 km는 0 이상이어야 합니다."),
  purpose:              z.string().min(1, "업무 목적을 입력하세요.").max(200),
  departure_time:       z.string().datetime({ offset: true }).optional(),
  trip_type:            z.enum(["업무", "출퇴근"]).default("업무"),
});

/** 도착 등록 스키마 */
export const TripEndSchema = z.object({
  arrival_location:     z.string().min(1, "목적지를 입력하세요.").max(200),
  arrival_km:           z
    .number({ invalid_type_error: "도착 km는 숫자여야 합니다." })
    .int("도착 km는 정수여야 합니다.")
    .min(0, "도착 km는 0 이상이어야 합니다."),
  toll_fee:             z
    .number({ invalid_type_error: "통행료는 숫자여야 합니다." })
    .int()
    .min(0, "통행료는 0 이상이어야 합니다.")
    .optional()
    .default(0),
  arrival_time:         z.string().datetime({ offset: true }).optional(),
  note:                 z.string().max(500).optional(),
});

/** 운행 기록 수정 스키마 (draft 상태만 허용) */
export const TripUpdateSchema = z.object({
  departure_location:   z.string().min(1).max(200).optional(),
  departure_km:         z.number().int().min(0).optional(),
  arrival_location:     z.string().min(1).max(200).optional(),
  arrival_km:           z.number().int().min(0).optional(),
  purpose:              z.string().min(1).max(200).optional(),
  toll_fee:             z.number().int().min(0).optional(),
  note:                 z.string().max(500).optional(),
});

/** 목록 조회 필터 파라미터 */
export const TripListQuerySchema = z.object({
  driver_id:    z.string().uuid().optional(),
  vehicle_id:   z.string().uuid().optional(),
  status:       z.enum(["draft", "submitted", "approved", "rejected"]).optional(),
  year:         z.coerce.number().int().min(2020).max(2100).optional(),
  month:        z.coerce.number().int().min(1).max(12).optional(),
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(20),
});

export type TripStartInput   = z.infer<typeof TripStartSchema>;
export type TripEndInput     = z.infer<typeof TripEndSchema>;
export type TripUpdateInput  = z.infer<typeof TripUpdateSchema>;
export type TripListQuery    = z.infer<typeof TripListQuerySchema>;
