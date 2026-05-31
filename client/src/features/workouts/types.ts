/**
 * 共用型別：與後端 Hevy 風格 schema 對齊，供 workouts 相關元件與 apiMapping / aiHelpers 使用。
 */

export type ViewMode = 'CLIENT' | 'COACH';

export interface ExerciseDef {
  id: string;
  name: string;
  muscleGroup: string;
}

export interface RoutineSet {
  id: string;
  setIndex: number;
  setType: 'warmup' | 'normal' | 'drop';
  targetWeight: number | null;
  targetReps: number | null;
  targetRpe: number | null;
  actualWeight: number | null;
  actualReps: number | null;
  isCompleted: boolean;
}

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  restTimerSeconds: number;
  sets: RoutineSet[];
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  clientId?: string;
  clientName?: string;
  notes: string;
  scheduledDate: string;
  isCompleted: boolean;
  exercises: RoutineExercise[];
}
