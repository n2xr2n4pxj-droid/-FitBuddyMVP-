import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api, type PlanDetail } from "@/lib/api";

export type EditorSetRow = {
  id?: string;
  setIndex: number;
  setType: string;
  targetWeight: string;
  targetReps: string;
  targetRpe: string;
};

export type EditorExerciseRow = {
  key: string;
  routineExerciseId?: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  sets: EditorSetRow[];
};

function newKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptySet(si: number): EditorSetRow {
  return {
    setIndex: si,
    setType: "normal",
    targetWeight: "",
    targetReps: "",
    targetRpe: "",
  };
}

function planToRows(plan: PlanDetail): EditorExerciseRow[] {
  return plan.exercises.map((ex) => ({
    key: ex.id,
    routineExerciseId: ex.id,
    exerciseId: ex.exerciseId,
    exerciseName: ex.exerciseName,
    order: ex.order,
    sets: ex.sets.map((s, i) => ({
      id: s.id,
      setIndex: s.setIndex ?? i + 1,
      setType: s.setType ?? "normal",
      targetWeight: s.weight != null ? String(s.weight) : "",
      targetReps: s.reps != null ? String(s.reps) : "",
      targetRpe: s.targetRpe != null ? String(s.targetRpe) : "",
    })),
  }));
}

