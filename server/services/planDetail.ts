import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { exerciseSets, exercises, routineExercises } from "../db/schema";

/** 與 GET /api/plans/:routineId 的 exercises 陣列一致（含編輯器 round-trip 欄位） */
export type PlanDetailExerciseJson = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  restTimerSeconds: number;
  sets: PlanDetailSetJson[];
};

export type PlanDetailSetJson = {
  id: string;
  setIndex: number;
  setType: string | null;
  weight: number | null;
  reps: number | null;
  targetRpe: number | null;
};

export async function loadPlanExercisesJson(routineId: string): Promise<PlanDetailExerciseJson[]> {
  const reRows = await db
    .select({
      id: routineExercises.id,
      exerciseId: routineExercises.exerciseId,
      exerciseName: exercises.name,
      order: routineExercises.order,
      restTimerSeconds: routineExercises.restTimerSeconds,
    })
    .from(routineExercises)
    .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
    .where(eq(routineExercises.routineId, routineId))
    .orderBy(asc(routineExercises.order));

  const reIds = reRows.map((x) => x.id);

  const setRows = reIds.length
    ? await db
        .select({
          id: exerciseSets.id,
          routineExerciseId: exerciseSets.routineExerciseId,
          setIndex: exerciseSets.setIndex,
          setType: exerciseSets.setType,
          targetWeight: exerciseSets.targetWeight,
          targetReps: exerciseSets.targetReps,
          targetRpe: exerciseSets.targetRpe,
        })
        .from(exerciseSets)
        .where(inArray(exerciseSets.routineExerciseId, reIds))
        .orderBy(asc(exerciseSets.setIndex))
    : [];

  const setsByRoutineExerciseId = new Map<string, typeof setRows>();
  for (const s of setRows) {
    const list = setsByRoutineExerciseId.get(s.routineExerciseId) ?? [];
    list.push(s);
    setsByRoutineExerciseId.set(s.routineExerciseId, list);
  }

  return reRows.map((re) => {
    const setsForRe = setsByRoutineExerciseId.get(re.id) ?? [];
    return {
      id: re.id,
      exerciseId: re.exerciseId,
      exerciseName: re.exerciseName ?? "",
      order: re.order,
      restTimerSeconds: re.restTimerSeconds ?? 90,
      sets: setsForRe.map((s) => ({
        id: s.id,
        setIndex: s.setIndex,
        setType: s.setType ?? null,
        weight: s.targetWeight != null ? Number(s.targetWeight) : null,
        reps: s.targetReps ?? null,
        targetRpe: s.targetRpe ?? null,
      })),
    };
  });
}
