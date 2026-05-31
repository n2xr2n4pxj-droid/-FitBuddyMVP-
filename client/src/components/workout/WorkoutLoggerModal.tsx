import { useEffect, useMemo, useState } from "react";
import { Timer, X, Plus, Dumbbell } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import ExerciseSetRow, { type SetEntry } from "./ExerciseSetRow";
import WorkoutSummaryCard from "./WorkoutSummaryCard";
import { getWorkoutsRoutines } from "@/features/workouts/routinesApi";
import type { WorkoutRoutine as ApiWorkoutRoutine } from "@/features/workouts/types";

interface WorkoutLoggerModalProps {
  isOpen: boolean;
  routineId: string | null;
  onClose: () => void;
  onComplete: (sessionId: string) => void;
}

interface ExerciseEntry {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  targetSets: number;
  targetReps: number;
  targetLoad: number;
  sets: SetEntry[];
}

type ModalPhase = "logging" | "submitting" | "ai_loading" | "completed" | "error";

const FALLBACK_ROUTINE = {
  id: "mock-routine-1",
  name: "Push Day A 💪",
  exercises: [
    {
      exerciseId: "ex-bench-press",
      exerciseName: "Barbell Bench Press",
      muscleGroup: "胸部",
      sets: 4,
      reps: 8,
      load: 60,
    },
    {
      exerciseId: "ex-incline-db-press",
      exerciseName: "Incline Dumbbell Press",
      muscleGroup: "胸部",
      sets: 3,
      reps: 10,
      load: 20,
    },
    {
      exerciseId: "ex-cable-fly",
      exerciseName: "Cable Fly",
      muscleGroup: "胸部",
      sets: 3,
      reps: 12,
      load: 15,
    },
    {
      exerciseId: "ex-tricep-pushdown",
      exerciseName: "Tricep Pushdown",
      muscleGroup: "三頭",
      sets: 3,
      reps: 12,
      load: 20,
    },
  ],
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function WorkoutLoggerModal({
  isOpen,
  routineId,
  onClose,
  onComplete,
}: WorkoutLoggerModalProps) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<ModalPhase>("logging");
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [overallRpe, setOverallRpe] = useState<number>(7);
  const [notes, setNotes] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [aiComment, setAiComment] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [routineName, setRoutineName] = useState<string>("Workout Session");

  const mapRoutineToExerciseEntries = (routine: ApiWorkoutRoutine): ExerciseEntry[] =>
    routine.exercises.map((exercise) => {
      const baseSets = exercise.sets.length > 0 ? exercise.sets : [{ targetWeight: null, targetReps: null }];
      const firstSet = baseSets[0];
      const targetLoad = firstSet?.targetWeight ?? 0;
      const targetReps = firstSet?.targetReps ?? 10;

      return {
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        muscleGroup: "複合動作",
        targetSets: baseSets.length,
        targetReps,
        targetLoad,
        sets: baseSets.map((set) => ({
          weight: String(set.targetWeight ?? targetLoad),
          reps: String(set.targetReps ?? targetReps),
          isCompleted: false,
          isWarmup: "setType" in set ? set.setType === "warmup" : false,
        })),
      };
    });

  useEffect(() => {
    if (!isOpen) return;

    setPhase("logging");
    setElapsedSeconds(0);
    setNotes("");
    setOverallRpe(7);
    setAiComment("");
    setSessionId("");
    setRoutineName("Workout Session");

    let active = true;

    const loadRoutine = async () => {
      if (routineId && user?.id) {
        try {
          const result = await getWorkoutsRoutines({
            clientId: user.id,
            limit: 50,
          });
          const routine = result.routines.find((item) => item.id === routineId);
          if (routine && active) {
            setRoutineName(routine.name);
            setExercises(mapRoutineToExerciseEntries(routine));
            return;
          }
        } catch (error) {
          console.warn("Failed to load routine for session logger, fallback to local template.", error);
        }
      }

      if (!active) return;
      setRoutineName(FALLBACK_ROUTINE.name);
      const entries: ExerciseEntry[] = FALLBACK_ROUTINE.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId ?? `mock-${exercise.exerciseName}`,
        exerciseName: exercise.exerciseName,
        muscleGroup: exercise.muscleGroup ?? "複合動作",
        targetSets: exercise.sets,
        targetReps: exercise.reps,
        targetLoad: exercise.load,
        sets: Array.from({ length: exercise.sets }, () => ({
          weight: String(exercise.load),
          reps: String(exercise.reps),
          isCompleted: false,
          isWarmup: false,
        })),
      }));
      setExercises(entries);
    };

    loadRoutine();
    return () => {
      active = false;
    };
  }, [isOpen, routineId, user?.id]);

  useEffect(() => {
    if (!isOpen || phase !== "logging") return;
    const timer = window.setInterval(() => setElapsedSeconds((sec) => sec + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, phase]);

  useEffect(() => {
    if (phase !== "completed") return;
    const timer = window.setTimeout(() => onClose(), 3000);
    return () => window.clearTimeout(timer);
  }, [phase, onClose]);

  const totalCompletedSets = useMemo(
    () =>
      exercises.reduce(
        (sum, exercise) => sum + exercise.sets.filter((set) => set.isCompleted).length,
        0,
      ),
    [exercises],
  );

  const totalVolume = useMemo(
    () =>
      exercises.reduce(
        (sum, exercise) =>
          sum +
          exercise.sets
            .filter((set) => set.isCompleted)
            .reduce(
              (exerciseSum, set) =>
                exerciseSum +
                (Number.parseFloat(set.weight) || 0) * (Number.parseInt(set.reps, 10) || 0),
              0,
            ),
        0,
      ),
    [exercises],
  );

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: keyof SetEntry,
    value: string | boolean,
  ) => {
    setExercises((prev) =>
      prev.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((set, idx) =>
            idx === setIndex ? { ...set, [field]: value } : set,
          ),
        };
      }),
    );
  };

  const toggleSetComplete = (exerciseIndex: number, setIndex: number) => {
    setExercises((prev) =>
      prev.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((set, idx) =>
            idx === setIndex ? { ...set, isCompleted: !set.isCompleted } : set,
          ),
        };
      }),
    );
  };

  const addSet = (exerciseIndex: number) => {
    setExercises((prev) =>
      prev.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        const last = exercise.sets[exercise.sets.length - 1];
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              weight: last?.weight ?? String(exercise.targetLoad),
              reps: last?.reps ?? String(exercise.targetReps),
              isCompleted: false,
              isWarmup: false,
            },
          ],
        };
      }),
    );
  };

  const handleFinish = async () => {
    if (phase !== "logging") return;

    const completedExercises = exercises
      .map((exercise) => ({
        exerciseId: exercise.exerciseId,
        sets: exercise.sets
          .filter((set) => set.isCompleted)
          .map((set) => ({
            weight: Number.parseFloat(set.weight) || 0,
            reps: Number.parseInt(set.reps, 10) || 0,
            isWarmup: set.isWarmup,
          })),
      }))
      .filter((exercise) => exercise.sets.length > 0);

    if (completedExercises.length === 0) {
      window.alert("請先勾選至少一組完成的組數");
      return;
    }

    setPhase("submitting");

    try {
      const result = await api.logWorkoutSession({
        routineId: routineId ?? undefined,
        notes,
        rpe: overallRpe,
        exercises: completedExercises,
      });
      setSessionId(result.sessionId);

      setPhase("ai_loading");
      try {
        const insight = await api.getWorkoutInsight(
          {
            id: routineId ?? "session-routine",
            name: routineName,
            coachId: "",
            clientId: user?.id ?? "",
            scheduledDate: "",
            exercises: [],
          },
          completedExercises,
        );
        setAiComment(insight.summary || "做得好！今日訓練完成，繼續保持 💪");
      } catch {
        const fallbacks = [
          "做得好！今日訓練完成，繼續保持 💪",
          "好野！PR 就喺前面，加油 🔥",
          "今日捱過去咗，明日仲要更強 💯",
        ];
        setAiComment(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
      }

      setPhase("completed");
      onComplete(result.sessionId);
    } catch (error) {
      console.error("Workout session error:", error);
      setPhase("error");
      window.setTimeout(() => setPhase("logging"), 2000);
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md",
        "bg-white z-50 flex flex-col",
        "transition-transform duration-300",
        isOpen ? "translate-y-0" : "translate-y-full",
      )}
    >
      {phase === "completed" ? (
        <WorkoutSummaryCard
          aiComment={aiComment}
          elapsedSeconds={elapsedSeconds}
          totalSets={totalCompletedSets}
          totalVolume={totalVolume}
          overallRpe={overallRpe}
          onClose={onClose}
        />
      ) : (
        <>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
            <button
              type="button"
              onClick={onClose}
              className="p-2 -ml-2 active:scale-95 transition-transform"
            >
              <X size={20} className="text-gray-500" />
            </button>

            <div className="text-center">
              <h2 className="font-bold text-gray-800 text-base">{routineName}</h2>
              <p className="text-xs text-gray-400">{exercises.length} 個動作</p>
            </div>

            <div className="flex items-center gap-1 bg-gray-50 rounded-xl px-3 py-1.5">
              <Timer size={14} className="text-blue-500" />
              <span className="text-sm font-mono font-semibold text-blue-600">
                {formatTime(elapsedSeconds)}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            {exercises.map((exercise, exerciseIndex) => (
              <div key={exercise.exerciseId} className="bg-white rounded-[20px] shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">{exercise.exerciseName}</h3>
                  <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg">
                    {exercise.muscleGroup}
                  </span>
                </div>

                <div className="mt-3 text-[10px] text-gray-400 grid grid-cols-[28px_50px_60px_1fr_1fr_36px] gap-2 px-2">
                  <span className="text-center">組數</span>
                  <span className="text-center">上次</span>
                  <span className="text-center">目標</span>
                  <span className="text-center">重量</span>
                  <span className="text-center">次數</span>
                  <span className="text-center">✓</span>
                </div>

                <div className="mt-2 space-y-2">
                  {exercise.sets.map((set, setIndex) => (
                    <ExerciseSetRow
                      key={`${exercise.exerciseId}-${setIndex}`}
                      setIndex={setIndex}
                      targetReps={exercise.targetReps}
                      targetLoad={exercise.targetLoad}
                      set={set}
                      onUpdate={(field, value) =>
                        updateSet(exerciseIndex, setIndex, field, value)
                      }
                      onToggleComplete={() => toggleSetComplete(exerciseIndex, setIndex)}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => addSet(exerciseIndex)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-blue-600 bg-blue-50 rounded-xl py-2 text-sm font-medium active:scale-95 transition-transform"
                >
                  <Plus size={16} />
                  加一組
                </button>
              </div>
            ))}
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-4 space-y-4">
            {phase === "error" && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm px-3 py-2">
                儲存失敗，請稍後再試
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700">整體感覺 (RPE)</label>
                <span
                  className={cn(
                    "text-sm font-bold px-2 py-0.5 rounded-lg",
                    overallRpe <= 6
                      ? "bg-emerald-100 text-emerald-700"
                      : overallRpe <= 8
                        ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-600",
                  )}
                >
                  {overallRpe} / 10
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={overallRpe}
                onChange={(event) => setOverallRpe(Number(event.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>輕鬆</span>
                <span>適中</span>
                <span>極限</span>
              </div>
            </div>

            <textarea
              placeholder="今日訓練感想（選填）..."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-blue-400 placeholder:text-gray-300"
            />

            <button
              type="button"
              onClick={handleFinish}
              disabled={phase !== "logging"}
              className={cn(
                "w-full py-4 rounded-[20px] font-bold text-white text-base",
                "active:scale-95 transition-all",
                phase === "logging"
                  ? "bg-blue-600 shadow-lg shadow-blue-200"
                  : "bg-gray-300 cursor-not-allowed",
              )}
            >
              {phase === "logging" && (
                <span className="inline-flex items-center gap-2">
                  <Dumbbell size={18} />
                  完成訓練 🏁
                </span>
              )}
              {phase === "submitting" && "儲存中..."}
              {phase === "ai_loading" && "✨ 生成評語中..."}
            </button>

            {sessionId ? (
              <p className="text-[11px] text-gray-400 text-center">Session ID: {sessionId}</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
