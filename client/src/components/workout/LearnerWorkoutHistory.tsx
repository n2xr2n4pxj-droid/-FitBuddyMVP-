import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  MessageSquare,
  UserPlus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  api,
  type NutritionLog,
  type WorkoutSession,
  type WorkoutSessionDetail,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import TrainerAssignPlanModal from "@/components/plans/TrainerAssignPlanModal";
import TrainerPlansManager from "@/components/plans/TrainerPlansManager";
import ClientProgressCard from "@/components/progress/ClientProgressCard";
import MacroSummaryBar from "@/components/nutrition/MacroSummaryBar";
import MealSection, { MEAL_NAMES } from "@/components/nutrition/MealSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Learner {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarFallback: string;
  status: "Active" | "Inactive";
}

interface LearnerWorkoutHistoryProps {
  onOpenClientProgress?: (clientId: string, clientName?: string) => void;
}

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;

function hktTodayYmd(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
}

function coachTargetFromGoals(
  goals:
    | { goalCalories: number; goalProtein: number; goalCarbs: number; goalFat: number }
    | undefined,
) {
  const g = goals ?? {
    goalCalories: 0,
    goalProtein: 0,
    goalCarbs: 0,
    goalFat: 0,
  };
  const fallback = { calories: 2000, protein: 150, carbs: 200, fat: 60 };
  return {
    calories: g.goalCalories > 0 ? g.goalCalories : fallback.calories,
    protein: g.goalProtein > 0 ? g.goalProtein : fallback.protein,
    carbs: g.goalCarbs > 0 ? g.goalCarbs : fallback.carbs,
    fat: g.goalFat > 0 ? g.goalFat : fallback.fat,
  };
}

