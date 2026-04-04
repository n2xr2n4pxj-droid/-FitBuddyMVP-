import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Search, Sparkles, Trash2, X } from "lucide-react";
import { api, type RoutineExercise } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface RoutineBuilderModalProps {
  isOpen: boolean;
  targetClientId: string | null;
  onClose: () => void;
  onRoutineCreated: (routineId: string) => void;
}

interface CoachClientOption {
  id: string;
  name: string;
}

interface RoutineExerciseEntry extends RoutineExercise {
  muscleGroup: string;
}

interface ExerciseLibraryItem {
  id: string;
  name: string;
  muscleGroup: string;
}

type BuilderPhase = "input" | "ai_generating" | "editing" | "saving" | "done";

const QUICK_PROMPTS = [
  { label: "Push Day", value: "幫學員安排 Push Day，包含胸部、肩部、三頭動作，中等重量增肌" },
  { label: "Pull Day", value: "幫學員安排 Pull Day，包含背部、二頭動作，注重背部收縮" },
  { label: "Leg Day", value: "幫學員安排 Leg Day，包含深蹲、腿舉、腿彎，強化腿部力量" },
  { label: "全身訓練", value: "安排一個全身性訓練，適合初學者，每個肌群一個動作" },
  { label: "核心強化", value: "安排核心訓練課表，包含穩定性與動態動作" },
  { label: "有氧混合", value: "安排有氧混合課表，結合重量訓練與心肺訓練" },
];

const MOCK_CLIENT_OPTIONS: CoachClientOption[] = [
  { id: "client-1", name: "Amy Chan" },
  { id: "client-2", name: "Ben Lau" },
  { id: "client-3", name: "Chloe Wong" },
];

const MOCK_EXERCISE_LIBRARY: ExerciseLibraryItem[] = [
  { id: "ex-1", name: "Barbell Bench Press", muscleGroup: "胸部" },
  { id: "ex-2", name: "Squat", muscleGroup: "腿部" },
  { id: "ex-3", name: "Deadlift", muscleGroup: "背部" },
  { id: "ex-4", name: "Overhead Press", muscleGroup: "肩部" },
  { id: "ex-5", name: "Pull Up", muscleGroup: "背部" },
  { id: "ex-6", name: "Incline Dumbbell Press", muscleGroup: "胸部" },
  { id: "ex-7", name: "Romanian Deadlift", muscleGroup: "腿部" },
  { id: "ex-8", name: "Tricep Pushdown", muscleGroup: "手臂" },
];

function todayDateKey(): string {
  return new Date().toISOString().split("T")[0];
}

