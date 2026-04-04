/**
 * 課表 API：與 GET /api/workouts/routines 對接
 * 使用專案既有 apiClient，回傳與 @/features/workouts/types 對齊的 WorkoutRoutine[]
 */

import { apiClient } from "@/lib/api-client";
import type { WorkoutRoutine } from "./types";

export interface GetWorkoutsRoutinesParams {
  /** 學員 ID（不傳則後端用當前用戶） */
  clientId?: string;
  /** 教練 ID：查該教練開出的課表 */
  coachId?: string;
  /** 只回傳未完成且排程日 >= 今日 */
  upcoming?: boolean;
  /** 筆數上限，預設 10 */
  limit?: number;
}

export interface GetWorkoutsRoutinesResponse {
  routines: WorkoutRoutine[];
}

/**
 * GET /api/workouts/routines
 * 回傳課表列表，結構與前端 WorkoutRoutine 一致
 */
export async function getWorkoutsRoutines(
  params?: GetWorkoutsRoutinesParams
): Promise<GetWorkoutsRoutinesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.clientId) searchParams.set("clientId", params.clientId);
  if (params?.coachId) searchParams.set("coachId", params.coachId);
  if (params?.upcoming === true) searchParams.set("upcoming", "true");
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  const query = searchParams.toString();
  const url = query ? `/api/workouts/routines?${query}` : "/api/workouts/routines";
  const res = await apiClient.get<GetWorkoutsRoutinesResponse>(url);
  return res.data;
}
