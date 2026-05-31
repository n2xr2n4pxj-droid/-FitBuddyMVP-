import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, Clock } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { api, type PlanDetail } from "@/lib/api";

interface PlanDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routineId: string | null;
  title?: string;
  onStartWorkout?: (routineId: string) => void;
  onOpenWorkoutTab?: () => void;
}

export default function PlanDetailModal({
  open,
  onOpenChange,
  routineId,
  title,
  onStartWorkout,
  onOpenWorkoutTab,
}: PlanDetailModalProps) {
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const computedTitle = useMemo(() => title ?? "訓練計劃詳情", [title]);

  useEffect(() => {
    if (!open) return;
    if (!routineId) return;

    let active = true;
    setIsLoading(true);
    setErrorMessage(null);
    setDetail(null);
    setExpanded({});

    (async () => {
      try {
        const d = await api.getPlanDetail(routineId);
        if (!active) return;
        setDetail(d);
        const initExpanded: Record<string, boolean> = {};
        for (const ex of d.exercises) initExpanded[ex.id] = true;
        setExpanded(initExpanded);
      } catch (err: any) {
        if (!active) return;
        const statusCode = err?.statusCode;
        if (statusCode === 403) setErrorMessage("你沒有權限檢視這個計劃。");
        else setErrorMessage("載入計劃詳情失敗，請稍後再試。");
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, routineId]);

  const handleToggleExercise = (exerciseId: string) => {
    setExpanded((prev) => ({ ...prev, [exerciseId]: !prev[exerciseId] }));
  };

  const estimatedMinutes = useMemo(() => {
    if (!detail) return 0;
    return (detail.exerciseCount ?? detail.exercises.length ?? 0) * 8;
  }, [detail]);

  const handleStartWorkout = () => {
    if (!detail) return;
    if (!onStartWorkout) return;
    onOpenWorkoutTab?.();
    onStartWorkout?.(detail.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md !p-0 !gap-0 !left-1/2 !top-auto !translate-x-[-50%] !translate-y-0 !bottom-0 rounded-t-3xl rounded-b-none flex flex-col bg-neutral-950 border border-neutral-800 text-neutral-100 max-h-[85vh] pb-[env(safe-area-inset-bottom)] overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-neutral-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">{computedTitle}</h2>
          </div>

          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Clock size={18} className="text-blue-300" />
            </div>
            <div>
              <p className="text-xs text-neutral-400 font-medium">預估時長</p>
              <p className="text-sm font-bold">
                約 {estimatedMinutes} 分鐘
              </p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="px-4 pt-3">
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 flex items-start gap-2">
              <AlertCircle size={16} className="text-rose-300 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-200">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  className="h-12 rounded-xl bg-neutral-900/60 border border-neutral-800 animate-pulse"
                />
              ))}
            </div>
          ) : !detail ? (
            <div className="text-sm text-neutral-400 py-2">請稍候...</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900/60 border border-neutral-800 text-neutral-300">
                  {detail.isOwn ? "自建計劃" : "由教練指派"}
                </span>
                {detail.assignedAt && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900/60 border border-neutral-800 text-neutral-400">
                    指派時間：{new Date(detail.assignedAt).toLocaleString("zh-HK", { month: "numeric", day: "numeric" })}
                  </span>
                )}
              </div>

              {detail.notes && detail.notes.trim().length > 0 && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-3 py-2">
                  <p className="text-xs text-neutral-300 whitespace-pre-wrap">{detail.notes}</p>
                </div>
              )}

              {detail.exercises.map((exercise, index) => {
                const isExpanded = !!expanded[exercise.id];
                return (
                  <div
                    key={exercise.id}
                    className="rounded-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleExercise(exercise.id)}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-neutral-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-100">
                          動作 {index + 1}: {exercise.exerciseName}
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          休息 {exercise.restTimerSeconds}s
                        </span>
                      </div>
                      <ChevronDown
                        size={16}
                        className={
                          isExpanded ? "rotate-180 transition-transform" : "transition-transform"
                        }
                      />
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-1.5">
                        {exercise.sets.map((set) => (
                          <div
                            key={set.id}
                            className="flex items-center justify-between text-xs text-neutral-300"
                          >
                            <span>
                              #{set.setIndex} · {set.weight ?? "-"} kg × {set.reps ?? "-"} reps
                            </span>
                            <span className="text-[10px] text-neutral-500">
                              {set.setType ? `(${set.setType})` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-neutral-800 bg-neutral-950/95 px-4 py-3">
          <button
            type="button"
            onClick={handleStartWorkout}
            disabled={!detail || isLoading || !onStartWorkout}
            className="w-full inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/60 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            開始此訓練
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