export default function RoutineBuilderModal({
  isOpen,
  targetClientId,
  onClose,
  onRoutineCreated,
}: RoutineBuilderModalProps) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<BuilderPhase>("input");
  const [aiPrompt, setAiPrompt] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [routineName, setRoutineName] = useState("");
  const [scheduledDate, setScheduledDate] = useState(todayDateKey());
  const [coachTips, setCoachTips] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<RoutineExerciseEntry[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [clientOptions, setClientOptions] = useState<CoachClientOption[]>(MOCK_CLIENT_OPTIONS);

  useEffect(() => {
    if (!isOpen) return;
    setPhase("input");
    setAiPrompt("");
    setRoutineName("");
    setCoachTips("");
    setSelectedExercises([]);
    setExerciseSearch("");
    setScheduledDate(todayDateKey());
    setSelectedClientId(targetClientId ?? "");
  }, [isOpen, targetClientId]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadClients() {
      try {
        const users = await api.getMyClients();
        if (cancelled) return;
        if (users.length === 0) {
          setClientOptions(MOCK_CLIENT_OPTIONS);
          return;
        }
        setClientOptions(
          users.map((item) => ({
            id: item.id,
            name: item.name?.trim() || item.email,
          })),
        );
      } catch {
        if (!cancelled) setClientOptions(MOCK_CLIENT_OPTIONS);
      }
    }

    void loadClients();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const selectedClientName = useMemo(
    () => clientOptions.find((item) => item.id === selectedClientId)?.name ?? "學員",
    [clientOptions, selectedClientId],
  );

  const filteredLibrary = useMemo(() => {
    const q = exerciseSearch.trim().toLowerCase();
    if (!q) return [];
    return MOCK_EXERCISE_LIBRARY.filter(
      (item) =>
        item.name.toLowerCase().includes(q) || item.muscleGroup.toLowerCase().includes(q),
    ).slice(0, 6);
  }, [exerciseSearch]);

  async function handleAiGenerate() {
    if (!aiPrompt.trim() || !selectedClientId) return;
    setPhase("ai_generating");

    try {
      const result = await api.generateRoutine(selectedClientId, aiPrompt);
      const routine = result.routine;

      setRoutineName(routine.name ?? `AI 課表 - ${new Date().toLocaleDateString("zh-HK")}`);
      setCoachTips(routine.notes ?? routine.coachTips ?? "");
      setSelectedExercises(
        (routine.exercises ?? []).map((exercise, index) => ({
          exerciseId: exercise.exerciseId ?? MOCK_EXERCISE_LIBRARY[index % MOCK_EXERCISE_LIBRARY.length].id,
          exerciseName:
            exercise.exerciseName ??
            MOCK_EXERCISE_LIBRARY[index % MOCK_EXERCISE_LIBRARY.length].name,
          muscleGroup:
            MOCK_EXERCISE_LIBRARY.find((item) => item.id === exercise.exerciseId)?.muscleGroup ??
            "複合動作",
          sets: exercise.sets ?? 3,
          reps: exercise.reps ?? 10,
          load: exercise.load ?? 20,
        })),
      );
      setPhase("editing");
    } catch {
      setRoutineName("Push Day A（示範課表）");
      setSelectedExercises([
        {
          exerciseId: "ex-1",
          exerciseName: "Barbell Bench Press",
          muscleGroup: "胸部",
          sets: 4,
          reps: 8,
          load: 60,
        },
        {
          exerciseId: "ex-6",
          exerciseName: "Incline Dumbbell Press",
          muscleGroup: "胸部",
          sets: 3,
          reps: 10,
          load: 20,
        },
        {
          exerciseId: "ex-4",
          exerciseName: "Overhead Press",
          muscleGroup: "肩部",
          sets: 3,
          reps: 10,
          load: 40,
        },
        {
          exerciseId: "ex-8",
          exerciseName: "Tricep Pushdown",
          muscleGroup: "手臂",
          sets: 3,
          reps: 12,
          load: 20,
        },
      ]);
      setCoachTips("第一週先熟悉動作，唔好追重量，感受肌肉收縮先係最重要。");
      setPhase("editing");
    }
  }

  async function handleSaveRoutine() {
    if (!selectedClientId || !routineName.trim() || selectedExercises.length === 0 || !user?.id) return;
    setPhase("saving");

    try {
      const result = await api.createRoutine({
        clientId: selectedClientId,
        name: routineName.trim(),
        scheduledDate,
        notes: coachTips.trim() || undefined,
        exercises: selectedExercises.map((item, index) => ({
          exerciseId: item.exerciseId,
          order: index + 1,
          sets: Array.from({ length: item.sets }, (_, i) => ({
            setIndex: i + 1,
            setType: "normal",
            targetWeight: item.load,
            targetReps: item.reps,
          })),
        })),
      });
      setPhase("done");
      onRoutineCreated(result.id);
      window.setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error("Save routine error:", error);
      setPhase("editing");
      window.alert("儲存失敗，請重試");
    }
  }

  function addExercise(item: ExerciseLibraryItem) {
    setSelectedExercises((prev) => [
      ...prev,
      {
        exerciseId: item.id,
        exerciseName: item.name,
        muscleGroup: item.muscleGroup,
        sets: 3,
        reps: 10,
        load: 20,
      },
    ]);
    setExerciseSearch("");
  }

  function updateExercise(
    index: number,
    field: keyof Pick<RoutineExerciseEntry, "sets" | "reps" | "load">,
    value: string,
  ) {
    const parsed = Number.parseInt(value, 10) || 0;
    setSelectedExercises((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: parsed } : item)),
    );
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/45 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={phase === "saving" ? undefined : onClose}
      />

      <div
        className={cn(
          "fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 bg-[#0f172a] flex flex-col",
          "transition-transform duration-300",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={phase === "saving"}
            className="p-2 -ml-2 active:scale-95 transition-transform disabled:opacity-40"
          >
            <X size={20} className="text-slate-400" />
          </button>
          <h3 className="text-slate-100 font-bold">
            {phase === "editing" || phase === "saving" || phase === "done"
              ? "確認課表"
              : "AI 智能排表助手"}
          </h3>
          <div className="w-8" />
        </div>

        {phase === "input" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">學員</label>
              <div className="relative">
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full appearance-none bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                >
                  <option value="" disabled>
                    請選擇學員
                  </option>
                  {clientOptions.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">日期</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">告訴 AI 你的排表要求</label>
              <textarea
                rows={4}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-400 placeholder:text-slate-500"
                placeholder="例如：幫 Amy 安排 Push Day，4 個動作，中等重量增肌"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-400">快捷提示</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setAiPrompt(item.value)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 active:scale-95 transition-transform"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={!aiPrompt.trim() || !selectedClientId}
              className={cn(
                "w-full rounded-[20px] py-3.5 text-sm font-bold active:scale-95 transition-all",
                !aiPrompt.trim() || !selectedClientId
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-blue-500/20 text-blue-300 border border-blue-500/40",
              )}
            >
              生成課表
            </button>
          </div>
        )}

        {phase === "ai_generating" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
            <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center animate-pulse">
              <Sparkles size={32} className="text-blue-400" />
            </div>
            <p className="text-slate-200 font-semibold">AI 排表生成中...</p>
            <p className="text-slate-500 text-sm text-center">
              正在為 {selectedClientName} 設計最適合的訓練課表
            </p>
          </div>
        )}

        {(phase === "editing" || phase === "saving" || phase === "done") && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {phase === "done" ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                  <CheckCircle2 size={34} className="text-emerald-400" />
                </div>
                <p className="text-slate-100 text-lg font-bold">課表已建立</p>
                <p className="text-slate-400 text-sm mt-1">正在返回主頁...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400">課表名稱</label>
                    <input
                      value={routineName}
                      onChange={(e) => setRoutineName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400">日期</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-slate-400">動作列表</p>
                  <div className="space-y-2">
                    {selectedExercises.map((exercise, index) => (
                      <div
                        key={`${exercise.exerciseId}-${index}`}
                        className="bg-slate-800/80 border border-slate-700 rounded-xl p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-100">
                            {index + 1}. {exercise.exerciseName}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedExercises((prev) => prev.filter((_, idx) => idx !== index))
                            }
                            className="text-rose-400 active:scale-95 transition-transform"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{exercise.muscleGroup}</p>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <input
                            value={exercise.sets}
                            onChange={(e) => updateExercise(index, "sets", e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-400"
                          />
                          <input
                            value={exercise.reps}
                            onChange={(e) => updateExercise(index, "reps", e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-400"
                          />
                          <input
                            value={exercise.load}
                            onChange={(e) => updateExercise(index, "load", e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 relative">
                  <label className="text-xs text-slate-400">搜尋並加入動作</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={exerciseSearch}
                      onChange={(e) => setExerciseSearch(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                      placeholder="輸入動作名稱..."
                    />
                  </div>
                  {filteredLibrary.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                      {filteredLibrary.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addExercise(item)}
                          className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 transition-colors"
                        >
                          {item.name} <span className="text-xs text-slate-500">[{item.muscleGroup}]</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">教練備忘 Tips</label>
                  <textarea
                    rows={3}
                    value={coachTips}
                    onChange={(e) => setCoachTips(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveRoutine}
                  disabled={phase === "saving" || !routineName.trim() || selectedExercises.length === 0}
                  className={cn(
                    "w-full rounded-[20px] py-3.5 font-bold text-sm active:scale-95 transition-all",
                    phase === "saving" || !routineName.trim() || selectedExercises.length === 0
                      ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                      : "bg-amber-400/20 text-amber-300 border border-amber-400/40",
                  )}
                >
                  {phase === "saving" ? "儲存中..." : "儲存課表"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
