import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Dumbbell, Activity } from "lucide-react";
import {
  api,
  type SessionFeedback,
  type WorkoutSession,
  type WorkoutSessionDetail,
} from "@/lib/api";

interface WorkoutHistoryProps {
  initialSessionId?: string;
  onInitialSessionHandled?: () => void;
}

export default function WorkoutHistory({
  initialSessionId,
  onInitialSessionHandled,
}: WorkoutHistoryProps) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [detailsBySessionId, setDetailsBySessionId] = useState<Record<string, WorkoutSessionDetail>>({});
  const [feedbackBySessionId, setFeedbackBySessionId] = useState<Record<string, SessionFeedback[]>>({});
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [latestBadgeSessionId, setLatestBadgeSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [loadingFeedbackId, setLoadingFeedbackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let active = true;

    const loadSessions = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.getWorkoutSessions({ limit: 5 });
        if (!active) return;
        setSessions(result);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "載入訓練紀錄失敗");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadSessions();
    return () => {
      active = false;
    };
  }, []);

  const totalVolumeKg = useMemo(
    () => sessions.reduce((sum, session) => sum + (session.totalVolume ?? 0), 0),
    [sessions],
  );

  const headerDateLabel = useMemo(() => {
    if (!sessions.length) return "尚無資料";
    const date = new Date(sessions[0].completedAt);
    return date.toLocaleDateString("zh-HK", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
    });
  }, [sessions]);

  const toggleSessionDetail = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }
    setExpandedSessionId(sessionId);
    const cachedDetail = detailsBySessionId[sessionId];

    setLoadingFeedbackId(sessionId);
    if (!cachedDetail) {
      setLoadingDetailId(sessionId);
    }

    try {
      if (cachedDetail) {
        const feedbacks = await api.getSessionFeedback(sessionId);
        setFeedbackBySessionId((prev) => ({ ...prev, [sessionId]: feedbacks }));
        setLatestBadgeSessionId(sessionId);
        window.setTimeout(() => {
          setLatestBadgeSessionId((prev) => (prev === sessionId ? null : prev));
        }, 1500);
        return;
      }

      const [detail, feedbacks] = await Promise.all([
        api.getWorkoutSessionDetail(sessionId),
        api.getSessionFeedback(sessionId),
      ]);
      setDetailsBySessionId((prev) => ({ ...prev, [sessionId]: detail }));
      setFeedbackBySessionId((prev) => ({ ...prev, [sessionId]: feedbacks }));
      setLatestBadgeSessionId(sessionId);
      window.setTimeout(() => {
        setLatestBadgeSessionId((prev) => (prev === sessionId ? null : prev));
      }, 1500);
    } catch (err) {
      console.error("Load session detail error:", err);
    } finally {
      setLoadingDetailId(null);
      setLoadingFeedbackId(null);
    }
  };

  useEffect(() => {
    if (!initialSessionId || loading) return;

    let cancelled = false;

    const ensureSessionVisible = async () => {
      let targetId = initialSessionId;
      const exists = sessions.some((s) => s.sessionId === targetId);

      if (!exists) {
        try {
          const [detail, feedbacks] = await Promise.all([
            api.getWorkoutSessionDetail(targetId),
            api.getSessionFeedback(targetId),
          ]);
          if (cancelled) return;

          setDetailsBySessionId((prev) => ({ ...prev, [targetId]: detail }));
          setFeedbackBySessionId((prev) => ({ ...prev, [targetId]: feedbacks }));

          setSessions((prev) => {
            if (prev.some((s) => s.sessionId === targetId)) return prev;
            const injected: WorkoutSession = {
              sessionId: detail.sessionId,
              completedAt: detail.completedAt,
              totalVolume: detail.totalVolume ?? 0,
              completedSets: detail.completedSets,
              rpe: detail.rpe,
              routineName: detail.routineName,
            };
            return [injected, ...prev];
          });
        } catch (err) {
          console.error("Deep-link session load failed:", err);
          onInitialSessionHandled?.();
          return;
        }
      }

      if (expandedSessionId !== targetId) {
        await toggleSessionDetail(targetId);
      }

      requestAnimationFrame(() => {
        const el = sessionRefs.current[targetId];
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });

      onInitialSessionHandled?.();
    };

    void ensureSessionVisible();

    return () => {
      cancelled = true;
    };
  }, [initialSessionId, loading, sessions, expandedSessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-4">
        <div className="max-w-md mx-auto space-y-3">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="h-20 rounded-xl bg-neutral-900 border border-neutral-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-4">
        <div className="max-w-md mx-auto bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-sm text-rose-300">
          {error}
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-4">
        <div className="max-w-md mx-auto bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-sm text-neutral-300">
          還沒有訓練紀錄，開始第一次訓練吧！
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-10">
      <div className="sticky top-0 z-20 bg-neutral-950/80 backdrop-blur-lg border-b border-neutral-800 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            type="button"
            className="p-2 -ml-2 rounded-full hover:bg-neutral-800 transition-colors"
            aria-label="返回"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="text-center">
            <h1 className="text-sm font-bold">訓練歷史記錄</h1>
            <p className="text-xs text-neutral-400">{headerDateLabel}</p>
          </div>
          <div className="w-8" />
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="grid grid-cols-1 gap-3">
          <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 p-4 rounded-2xl">
            <p className="text-xs text-neutral-400 font-medium flex items-center gap-1">
              <Activity size={14} className="text-blue-500" /> 最近訓練容量
            </p>
            <p className="text-2xl font-bold mt-2">{Math.round(totalVolumeKg).toLocaleString()}</p>
            <p className="text-[10px] text-neutral-500">KG（最近 5 次 Session）</p>
          </div>
        </div>

        {/* TODO(C.7): 熱量卡、飲食區段、教練點評、擊掌、視角切換在後續階段補齊 */}

        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-bold text-neutral-200 px-1">訓練清單</h2>
          {sessions.map((session) => {
            const detail = detailsBySessionId[session.sessionId];
            const feedbacks = feedbackBySessionId[session.sessionId] ?? [];
            const isExpanded = expandedSessionId === session.sessionId;
            const isDetailLoading = loadingDetailId === session.sessionId;
            const isFeedbackLoading = loadingFeedbackId === session.sessionId;
            return (
              <div
                key={session.sessionId}
                ref={(el) => {
                  sessionRefs.current[session.sessionId] = el;
                }}
                className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleSessionDetail(session.sessionId)}
                  className="w-full text-left px-4 py-3 border-b border-neutral-800/80 hover:bg-neutral-800/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-blue-100">
                        {session.routineName || "未命名訓練"}
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {new Date(session.completedAt).toLocaleString("zh-HK")}
                      </p>
                    </div>
                    <div className="text-right">
                      {latestBadgeSessionId === session.sessionId && (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-300 mb-1">
                          最新
                        </span>
                      )}
                      <p className="text-xs text-neutral-500">容量</p>
                      <p className="text-sm font-bold text-neutral-200">
                        {Math.round(session.totalVolume).toLocaleString()} kg
                      </p>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-3 space-y-2">
                    {isDetailLoading ? (
                      <div className="h-16 rounded-lg bg-neutral-800 animate-pulse" />
                    ) : detail ? (
                      <>
                        {detail.exercises.map((exercise) => (
                          <div key={exercise.id} className="bg-neutral-800/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Dumbbell size={14} className="text-blue-400" />
                              <p className="text-xs font-bold text-neutral-100">{exercise.exerciseName}</p>
                            </div>
                            <div className="space-y-1.5">
                              {exercise.sets.map((set) => (
                                <div key={set.id} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-3">
                                    <span className="text-neutral-500 w-4">#{set.setNumber}</span>
                                    <span className="font-mono">{set.weight ?? "-"} kg</span>
                                    <span className="text-neutral-500">x</span>
                                    <span className="font-mono">{set.reps ?? "-"} reps</span>
                                  </div>
                                  <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                      set.completed
                                        ? "bg-green-500/20 text-green-400"
                                        : "bg-neutral-700 text-neutral-500"
                                    }`}
                                  >
                                    ✓
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        {isFeedbackLoading ? (
                          <div className="h-6 rounded-md bg-neutral-800 animate-pulse" />
                        ) : feedbacks.length > 0 ? (
                          <div className="mt-2 space-y-2">
                            {feedbacks.map((feedback) => (
                              <div
                                key={feedback.id}
                                className="rounded-lg border border-neutral-800 border-l-4 border-l-blue-500 bg-neutral-900/80 px-3 py-2"
                              >
                                <p className="text-xs text-blue-300 font-semibold">{feedback.trainerName}</p>
                                <p className="text-xs text-neutral-200 mt-1 whitespace-pre-wrap">{feedback.content}</p>
                                <p className="text-[10px] text-neutral-500 mt-1">
                                  {new Date(feedback.createdAt).toLocaleString("zh-HK")}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-xs text-neutral-500">無法載入該次訓練明細。</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
