import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Dumbbell,
  MessageSquare,
  PlayCircle,
  TrendingUp,
} from "lucide-react";
import { api, type LearnerDashboardOverview } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface DashboardActions {
  onStartWorkout: (routineId?: string) => void;
  onOpenWorkoutTab: () => void;
  onOpenPlansTab: () => void;
  onOpenProgress?: () => void;
  onOpenSessionDetail: (sessionId: string) => void;
}

interface LearnerDashboardProps {
  actions: DashboardActions;
}

function formatHeaderDate(value: Date): string {
  const month = value.toLocaleDateString("zh-HK", { month: "numeric" });
  const day = value.toLocaleDateString("zh-HK", { day: "numeric" });
  const weekday = value.toLocaleDateString("zh-HK", { weekday: "short" });
  return `${month}月${day}日（${weekday}）`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-HK", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function LearnerDashboard({ actions }: LearnerDashboardProps) {
  const { user } = useAuth();
  const isCoachAccount = user?.role === "COACH";

  const [overview, setOverview] = useState<LearnerDashboardOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!user) {
      return () => {
        active = false;
      };
    }

    if (isCoachAccount) {
      setOverview(null);
      setError(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await api.getLearnerDashboardOverview();
        if (!active) return;
        setOverview(result);
      } catch (err: unknown) {
        if (!active) return;
        const msg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "載入今日總覽失敗，請稍後再試。";
        setError(msg);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user, isCoachAccount]);

  const headerDate = useMemo(() => formatHeaderDate(new Date()), []);
  const activePlan = overview?.activePlanPreview;
  const latestSession = overview?.latestSession;
  const latestCoachFeedback = overview?.latestCoachFeedback;

  const estimatedMinutes =
    activePlan?.exerciseCount != null ? activePlan.exerciseCount * 8 : 0;

  return (
    <div className="min-h-screen bg-neutral-950 pb-24 text-neutral-100">
      <div className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <p className="text-xs text-neutral-400">{headerDate}</p>
          <h1 className="text-sm font-semibold">今日總覽</h1>
          <div className="flex items-center gap-1 rounded-full bg-neutral-800 px-2 py-1 text-[10px] text-blue-300">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            學員視角
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-4">
        {isCoachAccount && !loading ? (
          <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
            你正以<strong className="font-semibold">教練帳號</strong>
            預覽「學員視角」。個人化今日總覽僅在學員帳號登入時載入；預覽模式不會向後端索取該資料。若要查看真實學員數據，請改用學員帳號登入。
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        ) : null}

        {isCoachAccount && !loading ? (
          <button
            type="button"
            onClick={actions.onOpenWorkoutTab}
            className="group flex w-full items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-left transition-colors hover:bg-neutral-900"
          >
            <div>
              <p className="text-sm font-semibold text-white">前往訓練紀錄</p>
              <p className="mt-1 text-xs text-neutral-400">預覽模式下仍可瀏覽訓練相關分頁</p>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : null}

        {!isCoachAccount && loading ? (
          <>
            <div className="h-44 animate-pulse rounded-[28px] border border-neutral-800 bg-neutral-900" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-48 animate-pulse rounded-[24px] bg-neutral-900" />
              <div className="h-48 animate-pulse rounded-r-[24px] rounded-l-lg bg-neutral-900" />
            </div>
            <div className="h-20 animate-pulse rounded-2xl bg-neutral-900" />
          </>
        ) : !isCoachAccount ? (
          <>
            <section className="relative overflow-hidden rounded-[28px] border border-blue-500/30 bg-gradient-to-br from-blue-600/20 via-neutral-900 to-neutral-900 p-4">
              <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-blue-500/10 blur-[50px]" />
              <div className="relative space-y-3">
                <div>
                  <p className="text-xs text-blue-200">目前訓練計劃</p>
                  {activePlan ? (
                    <>
                      <h2 className="mt-1 text-xl font-black text-white">
                        {activePlan.name}
                      </h2>
                      <div className="mt-2 inline-flex rounded-full border border-blue-400/40 bg-blue-500/15 px-2 py-1 text-[10px] text-blue-200">
                        由 {activePlan.assignedBy || "教練"} 指派
                      </div>
                      <p className="mt-2 text-xs text-neutral-300">
                        {activePlan.exerciseCount} 個動作 · 約 {estimatedMinutes} 分鐘
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="mt-1 text-base font-bold text-neutral-100">
                        暫未有指定課表
                      </h2>
                      <p className="mt-1 text-xs text-neutral-400">請與教練溝通</p>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => actions.onStartWorkout(activePlan?.routineId)}
                    className="flex-[2] rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white active:scale-[0.99]"
                  >
                    開始此計劃
                  </button>
                  <button
                    type="button"
                    onClick={actions.onOpenPlansTab}
                    className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-200 active:scale-[0.99]"
                  >
                    查看課表
                  </button>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <section className="rounded-[24px] bg-neutral-900 p-4">
                <p className="text-xs text-neutral-400">訓練摘要</p>
                {latestSession ? (
                  <>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {latestSession.routineName || "自由訓練"}
                    </p>
                    <p className="mt-1 text-xs text-neutral-300">
                      完成 {latestSession.totalExercises} 個動作 /{" "}
                      {latestSession.totalSets} 組
                    </p>
                    {latestSession.totalVolumeKg > 0 ? (
                      <p className="mt-2 text-lg font-black text-white">
                        {latestSession.totalVolumeKg.toLocaleString()}{" "}
                        <span className="text-[10px] text-neutral-500">kg 容量</span>
                      </p>
                    ) : null}
                    {latestSession.isFromAssignedPlan ? (
                      <div className="mt-2 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[10px] text-blue-300">
                        教練指派計劃
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => actions.onOpenSessionDetail(latestSession.id)}
                      className="mt-3 text-xs text-blue-300 underline underline-offset-2"
                    >
                      查看完整記錄
                    </button>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-neutral-300">今天還未記錄訓練</p>
                    <button
                      type="button"
                      onClick={() => actions.onStartWorkout()}
                      className="mt-3 inline-flex items-center gap-1 rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-200"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      開始訓練
                    </button>
                  </>
                )}
              </section>

              <section className="rounded-r-[24px] rounded-l-lg border-l-4 border-l-blue-500 bg-neutral-900 p-4">
                <div className="flex items-center gap-1 text-xs text-neutral-400">
                  <MessageSquare className="h-3.5 w-3.5 text-blue-300" />
                  教練點評
                </div>
                {latestCoachFeedback ? (
                  <>
                    <p className="mt-2 text-xs font-semibold text-blue-200">
                      教練 {latestCoachFeedback.coachName}
                    </p>
                    <p className="mt-1 text-[10px] text-neutral-500">
                      {formatDateTime(latestCoachFeedback.createdAt)}
                    </p>
                    {latestCoachFeedback.isFromLatestSession ? (
                      <div className="mt-1 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                        本次訓練
                      </div>
                    ) : null}
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-neutral-200">
                      {latestCoachFeedback.content}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        actions.onOpenSessionDetail(latestCoachFeedback.sessionId)
                      }
                      className="mt-3 text-xs text-blue-300 underline underline-offset-2"
                    >
                      查看完整點評
                    </button>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-neutral-400">教練暫未留下點評</p>
                )}
              </section>
            </div>

            <button
              type="button"
              onClick={actions.onOpenWorkoutTab}
              className="group flex w-full items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-left transition-colors hover:bg-neutral-900"
            >
              <div>
                <p className="text-sm font-semibold text-white">查看完整訓練紀錄</p>
                <p className="mt-1 text-xs text-neutral-400">
                  回顧過往動作、組數與進度
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900">
                  <Dumbbell className="h-4 w-4 text-neutral-200" />
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>

            {actions.onOpenProgress ? (
              <button
                type="button"
                onClick={actions.onOpenProgress}
                className="group flex w-full items-center justify-between rounded-2xl border border-blue-500/25 bg-neutral-950 p-4 text-left transition-colors hover:bg-neutral-900"
              >
                <div>
                  <p className="text-sm font-semibold text-white">查看完整進度</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    體態趨勢與每週訓練量圖表
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15">
                    <TrendingUp className="h-4 w-4 text-blue-300" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

