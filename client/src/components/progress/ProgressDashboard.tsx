import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, Plus } from "lucide-react";
import { api, type BodyCompositionLog, type WorkoutVolumeWeek } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  bodyLogsToSparkRows,
  BodyCompositionMetricChartsGrid,
} from "@/components/progress/BodyCompositionMetricCharts";

export interface ProgressDashboardProps {
  targetUserId: string;
  /** 教練檢視時顯示於頂部 */
  viewerTitle?: string;
  onBack?: () => void;
  variant?: "learner" | "coach";
}

type BodyRange = "30" | "90" | "all";

export default function ProgressDashboard({
  targetUserId,
  viewerTitle,
  onBack,
  variant = "learner",
}: ProgressDashboardProps) {
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState("body");
  const [bodyRange, setBodyRange] = useState<BodyRange>("90");
  const [volumeWeeks, setVolumeWeeks] = useState<8 | 16>(8);
  const [bodyLogs, setBodyLogs] = useState<BodyCompositionLog[]>([]);
  const [volumeData, setVolumeData] = useState<WorkoutVolumeWeek[]>([]);
  const [loadingBody, setLoadingBody] = useState(true);
  const [loadingVol, setLoadingVol] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    measuredAt: new Date().toISOString().slice(0, 16),
    weight: "",
    bodyFatPct: "",
    muscleMass: "",
    visceralFat: "",
    bmi: "",
    notes: "",
  });

  const isCoachShell = variant === "coach";

  const bodyQuery = useMemo(() => {
    const to = new Date();
    const from = new Date();
    if (bodyRange === "30") {
      from.setUTCDate(from.getUTCDate() - 30);
    } else if (bodyRange === "90") {
      from.setUTCDate(from.getUTCDate() - 90);
    } else {
      from.setFullYear(2000, 0, 1);
    }
    return { from: from.toISOString(), to: to.toISOString() };
  }, [bodyRange]);

  const loadBody = useCallback(async () => {
    if (!targetUserId) return;
    setLoadingBody(true);
    try {
      const rows = await api.getBodyComposition(targetUserId, bodyQuery.from, bodyQuery.to);
      setBodyLogs(rows);
    } catch {
      toast({ title: "載入體態紀錄失敗", variant: "destructive" });
    } finally {
      setLoadingBody(false);
    }
  }, [targetUserId, bodyQuery.from, bodyQuery.to, toast]);

  const loadVolume = useCallback(async () => {
    if (!targetUserId) return;
    setLoadingVol(true);
    try {
      const rows = await api.getWorkoutVolume(targetUserId, volumeWeeks);
      setVolumeData(rows);
    } catch {
      toast({ title: "載入訓練量失敗", variant: "destructive" });
    } finally {
      setLoadingVol(false);
    }
  }, [targetUserId, volumeWeeks, toast]);

  useEffect(() => {
    void loadBody();
  }, [loadBody]);

  useEffect(() => {
    void loadVolume();
  }, [loadVolume]);

  const chartBodyData = useMemo(() => bodyLogsToSparkRows(bodyLogs), [bodyLogs]);

  const submitBody = async () => {
    const w = parseFloat(form.weight);
    if (!Number.isFinite(w)) {
      toast({ title: "請填寫有效體重", variant: "destructive" });
      return;
    }
    const measuredAt = new Date(form.measuredAt);
    if (Number.isNaN(measuredAt.getTime())) {
      toast({ title: "量測時間無效", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.addBodyComposition({
        userId: targetUserId,
        measuredAt: measuredAt.toISOString(),
        weight: w,
        bodyFatPct: form.bodyFatPct ? parseFloat(form.bodyFatPct) : null,
        muscleMass: form.muscleMass ? parseFloat(form.muscleMass) : null,
        visceralFat: form.visceralFat ? parseInt(form.visceralFat, 10) : null,
        bmi: form.bmi ? parseFloat(form.bmi) : null,
        notes: form.notes || null,
      });
      toast({ title: "已新增體態紀錄" });
      setDialogOpen(false);
      setForm((f) => ({
        ...f,
        weight: "",
        bodyFatPct: "",
        muscleMass: "",
        visceralFat: "",
        bmi: "",
        notes: "",
      }));
      void loadBody();
    } catch {
      toast({ title: "新增失敗", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const cardClass = isCoachShell
    ? "rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-slate-100"
    : "rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm";

  const muted = isCoachShell ? "text-slate-400" : "text-gray-500";

  return (
    <div className={cn("min-h-screen pb-24", isCoachShell ? "bg-[#0f172a]" : "bg-gray-50")}>
      <div className="px-4 pt-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className={cn(
              "mb-3 flex items-center gap-2 text-sm font-medium",
              isCoachShell ? "text-slate-300" : "text-gray-700",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
        ) : null}
        {viewerTitle ? (
          <h1 className={cn("mb-2 text-lg font-bold", isCoachShell ? "text-white" : "text-gray-900")}>
            {viewerTitle} · 進度
          </h1>
        ) : null}

        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList
            className={cn(
              "grid w-full grid-cols-2",
              isCoachShell ? "bg-slate-800" : "",
            )}
          >
            <TabsTrigger value="body">體態趨勢</TabsTrigger>
            <TabsTrigger value="volume">訓練量</TabsTrigger>
          </TabsList>

          <TabsContent value="body" className="mt-4 space-y-3">
            <div className={cn("flex flex-wrap items-center gap-2", cardClass)}>
              <span className={cn("text-xs", muted)}>範圍</span>
              {(["30", "90", "all"] as BodyRange[]).map((r) => (
                <Button
                  key={r}
                  type="button"
                  size="sm"
                  variant={bodyRange === r ? "default" : "secondary"}
                  onClick={() => setBodyRange(r)}
                >
                  {r === "30" ? "30 天" : r === "90" ? "90 天" : "全部"}
                </Button>
              ))}
              <Button type="button" size="sm" className="ml-auto gap-1" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                新增記錄
              </Button>
            </div>

            <div className={cardClass}>
              {loadingBody ? (
                <div className="grid gap-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-[168px] animate-pulse rounded-xl",
                        isCoachShell ? "bg-slate-800" : "bg-gray-100",
                      )}
                    />
                  ))}
                </div>
              ) : chartBodyData.length === 0 ? (
                <p className={cn("py-12 text-center text-sm", muted)}>
                  尚無體態記錄，點擊「新增記錄」建立第一筆
                </p>
              ) : (
                <BodyCompositionMetricChartsGrid
                  data={chartBodyData}
                  size="expanded"
                  shell={isCoachShell ? "coach" : "learner"}
                  remountKey={`body-${bodyRange}-${mainTab}`}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="volume" className="mt-4 space-y-3">
            <div className={cn("flex flex-wrap gap-2", cardClass)}>
              <span className={cn("text-xs self-center", muted)}>週數</span>
              <Button
                type="button"
                size="sm"
                variant={volumeWeeks === 8 ? "default" : "secondary"}
                onClick={() => setVolumeWeeks(8)}
              >
                8 週
              </Button>
              <Button
                type="button"
                size="sm"
                variant={volumeWeeks === 16 ? "default" : "secondary"}
                onClick={() => setVolumeWeeks(16)}
              >
                16 週
              </Button>
            </div>

            <div className={cardClass}>
              {loadingVol ? (
                <div className={cn("h-[300px] animate-pulse rounded-xl", isCoachShell ? "bg-slate-800" : "bg-gray-100")} />
              ) : volumeData.length === 0 ? (
                <p className={cn("py-12 text-center text-sm", muted)}>此期間尚無完成訓練紀錄</p>
              ) : (
                <div key={`vol-chart-${volumeWeeks}-${mainTab}`} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={volumeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isCoachShell ? "#334155" : "#e5e7eb"} />
                      <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: isCoachShell ? "#94a3b8" : "#64748b" }} />
                      <YAxis tick={{ fontSize: 11, fill: isCoachShell ? "#94a3b8" : "#64748b" }} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const row = payload[0]?.payload as WorkoutVolumeWeek;
                          return (
                            <div
                              className={cn(
                                "rounded-lg border px-3 py-2 text-sm shadow-md",
                                isCoachShell
                                  ? "border-slate-600 bg-slate-800 text-slate-100"
                                  : "border-gray-200 bg-white text-gray-900",
                              )}
                            >
                              <p className="font-medium">{label}</p>
                              <p>完成訓練：{row?.sessionCount ?? 0} 次</p>
                              <p>總組數：{row?.totalSets ?? 0}</p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="sessionCount" name="完成訓練" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={cn(isCoachShell && "border-slate-700 bg-slate-900 text-slate-100")}>
          <DialogHeader>
            <DialogTitle>新增 InBody／體態記錄</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">量測時間</p>
              <Input
                type="datetime-local"
                value={form.measuredAt}
                onChange={(e) => setForm((f) => ({ ...f, measuredAt: e.target.value }))}
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">體重 (kg) *</p>
              <Input
                value={form.weight}
                onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
                placeholder="68.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">體脂率 (%)</p>
                <Input
                  value={form.bodyFatPct}
                  onChange={(e) => setForm((f) => ({ ...f, bodyFatPct: e.target.value }))}
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">肌肉量 (kg)</p>
                <Input
                  value={form.muscleMass}
                  onChange={(e) => setForm((f) => ({ ...f, muscleMass: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">內臟脂肪等級</p>
                <Input
                  value={form.visceralFat}
                  onChange={(e) => setForm((f) => ({ ...f, visceralFat: e.target.value }))}
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">BMI</p>
                <Input value={form.bmi} onChange={(e) => setForm((f) => ({ ...f, bmi: e.target.value }))} />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">備註</p>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={() => void submitBody()} disabled={saving}>
              {saving ? "儲存中…" : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
