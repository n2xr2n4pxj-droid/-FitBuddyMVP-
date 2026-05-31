import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api, type PlanDetail, type PlanSummary } from "@/lib/api";
import PlanEditorModal from "@/components/plans/PlanEditorModal";

interface TrainerPlansManagerProps {
  defaultClientId: string;
  onBack?: () => void;
}

export default function TrainerPlansManager({ defaultClientId, onBack }: TrainerPlansManagerProps) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editPlan, setEditPlan] = useState<PlanDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlanSummary | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getAvailablePlans();
      setPlans(list);
    } catch {
      toast({
        variant: "destructive",
        title: "載入失敗",
        description: "無法載入課表庫，請稍後再試。",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const openCreate = () => {
    setEditPlan(null);
    setEditorMode("create");
    setEditorOpen(true);
  };

  const openEdit = async (summary: PlanSummary) => {
    try {
      const detail = await api.getPlanDetail(summary.id);
      setEditPlan(detail);
      setEditorMode("edit");
      setEditorOpen(true);
    } catch {
      toast({
        variant: "destructive",
        title: "載入失敗",
        description: "無法載入課表內容。",
      });
    }
  };

  const handleSaved = (_plan: PlanDetail) => {
    void loadPlans();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await api.deletePlan(deleteTarget.id);
      setPlans((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast({ title: "已刪除", description: `《${deleteTarget.name}》已從課表庫移除。` });
      setDeleteTarget(null);
    } catch {
      toast({
        variant: "destructive",
        title: "刪除失敗",
        description: "請稍後再試。",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 text-neutral-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-1 px-2 text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
          ) : null}
          <h2 className="text-lg font-semibold tracking-tight">我的課表庫</h2>
        </div>
        <Button type="button" size="sm" className="gap-1 bg-blue-600 hover:bg-blue-600/90" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新增課表
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="border-neutral-800 bg-neutral-950/80">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4 bg-neutral-800" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-1/2 bg-neutral-800" />
                <Skeleton className="h-9 w-full bg-neutral-800" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-400">
          還沒有課表，點擊「新增課表」開始建立
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className="border-neutral-800 bg-neutral-950/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-base leading-snug text-neutral-100">{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-neutral-400">
                  {p.exerciseCount} 個動作 · 已指派 {p.assignedLearnerCount ?? 0} 人
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
                    onClick={() => void openEdit(p)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    編輯
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive gap-1 border-rose-500/40 bg-neutral-900 hover:bg-rose-500/10"
                    onClick={() => setDeleteTarget(p)}
                    disabled={deletingId === p.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    刪除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PlanEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        mode={editorMode}
        plan={editPlan ?? undefined}
        defaultClientId={defaultClientId}
        onSaved={handleSaved}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定刪除？</AlertDialogTitle>
            <AlertDialogDescription>
              確定刪除《{deleteTarget?.name ?? ""}》？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
