/**
 * Mock 資料：方便 demo 與開發。
 * NOTE: 這些 mock 僅用於 Storybook / 單元測試或開發 fallback；實際 UI 應透過 GET /api/workouts/routines 取得課表，動作庫可接 GET /api/exercises。
 * TODO: 之後改成從後端 API 取得動作庫／課表資料（例如 GET /api/exercises, GET /api/workouts/routines?clientId=...&upcoming=true）
 */

import type { ExerciseDef, WorkoutRoutine } from './types';

export const MOCK_LIBRARY: ExerciseDef[] = [
  { id: 'e1', name: 'Barbell Squat', muscleGroup: 'Legs' },
  { id: 'e2', name: 'Bench Press', muscleGroup: 'Chest' },
  { id: 'e3', name: 'Lat Pulldown', muscleGroup: 'Back' },
  { id: 'e4', name: 'Romanian Deadlift', muscleGroup: 'Legs' },
  { id: 'e5', name: 'Overhead Press', muscleGroup: 'Shoulders' },
];

export const MOCK_UPCOMING_ROUTINE: WorkoutRoutine = {
  id: 'r1',
  name: 'Leg Day (Hypertrophy)',
  notes: '注意離心控制，深蹲不要急。',
  scheduledDate: '今天',
  isCompleted: false,
  exercises: [
    {
      id: 're1',
      exerciseId: 'e1',
      exerciseName: 'Barbell Squat',
      order: 1,
      restTimerSeconds: 120,
      sets: [
        { id: 's1', setIndex: 1, setType: 'warmup', targetWeight: 60, targetReps: 10, targetRpe: null, actualWeight: null, actualReps: null, isCompleted: false },
        { id: 's2', setIndex: 2, setType: 'normal', targetWeight: 100, targetReps: 8, targetRpe: 8, actualWeight: null, actualReps: null, isCompleted: false },
        { id: 's3', setIndex: 3, setType: 'normal', targetWeight: 100, targetReps: 8, targetRpe: 8, actualWeight: null, actualReps: null, isCompleted: false },
      ],
    },
    {
      id: 're2',
      exerciseId: 'e4',
      exerciseName: 'Romanian Deadlift',
      order: 2,
      restTimerSeconds: 90,
      sets: [
        { id: 's4', setIndex: 1, setType: 'normal', targetWeight: 80, targetReps: 10, targetRpe: null, actualWeight: null, actualReps: null, isCompleted: false },
        { id: 's5', setIndex: 2, setType: 'normal', targetWeight: 80, targetReps: 10, targetRpe: null, actualWeight: null, actualReps: null, isCompleted: false },
      ],
    },
  ],
};
