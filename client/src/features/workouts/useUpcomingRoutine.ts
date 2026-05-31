/**
 * 取得「當前學員」的下一張未完成課表（今日排程用）
 * 呼叫 GET /api/workouts/routines?clientId=...&upcoming=true&limit=1，
 * 取第一筆作為 upcoming routine。
 * TODO: 之後可改由後端 API 直接回傳單一「當前最近的 upcoming routine」。
 */

import { useQuery } from "@tanstack/react-query";
import type { WorkoutRoutine } from "./types";
import { getWorkoutsRoutines } from "./routinesApi";

export interface UseUpcomingRoutineOptions {
  /** 學員 ID，不傳則不發請求（由呼叫方傳入 useAuth().user?.id） */
  clientId: string | null | undefined;
  /** 是否啟用請求（例如僅在 CLIENT 模式且已登入時） */
  enabled?: boolean;
}

export interface UseUpcomingRoutineResult {
  routine: WorkoutRoutine | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useUpcomingRoutine(
  options: UseUpcomingRoutineOptions
): UseUpcomingRoutineResult {
  const { clientId, enabled = true } = options;
  const effectiveEnabled = enabled && !!clientId;

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["/api/workouts/routines", "upcoming", clientId ?? ""],
    queryFn: async () => {
      const res = await getWorkoutsRoutines({
        clientId: clientId ?? undefined,
        upcoming: true,
        limit: 1,
      });
      return res;
    },
    enabled: effectiveEnabled,
  });

  const routine =
    data?.routines && data.routines.length > 0 ? data.routines[0] : null;

  return {
    routine,
    isLoading: effectiveEnabled ? isLoading : false,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    refetch,
  };
}