function ExerciseEditorItem({
  row,
  index,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  removeExerciseOpen,
  setRemoveExerciseOpen,
}: {
  row: EditorExerciseRow;
  index: number;
  onChange: (next: EditorExerciseRow) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  removeExerciseOpen: boolean;
  setRemoveExerciseOpen: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(true);

  const updateSets = (sets: EditorSetRow[]) => {
    onChange({ ...row, sets: sets.map((s, i) => ({ ...s, setIndex: i + 1 })) });
  };

  const addSet = () => {
    updateSets([...row.sets, emptySet(row.sets.length + 1)]);
  };

  const removeSet = (si: number) => {
    const next = row.sets.filter((_, j) => j !== si);
    updateSets(next.length ? next : [emptySet(1)]);
  };

  const patchSet = (si: number, patch: Partial<EditorSetRow>) => {
    const next = row.sets.map((s, j) => (j === si ? { ...s, ...patch } : s));
    onChange({ ...row, sets: next });
  };

  return (
    <div className="rounded-lg border border-border bg-card/50">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 p-3">
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center">
            <span className="text-muted-foreground w-8 shrink-0 text-sm">#{index + 1}</span>
            <Input
              placeholder="動作名稱（必填）"
              value={row.exerciseName}
              onChange={(e) => onChange({ ...row, exerciseName: e.target.value })}
              className="flex-1"
            />
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!canMoveUp}
              onClick={onMoveUp}
              aria-label="上移"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!canMoveDown}
              onClick={onMoveDown}
              aria-label="下移"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive h-8 w-8"
              onClick={() => setRemoveExerciseOpen(true)}
              aria-label="刪除動作"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CollapsibleContent>
          <div className="space-y-2 border-t border-border px-3 pb-3 pt-2">
            {row.sets.map((set, si) => (
              <div
                key={set.id ?? `new-${si}`}
                className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:items-end"
              >
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-xs">組 {si + 1}</Label>
                  <Input
                    className="mt-1"
                    placeholder="重量"
                    type="number"
                    value={set.targetWeight}
                    onChange={(e) => patchSet(si, { targetWeight: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">次數</Label>
                  <Input
                    className="mt-1"
                    placeholder="次數"
                    type="number"
                    value={set.targetReps}
                    onChange={(e) => patchSet(si, { targetReps: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">RPE</Label>
                  <Input
                    className="mt-1"
                    placeholder="選填"
                    type="number"
                    value={set.targetRpe}
                    onChange={(e) => patchSet(si, { targetRpe: e.target.value })}
                  />
                </div>
                <div className="col-span-2 flex gap-2 sm:col-span-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-6"
                    onClick={() => removeSet(si)}
                  >
                    刪除此組
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" className="w-full" onClick={addSet}>
              ＋ 新增一組
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog open={removeExerciseOpen} onOpenChange={setRemoveExerciseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除此動作？</AlertDialogTitle>
            <AlertDialogDescription>將一併移除該動作下所有組數設定。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onRemove();
                setRemoveExerciseOpen(false);
              }}
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export interface PlanEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  plan?: PlanDetail | null;
  defaultClientId: string;
  onSaved: (plan: PlanDetail) => void;
}

export default function PlanEditorModal({
  open,
  onOpenChange,
  mode,
  plan,
  defaultClientId,
  onSaved,
}: PlanEditorModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<EditorExerciseRow[]>([]);
  const [deletedExerciseIds, setDeletedExerciseIds] = useState<string[]>([]);
  const [deletedSetIds, setDeletedSetIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removeKey, setRemoveKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMessage(null);
    setDeletedExerciseIds([]);
    setDeletedSetIds([]);
    if (mode === "edit" && plan) {
      setName(plan.name);
      setNotes(plan.notes ?? "");
      setRows(planToRows(plan));
    } else {
      setName("");
      setNotes("");
      setRows([
        {
          key: newKey(),
          exerciseId: "",
          exerciseName: "",
          order: 1,
          sets: [emptySet(1)],
        },
      ]);
    }
  }, [open, mode, plan]);

  const reorderRows = (next: EditorExerciseRow[]) =>
    next.map((r, i) => ({ ...r, order: i + 1 }));

  const moveRow = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= rows.length) return;
    const copy = [...rows];
    const t = copy[index];
    copy[index] = copy[j];
    copy[j] = t;
    setRows(reorderRows(copy));
  };

  const updateRow = (key: string, next: EditorExerciseRow) => {
    setRows((prev) => prev.map((r) => (r.key === key ? next : r)));
  };

  const removeRow = (key: string) => {
    const target = rows.find((r) => r.key === key);
    if (target?.routineExerciseId) {
      setDeletedExerciseIds((d) => [...d, target.routineExerciseId!]);
      const setIds = target.sets.map((s) => s.id).filter(Boolean) as string[];
      if (setIds.length) setDeletedSetIds((d) => [...d, ...setIds]);
    } else {
      const setIds = target?.sets.map((s) => s.id).filter(Boolean) as string[];
      if (setIds.length) setDeletedSetIds((d) => [...d, ...setIds]);
    }
    setRows((prev) => reorderRows(prev.filter((r) => r.key !== key)));
  };

  const addExercise = () => {
    setRows((prev) =>
      reorderRows([
        ...prev,
        {
          key: newKey(),
          exerciseId: "",
          exerciseName: "",
          order: prev.length + 1,
          sets: [emptySet(1)],
        },
      ]),
    );
  };

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (rows.length === 0) return false;
    if (mode === "create" && !defaultClientId.trim()) return false;
    for (const r of rows) {
      if (!r.exerciseName.trim()) return false;
      if (r.sets.length === 0) return false;
    }
    return true;
  }, [name, rows, mode, defaultClientId]);

  const buildPayloadSets = (sets: EditorSetRow[]) =>
    sets.map((s, si) => ({
      id: s.id,
      setIndex: si + 1,
      setType: s.setType || "normal",
      targetWeight: s.targetWeight === "" ? null : Number(s.targetWeight),
      targetReps: s.targetReps === "" ? null : Number(s.targetReps),
      targetRpe: s.targetRpe === "" ? null : Number(s.targetRpe),
    }));

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      if (mode === "create") {
        const created = await api.createRoutine({
          clientId: defaultClientId.trim(),
          name: name.trim(),
          notes: notes.trim() || null,
          exercises: rows.map((r, i) => ({
            exerciseId: r.exerciseId.trim() || undefined,
            exerciseName: r.exerciseName.trim(),
            order: i + 1,
            restTimerSeconds: 90,
            sets: buildPayloadSets(r.sets).map(({ id: _id, ...rest }) => rest),
          })),
        });
        const detail = await api.getPlanDetail(created.id);
        toast({ title: "課表已儲存", description: "✅ 課表已儲存" });
        onSaved(detail);
        onOpenChange(false);
      } else if (plan) {
        const updated = await api.updatePlan(plan.id, {
          name: name.trim(),
          notes: notes.trim() || null,
          deletedExerciseIds: deletedExerciseIds.length ? deletedExerciseIds : undefined,
          deletedSetIds: deletedSetIds.length ? deletedSetIds : undefined,
          exercises: rows.map((r, i) => ({
            id: r.routineExerciseId,
            exerciseId: r.exerciseId.trim() || undefined,
            exerciseName: r.exerciseName.trim(),
            order: i + 1,
            restTimerSeconds: 90,
            sets: buildPayloadSets(r.sets),
          })),
        });
        toast({ title: "課表已儲存", description: "✅ 課表已儲存" });
        onSaved(updated);
        onOpenChange(false);
      }
    } catch (e: any) {
      const msg =
        typeof e?.message === "string" ? e.message : "儲存失敗，請稍後再試。";
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const validationHint = useMemo(() => {
    if (!name.trim()) return "請填寫課表名稱";
    if (mode === "create" && !defaultClientId.trim()) return "請先選擇一位學員（用於建立課表）";
    if (rows.length === 0) return "至少新增一個動作";
    if (rows.some((r) => !r.exerciseName.trim())) return "每個動作需有名稱";
    if (rows.some((r) => r.sets.length === 0)) return "每個動作至少一組";
    return null;
  }, [name, rows, mode, defaultClientId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-4 py-3 pr-12">
          <DialogTitle>{mode === "create" ? "新增課表" : "編輯課表"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="plan-name">課表名稱</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：上肢日"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-notes">備註（最多 200 字）</Label>
            <Textarea
              id="plan-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 200))}
              placeholder="選填"
              rows={3}
            />
            <p className="text-muted-foreground text-xs">{notes.length}/200</p>
          </div>

          {errorMessage ? (
            <div className="text-destructive flex items-start gap-2 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <div className="space-y-3">
            <Label>動作</Label>
            {rows.map((row, index) => (
              <ExerciseEditorItem
                key={row.key}
                row={row}
                index={index}
                onChange={(next) => updateRow(row.key, next)}
                onRemove={() => removeRow(row.key)}
                onMoveUp={() => moveRow(index, -1)}
                onMoveDown={() => moveRow(index, 1)}
                canMoveUp={index > 0}
                canMoveDown={index < rows.length - 1}
                removeExerciseOpen={removeKey === row.key}
                setRemoveExerciseOpen={(v) => setRemoveKey(v ? row.key : null)}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-border bg-background px-4 py-3">
          {validationHint && !canSave ? (
            <p className="text-muted-foreground mb-2 text-center text-xs">{validationHint}</p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" size="sm" onClick={addExercise}>
              ＋ 新增動作
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canSave || saving}
              onClick={handleSave}
              className="min-w-[120px]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  儲存中…
                </>
              ) : (
                "儲存課表"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
