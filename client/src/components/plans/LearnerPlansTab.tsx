import React, { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { api, type PlanSummary } from "@/lib/api";
import PlanDetailModal from "@/components/plans/PlanDetailModal";

interface LearnerPlansTabProps {
  onStartWorkout?: (routineId: string) => void;
  onOpenWorkoutTab?: () => void;
}

export default function LearnerPlansTab({
  onStartWorkout,
  onOpenWorkoutTab,
}: LearnerPlansTabProps) {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setErrorMessage(null);

    (async () => {
      try {
        const result = await api.getMyPlans();
        if (!active) return;
        setPlans(result);
      } catch (err: any) {
        if (!active) return;
        const statusCode = err?.statusCode;
        if (statusCode === 403) setErrorMessage("你沒有權限檢視自己的訓練計劃。");
        else setErrorMessage("載入訓練計劃失敗，請稍後再試。");
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handlePreview = (routineId: string) => {
    setSelectedRoutineId(routineId);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-neutral-100">我的訓練計劃</h3>
        <span className="text-[10px] text-neutral-500">{plans.length} 個</span>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 flex items-start gap-2">
          <AlertCircle size={16} className="text-rose-300 mt-0.5 shrink-0" />
          <p className="text-sm text-rose-200">{errorMessage}</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="h-20 rounded-2xl bg-neutral-900/60 border border-neutral-800 animate-pulse"
            />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-400">
          目前沒有訓練計劃
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-3 flex items-start justify-between gap-3"
            >
              <div>
                <p className="text-sm font-bold text-neutral-100">{plan.name || "未命名計劃"}</p>
                <p className="text-xs text-neutral-500 mt-1">{plan.exerciseCount} 個動作</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {plan.isOwn && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800/60 border border-neutral-700 text-neutral-300">
                      自建
                    </span>
                  )}
                  {!plan.isOwn && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">
                      由 {plan.trainerName ?? "教練"} 指派
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handlePreview(plan.id)}
                className="shrink-0 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3 py-2 text-xs font-semibold text-blue-300 active:scale-95 transition-transform"
              >
                預覽
              </button>
            </div>
          ))}
        </div>
      )}

      <PlanDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        routineId={selectedRoutineId}
        title="計劃詳情"
        onStartWorkout={onStartWorkout}
        onOpenWorkoutTab={onOpenWorkoutTab}
      />
    </div>
  );
}

