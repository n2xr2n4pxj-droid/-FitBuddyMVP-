import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { api, type PlanSummary } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface TrainerAssignPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  learnerId: string | null;
  learnerName?: string;
}

export default function TrainerAssignPlanModal({
  open,
  onOpenChange,
  learnerId,
  learnerName,
}: TrainerAssignPlanModalProps) {
  const { toast } = useToast();

  const [availablePlans, setAvailablePlans] = useState<PlanSummary[]>([]);
  const [assignedRoutineIds, setAssignedRoutineIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isActionLoadingRoutineId, setIsActionLoadingRoutineId] = useState<string | null>(null);

  const learnerLabel = useMemo(() => learnerName ?? "該學員", [learnerName]);

  useEffect(() => {
    if (!open) return;
    if (!learnerId) return;

    let active = true;
    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [plans, assigned] = await Promise.all([
          api.getAvailablePlans(),
          api.getAssignedRoutineIdsForLearner(learnerId),
        ]);

        if (!active) return;
        setAvailablePlans(plans);
        setAssignedRoutineIds(new Set(assigned));
      } catch (err: any) {
        if (!active) return;
        const statusCode = err?.statusCode;
        if (statusCode === 403) setErrorMessage("你沒有權限檢視/指派此學員的計劃。");
        else setErrorMessage("載入計劃失敗，請稍後再試。");
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [open, learnerId]);

  const isAssigned = (routineId: string) => assignedRoutineIds.has(routineId);

  const refreshAssigned = async (currentLearnerId: string) => {
    const assigned = await api.getAssignedRoutineIdsForLearner(currentLearnerId);
    setAssignedRoutineIds(new Set(assigned));
  };

  const handleAssign = async (routineId: string) => {
    if (!learnerId) return;
    setIsActionLoadingRoutineId(routineId);
    try {
      await api.assignPlan(routineId, learnerId, undefined);
      await refreshAssigned(learnerId);
      toast({
        title: "指派完成",
        description: "此訓練計劃已成功指派。",
      });
    } catch (err: any) {
      const statusCode = err?.statusCode;
      if (statusCode === 403) {
        setErrorMessage("你沒有權限指派此學員。");
      } else {
        setErrorMessage("指派失敗，請稍後再試。");
      }
    } finally {
      setIsActionLoadingRoutineId(null);
    }
  };

  const handleUnassign = async (routineId: string) => {
    if (!learnerId) return;
    setIsActionLoadingRoutineId(routineId);
    try {
      await api.unassignPlan(learnerId, routineId);
      await refreshAssigned(learnerId);
      toast({
        title: "已取消指派",
        description: "此訓練計劃已成功取消指派。",
      });
    } catch (err: any) {
      const statusCode = err?.statusCode;
      if (statusCode === 403) {
        setErrorMessage("你沒有權限取消此指派。");
      } else {
        setErrorMessage("取消指派失敗，請稍後再試。");
      }
    } finally {
      setIsActionLoadingRoutineId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md bg-neutral-950 border border-neutral-800 text-neutral-100 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-bold">訓練計劃指派</h2>
            <p className="text-xs text-neutral-400 mt-1">
              指派給：{learnerLabel}
            </p>
          </div>
          <span className="text-[10px] text-blue-300 bg-neutral-800 rounded-full px-3 py-1 shrink-0">
            TRAINER
          </span>
        </div>

        {errorMessage && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 flex items-start gap-2 mb-3">
            <AlertCircle size={16} className="text-rose-300 mt-0.5 shrink-0" />
            <p className="text-sm text-rose-200">{errorMessage}</p>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="h-20 rounded-2xl bg-neutral-900/60 border border-neutral-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {availablePlans.length === 0 ? (
              <p className="text-sm text-neutral-400">目前沒有可指派的訓練計劃。</p>
            ) : (
              availablePlans.map((plan) => {
                const assigned = isAssigned(plan.id);
                const busy = isActionLoadingRoutineId === plan.id;

                return (
                  <div
                    key={plan.id}
                    className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-neutral-100 truncate">
                        {plan.name || "未命名計劃"}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">{plan.exerciseCount} 個動作</p>
                      <div className="flex items-center gap-2 mt-2">
                        {assigned ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                            <Check size={12} />
                            已指派
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-400">
                            未指派
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {assigned ? (
                        <button
                          type="button"
                          onClick={() => handleUnassign(plan.id)}
                          disabled={busy}
                          className="rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-200 active:scale-95 transition-transform disabled:opacity-60"
                        >
                          {busy ? "處理中..." : "取消指派"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAssign(plan.id)}
                          disabled={busy}
                          className="rounded-xl bg-blue-600 hover:bg-blue-500 border border-blue-500/20 px-3 py-2 text-xs font-semibold text-white active:scale-95 transition-transform disabled:opacity-60"
                        >
                          {busy ? "處理中..." : "指派"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

