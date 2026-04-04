import { apiClient } from "@/lib/api-client";
import { WorkoutRoutine, RoutineExercise, RoutineSet } from "./types";

// --------------------------- 型別定義 ---------------------------

export interface BackendAiRoutineSet {
  targetWeight: number | null;
  targetReps: number | null;
  targetRpe: number | null;
}

export interface BackendAiRoutineExercise {
  exerciseName: string;
  sets: BackendAiRoutineSet[];
}

export interface BackendAiRoutineResponse {
  name: string;
  notes: string;
  exercises: BackendAiRoutineExercise[];
}

export interface BackendAiSummaryResponse {
  summary: string;
  highlights?: string[];
  suggestions?: string[];
}

export interface AiGenerateRoutineOptions {
  prompt: string;
  clientId?: string;
  baseRoutine?: WorkoutRoutine;
}

// ---------------------- 後端 → 前端轉換 -------------------------

/**
 * 將後端 AI 產生的簡化課表結構轉為前端的 WorkoutRoutine 片段。
 * - 不處理 coachId / DB 關聯，只負責 UI 所需欄位。
 */
function backendAiRoutineToUI(
  backend: BackendAiRoutineResponse,
  base?: WorkoutRoutine,
): WorkoutRoutine {
  const baseExercises = base?.exercises ?? [];
  const now = Date.now();

  const aiExercises: RoutineExercise[] = backend.exercises.map((ex, i) => {
    const sets: RoutineSet[] = ex.sets.map((s, j) => ({
      id: `ai-set-${now}-${i}-${j}`,
      setIndex: j + 1,
      setType: "normal",
      targetWeight: s.targetWeight,
      targetReps: s.targetReps,
      targetRpe: s.targetRpe,
      actualWeight: null,
      actualReps: null,
      isCompleted: false,
    }));

    const order = baseExercises.length + i + 1;

    return {
      id: `ai-ex-${now}-${i}`,
      exerciseId: `ai-temp-${i}`,
      exerciseName: ex.exerciseName,
      order,
      restTimerSeconds: 90,
      sets,
    };
  });

  return {
    id: base?.id ?? String(now),
    name: backend.name || base?.name || "AI 建議課表",
    notes: backend.notes || base?.notes || "",
    clientId: base?.clientId,
    clientName: base?.clientName,
    scheduledDate: base?.scheduledDate ?? "",
    isCompleted: false,
    exercises: [...baseExercises, ...aiExercises],
  };
}

// ---------------------- 對外暴露的 helper ----------------------

/**
 * 前端呼叫：AI 產生課表骨架
 * - 目前實作：呼叫後端 POST /api/ai/generate-routine
 * - 後端負責使用 Gemini，回傳 BackendAiRoutineResponse
 */
export async function requestAiGeneratedRoutine(
  options: AiGenerateRoutineOptions,
): Promise<WorkoutRoutine> {
  const { prompt, baseRoutine } = options;

  const res = await apiClient.post<BackendAiRoutineResponse>(
    "/api/ai/generate-routine",
    { prompt },
  );

  return backendAiRoutineToUI(res.data, baseRoutine);
}

/**
 * 前端呼叫：AI 產生訓練總結
 * - 目前實作：呼叫後端 POST /api/ai/workout-insight
 * - 後端負責根據 routine / completedExercises 產生 summary JSON
 */
export async function requestAiWorkoutSummary(
  routine: WorkoutRoutine,
): Promise<string> {
  // 將完成組合成較精簡的結構傳給後端，方便 prompt 中使用
  const completedExercises = routine.exercises.map((ex) => ({
    name: ex.exerciseName,
    sets: ex.sets
      .filter((s) => s.isCompleted)
      .map((s) => ({
        targetWeight: s.targetWeight,
        targetReps: s.targetReps,
        actualWeight: s.actualWeight,
        actualReps: s.actualReps,
      })),
  }));

  const res = await apiClient.post<BackendAiSummaryResponse>(
    "/api/ai/workout-insight",
    {
      routine,
      completedExercises,
    },
  );

  return res.data.summary;
}