export default function LearnerWorkoutHistory({
  onOpenClientProgress,
}: LearnerWorkoutHistoryProps) {
  const { user } = useAuth();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>("");
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<WorkoutSessionDetail | null>(null);
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [feedbackText, setFeedbackText] = useState<string>("");
  const [isFeedbackLoading, setIsFeedbackLoading] = useState<boolean>(false);
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState<boolean>(false);
  const [feedbackSuccessVisible, setFeedbackSuccessVisible] = useState<boolean>(false);

  const [isLearnersLoading, setIsLearnersLoading] = useState<boolean>(true);
  const [isSessionsLoading, setIsSessionsLoading] = useState<boolean>(false);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ==========================================
  // Phase D：訓練計劃指派（TRAINER）
  // ==========================================
  const [trainerAssignPlanOpen, setTrainerAssignPlanOpen] = useState<boolean>(false);
  const [trainerPlansOpen, setTrainerPlansOpen] = useState<boolean>(false);

  const [mainTab, setMainTab] = useState<"workout" | "nutrition">("workout");
  const [nutritionDate, setNutritionDate] = useState<string>(() => hktTodayYmd());

  const nutritionQuery = useQuery({
    queryKey: ["coachNutrition", selectedLearnerId, nutritionDate],
    queryFn: () => api.getClientNutritionLogs(selectedLearnerId, nutritionDate),
    enabled: Boolean(selectedLearnerId) && mainTab === "nutrition",
  });

  const coachLogsByMeal = useMemo(() => {
    const map: Record<string, NutritionLog[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const log of nutritionQuery.data?.logs ?? []) {
      const k = String(log.mealType ?? "").toLowerCase();
      if (!map[k]) map[k] = [];
      map[k].push(log);
    }
    return map;
  }, [nutritionQuery.data?.logs]);

  const coachConsumed = useMemo(() => {
    const s = nutritionQuery.data?.summary;
    return {
      calories: s?.totalCalories ?? 0,
      protein: s?.totalProtein ?? 0,
      carbs: s?.totalCarbs ?? 0,
      fat: s?.totalFat ?? 0,
    };
  }, [nutritionQuery.data?.summary]);

  const coachTarget = useMemo(
    () => coachTargetFromGoals(nutritionQuery.data?.goals),
    [nutritionQuery.data?.goals],
  );

  useEffect(() => {
    let active = true;

    const loadLearners = async () => {
      setIsLearnersLoading(true);
      setErrorMessage(null);
      try {
        const result = await api.getMyLearners();
        if (!active) return;
        const mapped: Learner[] = result.map((learner) => ({
          id: learner.id,
          name: learner.name,
          avatarUrl: learner.avatarUrl,
          avatarFallback: learner.avatarFallback,
          status: learner.status === "inactive" ? "Inactive" : "Active",
        }));
        const activeLearners = mapped.filter((learner) => learner.status === "Active");
        setLearners(activeLearners);
        setSelectedLearnerId(activeLearners[0]?.id ?? "");
      } catch (err: any) {
        if (!active) return;
        const statusCode = err?.statusCode;
        if (statusCode === 403) {
          setErrorMessage("你目前沒有權限檢視學員訓練記錄。");
        } else {
          setErrorMessage("載入名下學員失敗，請稍後再試。");
        }
      } finally {
        if (active) setIsLearnersLoading(false);
      }
    };

    loadLearners();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedLearnerId) {
      setSessions([]);
      setSelectedSessionId("");
      setSelectedSessionDetail(null);
      return;
    }

    let active = true;
    const loadSessions = async () => {
      setIsSessionsLoading(true);
      setErrorMessage(null);
      setSelectedSessionId("");
      setSelectedSessionDetail(null);
      setExpandedExercises({});
      try {
        const result = await api.getLearnerWorkoutSessions(selectedLearnerId, { limit: 10 });
        if (!active) return;
        setSessions(result);
      } catch (err: any) {
        if (!active) return;
        const statusCode = err?.statusCode;
        if (statusCode === 403) {
          setErrorMessage("你沒有此 LEARNER 的訓練記錄存取權限。");
        } else {
          setErrorMessage("載入訓練記錄失敗，請稍後再試。");
        }
      } finally {
        if (active) setIsSessionsLoading(false);
      }
    };

    loadSessions();
    return () => {
      active = false;
    };
  }, [selectedLearnerId]);

  const selectedLearner = useMemo(
    () => learners.find((learner) => learner.id === selectedLearnerId) ?? null,
    [learners, selectedLearnerId]
  );

  const selectedDateLabel = useMemo(() => {
    if (!selectedSessionDetail?.completedAt) return "未選擇記錄";
    return new Date(selectedSessionDetail.completedAt).toLocaleDateString("zh-HK", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }, [selectedSessionDetail]);

  const handleSessionSelect = async (sessionId: string) => {
    if (!selectedLearnerId) return;
    setSelectedSessionId(sessionId);
    setExpandedExercises({});
    setIsDetailLoading(true);
    setErrorMessage(null);
    try {
      const detail = await api.getLearnerWorkoutSessionDetail(selectedLearnerId, sessionId);
      setSelectedSessionDetail(detail);
      setIsFeedbackLoading(true);
      const feedbacks = await api.getSessionFeedback(sessionId);
      const myFeedback = feedbacks.find((feedback) => feedback.trainerId === user?.id);
      setFeedbackText(myFeedback?.content ?? "");
      const initialExpanded: Record<string, boolean> = {};
      for (const exercise of detail.exercises) {
        initialExpanded[exercise.id] = true;
      }
      setExpandedExercises(initialExpanded);
    } catch (err: any) {
      const statusCode = err?.statusCode;
      if (statusCode === 403) {
        setErrorMessage("你沒有權限檢視該次訓練詳情。");
      } else {
        setErrorMessage("載入訓練詳情失敗，請稍後再試。");
      }
    } finally {
      setIsDetailLoading(false);
      setIsFeedbackLoading(false);
    }
  };

  const toggleExercise = (exerciseId: string) => {
    setExpandedExercises((prev) => ({
      ...prev,
      [exerciseId]: !prev[exerciseId],
    }));
  };

  const handleSubmitFeedback = async () => {
    if (!selectedSessionId) return;
    const trimmed = feedbackText.trim();
    if (!trimmed) {
      setErrorMessage("點評內容不能留空。");
      return;
    }
    if (trimmed.length > 500) {
      setErrorMessage("點評最多 500 字。");
      return;
    }

    setErrorMessage(null);
    setIsFeedbackSubmitting(true);
    setFeedbackSuccessVisible(false);
    try {
      await api.submitSessionFeedback(selectedSessionId, trimmed);
      // 送出成功後立即刷新該 session 的 feedback，確保後續顯示時間戳為最新
      const latestFeedbacks = await api.getSessionFeedback(selectedSessionId);
      const myLatestFeedback = latestFeedbacks.find((feedback) => feedback.trainerId === user?.id);
      if (myLatestFeedback) {
        setFeedbackText(myLatestFeedback.content);
      }
      setFeedbackSuccessVisible(true);
      window.setTimeout(() => setFeedbackSuccessVisible(false), 2000);
    } catch (err: any) {
      const statusCode = err?.statusCode;
      if (statusCode === 403) {
        setErrorMessage("你沒有權限提交這筆訓練的點評。");
      } else {
        setErrorMessage("提交點評失敗，請稍後再試。");
      }
    } finally {
      setIsFeedbackSubmitting(false);
    }
  };

  const defaultClientIdForPlans =
    selectedLearnerId || learners[0]?.id || "";

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-10">
      <div className="sticky top-0 z-20 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 -ml-2 rounded-full hover:bg-neutral-800 transition-colors"
              onClick={() => window.history.back()}
              aria-label="返回上一頁"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-sm sm:text-base font-bold">指定學員訓練記錄</h1>
          </div>
          <span className="text-xs text-blue-300 bg-neutral-800 rounded-full px-3 py-1">教練視角</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {errorMessage && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-rose-300 mt-0.5 shrink-0" />
            <p className="text-sm text-rose-200">{errorMessage}</p>
          </div>
        )}

        {trainerPlansOpen ? (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm p-4">
            <TrainerPlansManager
              defaultClientId={defaultClientIdForPlans}
              onBack={() => setTrainerPlansOpen(false)}
            />
          </section>
        ) : null}

        <Tabs
          value={mainTab}
          onValueChange={(v) => setMainTab(v as "workout" | "nutrition")}
          className="w-full"
        >
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-neutral-900 border border-neutral-800">
            <TabsTrigger value="workout">訓練</TabsTrigger>
            <TabsTrigger value="nutrition">飲食</TabsTrigger>
          </TabsList>

          <TabsContent value="workout" className="space-y-4 mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold">名下學員</h2>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTrainerPlansOpen(true)}
                  className="rounded-xl border border-neutral-600 bg-neutral-800/80 px-3 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-800 active:scale-95 transition-transform"
                >
                  管理課表
                </button>
                <button
                  type="button"
                  onClick={() => setTrainerAssignPlanOpen(true)}
                  disabled={!selectedLearnerId}
                  className="rounded-xl bg-blue-600/20 border border-blue-500/20 hover:bg-blue-600/30 disabled:opacity-60 disabled:cursor-not-allowed px-3 py-2 text-xs font-semibold text-blue-300 active:scale-95 transition-transform"
                >
                  指派計劃
                </button>
              </div>
            </div>
            {isLearnersLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="h-14 rounded-xl bg-neutral-800 animate-pulse" />
                ))}
              </div>
            ) : learners.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-600 bg-neutral-950/40 px-4 py-5 text-center">
                <UserPlus className="mx-auto mb-3 h-9 w-9 text-amber-400/80" aria-hidden />
                <p className="text-sm font-semibold text-neutral-100">尚無名下學員</p>
                <p className="mt-2 text-left text-xs leading-relaxed text-neutral-400">
                  請先到<strong className="font-medium text-neutral-300"> 主頁 </strong>
                  使用邀請連結或 QR Code 邀請學員；對方註冊並<strong className="font-medium text-neutral-300">
                    接受邀請
                  </strong>
                  後，關聯即會啟用。屆時可在此檢視每位學員的訓練紀錄，以及上方的體態趨勢小卡與完整進度頁。
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {learners.map((learner) => {
                  const isActive = learner.id === selectedLearnerId;
                  return (
                    <button
                      key={learner.id}
                      type="button"
                      onClick={() => setSelectedLearnerId(learner.id)}
                      className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                        isActive
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-neutral-800 bg-neutral-900 hover:bg-neutral-800/70"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {learner.avatarUrl ? (
                          <img
                            src={learner.avatarUrl}
                            alt={`${learner.name} avatar`}
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-neutral-700 text-white text-sm font-semibold flex items-center justify-center">
                            {learner.avatarFallback}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{learner.name}</p>
                          <p className="text-xs text-emerald-300 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Active
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm p-4">
            <h2 className="text-sm font-semibold mb-3">
              {selectedLearner?.name ?? "學員"} 的記錄（最近 10 筆）
            </h2>
            {selectedLearnerId ? (
              <ClientProgressCard
                clientId={selectedLearnerId}
                clientName={selectedLearner?.name}
                onViewFull={() =>
                  onOpenClientProgress?.(selectedLearnerId, selectedLearner?.name)
                }
              />
            ) : null}
            {isSessionsLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="h-16 rounded-xl bg-neutral-800 animate-pulse" />
                ))}
              </div>
            ) : !selectedLearner ? (
              learners.length === 0 ? (
                <div className="rounded-xl border border-neutral-800 bg-neutral-950/30 px-3 py-4">
                  <p className="text-xs leading-relaxed text-neutral-500">
                    尚無可選學員。完成邀請並建立關聯後，此處會列出最近訓練，並在標題下方顯示該學員近 30 天的體重／體脂趨勢圖。
                  </p>
                </div>
              ) : (
                <p className="text-sm text-neutral-400">請先從左側選擇一位學員</p>
              )
            ) : sessions.length === 0 ? (
              <p className="text-sm text-neutral-400">{selectedLearner.name} 還沒有訓練紀錄</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => {
                  const isActive = session.sessionId === selectedSessionId;
                  const completedSets = session.completedSets ?? 0;
                  return (
                    <button
                      key={session.sessionId}
                      type="button"
                      onClick={() => handleSessionSelect(session.sessionId)}
                      className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                        isActive
                          ? "border-green-500 bg-green-500/10"
                          : "border-neutral-800 bg-neutral-900 hover:bg-neutral-800/70"
                      }`}
                    >
                      <p className="text-xs text-neutral-400">
                        {new Date(session.completedAt).toLocaleDateString("zh-HK", {
                          month: "long",
                          day: "numeric",
                          weekday: "long",
                        })}
                      </p>
                      <p className="text-sm font-semibold mt-0.5">
                        {session.routineName || "自由訓練"}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5">完成 {completedSets} 組</p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm p-4">
          <h2 className="text-sm font-semibold mb-3">訓練詳情（{selectedDateLabel}）</h2>

          {isDetailLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="h-16 rounded-xl bg-neutral-800 animate-pulse" />
              ))}
            </div>
          ) : !selectedSessionDetail ? (
            <p className="text-sm text-neutral-400">請從上方選擇一筆訓練記錄查看詳情</p>
          ) : (
            <div className="space-y-2">
              {selectedSessionDetail.exercises.map((exercise, index) => {
                const isExpanded = !!expandedExercises[exercise.id];
                return (
                  <div key={exercise.id} className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleExercise(exercise.id)}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-neutral-800/70 transition-colors"
                    >
                      <span className="text-sm font-medium">
                        動作 {index + 1}: {exercise.exerciseName}
                      </span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-1.5">
                        {exercise.sets.map((set) => (
                          <div key={set.id} className="text-xs text-neutral-300 flex items-center justify-between">
                            <span>
                              #{set.setNumber} · {set.weight ?? "-"} kg × {set.reps ?? "-"} reps
                            </span>
                            {set.completed ? (
                              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-300">
                                <Check size={12} />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-neutral-700 text-neutral-500">
                                <Check size={12} />
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
          </TabsContent>

          <TabsContent value="nutrition" className="mt-4 space-y-4">
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-sm font-semibold">
                  {selectedLearner?.name ?? "學員"} 的飲食（香港當日）
                </h2>
                <label className="flex items-center gap-2 text-xs text-neutral-400">
                  <span>日期</span>
                  <input
                    type="date"
                    value={nutritionDate}
                    onChange={(e) => setNutritionDate(e.target.value)}
                    className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100"
                  />
                </label>
              </div>
              {!selectedLearnerId ? (
                <p className="text-sm text-neutral-400">請先於「訓練」分頁選擇一位學員。</p>
              ) : nutritionQuery.isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-neutral-800 animate-pulse" />
                  ))}
                </div>
              ) : nutritionQuery.isError ? (
                <p className="text-sm text-rose-300">無法載入飲食紀錄。</p>
              ) : (
                <>
                  <div className="rounded-2xl border border-neutral-800 bg-white text-neutral-900 overflow-hidden">
                    <MacroSummaryBar consumed={coachConsumed} target={coachTarget} />
                  </div>
                  <div className="space-y-3">
                    {MEAL_ORDER.map((mt) => {
                      const logs = coachLogsByMeal[mt] ?? [];
                      const template = {
                        id: `tpl-${mt}`,
                        mealType: mt,
                        name: MEAL_NAMES[mt] ?? mt,
                        description: `此餐別紀錄（${logs.length} 筆）`,
                        calories: 0,
                        protein: 0,
                        carbs: 0,
                        fat: 0,
                        coachTip: null as string | null,
                      };
                      return (
                        <div
                          key={mt}
                          className="[&_.sticky]:static [&_section]:bg-neutral-900/60 [&_section]:border-neutral-700"
                        >
                          <MealSection
                            meal={template}
                            dayLogs={logs}
                            isLogged={logs.length > 0}
                            onLogFood={() => {}}
                            readOnly
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          </TabsContent>
        </Tabs>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm p-4">
          <div className="rounded-xl border border-neutral-700 bg-neutral-900/60 px-4 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-blue-300 shrink-0" />
              <p className="text-sm font-medium text-neutral-100">教練點評</p>
            </div>

            <div className="space-y-2">
              <textarea
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.target.value.slice(0, 500))}
                placeholder={`為 ${selectedLearner?.name ?? "該學員"} 的這次訓練留下點評…`}
                disabled={!selectedSessionId || isFeedbackSubmitting}
                className="w-full min-h-[96px] rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">
                  {isFeedbackLoading ? "載入既有點評中..." : "最多 500 字"}
                </span>
                <span className="text-xs text-neutral-500">{feedbackText.length}/500</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleSubmitFeedback}
                disabled={!selectedSessionId || isFeedbackSubmitting || isFeedbackLoading}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/60 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                {isFeedbackSubmitting ? "送出中..." : "送出點評"}
              </button>
              {feedbackSuccessVisible && (
                <span className="text-xs text-emerald-300">✅ 點評已送出</span>
              )}
            </div>
          </div>
        </section>

        <TrainerAssignPlanModal
          open={trainerAssignPlanOpen}
          onOpenChange={setTrainerAssignPlanOpen}
          learnerId={selectedLearnerId || null}
          learnerName={selectedLearner?.name}
        />
      </div>
    </div>
  );
}
