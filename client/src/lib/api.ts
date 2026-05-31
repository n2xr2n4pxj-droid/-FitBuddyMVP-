import { request } from "@/lib/api-client";
import type { AppApiError } from "@/lib/api-error";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "USER" | "COACH";
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  isCustom: boolean;
}

export interface RoutineExercise {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  load: number; // kg
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  coachId: string;
  clientId: string;
  scheduledDate: string; // ISO date
  notes?: string;
  coachTips?: string;
  exercises: RoutineExercise[];
}

export interface SetLog {
  weight: number;
  reps: number;
  isWarmup?: boolean;
  rpe?: number;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
}

export interface CreateSessionBody {
  routineId?: string;
  notes?: string;
  rpe?: number;
  exercises: ExerciseLog[];
}

export interface WorkoutSession {
  sessionId: string;
  completedAt: string;
  totalVolume: number;
  completedSets?: number;
  rpe?: number;
  routineName?: string;
}

export interface WorkoutSessionDetailSet {
  id: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
}

export interface WorkoutSessionDetailExercise {
  id: string;
  exerciseName: string;
  orderIndex: number;
  sets: WorkoutSessionDetailSet[];
}

export interface WorkoutSessionDetail extends WorkoutSession {
  notes: string;
  exercises: WorkoutSessionDetailExercise[];
}

export interface NutritionPlan {
  id: string;
  name: string;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  coachTips?: string;
  meals: NutritionMeal[];
}

export interface NutritionMeal {
  id: string;
  mealType:
    | "breakfast"
    | "lunch"
    | "dinner"
    | "snack"
    | "pre_workout"
    | "post_workout";
  name: string;
  description?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  coachTip?: string;
  order: number;
}

export interface NutritionLogBody {
  planId?: string;
  logDate: string; // YYYY-MM-DD
  mealType: string;
  description?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  notes?: string;
}

export interface NutritionLog extends NutritionLogBody {
  id: string;
  createdAt: string;
  /** 後端序列化：與 description 相同之食物名稱 */
  name?: string;
  consumedAt?: string;
}

/** GET /api/nutrition/logs/my 與教練端 GET client nutrition 回應 */
export interface DayNutritionOverview {
  logs: NutritionLog[];
  summary: {
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
  };
  goals: {
    goalCalories: number;
    goalProtein: number;
    goalCarbs: number;
    goalFat: number;
  };
}

/** @deprecated 請使用 DayNutritionOverview */
export type DayNutritionSummary = DayNutritionOverview;

export interface LegacyAuthResponse {
  token: string;
  user: User;
}

/**
 * @deprecated 舊版命名，請優先使用 `AuthApiResponse`（`@/types/auth-payload`）。
 * 目前保留別名以維持既有匯入不破壞。
 */
export type AuthResponse = LegacyAuthResponse;

export interface AssignedCoach {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatar: string | null;
}

export interface MyCoachResponse {
  assignedCoachId: string | null;
  assignedCoach: AssignedCoach | null;
}

export interface LearnerListItem {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarFallback: string;
  status: "active" | "inactive";
}

// ==========================================
// Phase D：Plans（指派 / 課表預覽）
// ==========================================
export interface PlanSummary {
  // 這邊的 id 對應 workout_routines.id（routineId）
  id: string;
  name: string;
  exerciseCount: number;
  /** TRAINER 課表庫：已指派的不同學員人數（GET /api/plans/available） */
  assignedLearnerCount?: number;
  // isOwn：對「當前登入者」而言是否為自己擁有/自建的計畫
  isOwn: boolean;
  // 以下欄位為「指派」狀態使用（未指派時可為 undefined）
  assignedBy?: string;
  // 指派者顯示名稱（由後端 join users 計算）
  trainerName?: string;
  assignedAt?: string;
  // 可選：指派備註（若尚未需要顯示可不使用）
  note?: string | null;
}

export interface PlanDetailSet {
  id: string;
  setIndex: number;
  setType: string | null;
  weight: number | null;
  reps: number | null;
  targetRpe?: number | null;
}

export interface PlanDetailExercise {
  id: string;
  /** exercises 表 id，PATCH 時可帶回 */
  exerciseId: string;
  exerciseName: string;
  order: number;
  restTimerSeconds: number;
  sets: PlanDetailSet[];
}

export interface PlanDetail extends PlanSummary {
  notes?: string | null;
  exercises: PlanDetailExercise[];
}

/** POST /api/workouts/routines 請求體（與後端一致） */
export interface CreateRoutineExerciseSetPayload {
  setIndex: number;
  setType?: string;
  targetWeight?: number | null;
  targetReps?: number | null;
  targetRpe?: number | null;
}

export interface CreateRoutineExercisePayload {
  /** 若缺省，後端可用 exerciseName 建立自訂動作 */
  exerciseId?: string;
  exerciseName?: string;
  order?: number;
  sets: CreateRoutineExerciseSetPayload[];
  restTimerSeconds?: number;
  supersetId?: string | null;
}

export interface CreateRoutinePayload {
  clientId: string;
  name: string;
  notes?: string | null;
  scheduledDate?: string | null;
  exercises: CreateRoutineExercisePayload[];
}

export interface CreateRoutineResponse {
  id: string;
  coachId: string;
  clientId: string;
  name: string;
  notes: string | null;
  scheduledDate: Date | string | null;
  isCompleted: boolean;
  setsCount?: number;
}

/** PATCH /api/workouts/routines/:id */
export interface UpdatePlanPayload {
  name?: string;
  notes?: string | null;
  scheduledDate?: string | null;
  exercises?: Array<{
    id?: string;
    exerciseId?: string;
    exerciseName?: string;
    order: number;
    restTimerSeconds?: number;
    sets: Array<{
      id?: string;
      setIndex: number;
      setType?: string;
      targetWeight?: number | null;
      targetReps?: number | null;
      targetRpe?: number | null;
    }>;
  }>;
  deletedExerciseIds?: string[];
  deletedSetIds?: string[];
}

export interface SessionFeedback {
  id: string;
  trainerId: string;
  trainerName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearnerDashboardOverview {
  learnerId: string;
  today: string;
  latestSession?: {
    id: string;
    date: string;
    routineName: string | null;
    totalExercises: number;
    totalSets: number;
    totalVolumeKg: number;
    isFromAssignedPlan: boolean;
  };
  latestCoachFeedback?: {
    sessionId: string;
    coachName: string;
    content: string;
    createdAt: string;
    isFromLatestSession: boolean;
  };
  activePlanPreview?: {
    routineId: string;
    name: string;
    exerciseCount: number;
    assignedBy?: string;
  };
}

export interface NotificationPreferences {
  userId: string;
  workoutRemindersEnabled: boolean;
  sessionFeedbackEnabled: boolean;
  planAssignedEnabled: boolean;
  marketingEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  auth: string;
  p256dh: string;
  userAgent?: string;
}

export interface NotificationItem {
  id: string;
  type: "workout_reminder" | "session_feedback" | "plan_assigned";
  title: string;
  body: string;
  linkUrl: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  sentAt: string;
  readAt: string | null;
}

export interface NotificationPageResult {
  notifications: NotificationItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface BodyCompositionLog {
  id: string;
  userId: string;
  measuredAt: string;
  weight: number;
  bodyFatPct: number | null;
  muscleMass: number | null;
  visceralFat: number | null;
  bmi: number | null;
  notes: string | null;
  createdAt: string;
}

export interface AddBodyCompositionInput {
  userId?: string;
  measuredAt: string;
  weight: number;
  bodyFatPct?: number | null;
  muscleMass?: number | null;
  visceralFat?: number | null;
  bmi?: number | null;
  notes?: string | null;
}

export interface WorkoutVolumeWeek {
  weekLabel: string;
  sessionCount: number;
  totalSets: number;
}

export type ApiError = AppApiError;

export interface WorkoutInsightResponse {
  summary: string;
  highlights?: string[];
  suggestions?: string[];
}

export const api = {
  // --- Exercises ---
  searchExercises: (search: string, limit = 20) =>
    request.get<Exercise[]>(
      `/api/exercises?search=${encodeURIComponent(search)}&limit=${limit}`,
    ),

  // --- Workout Routines ---
  getUpcomingRoutines: (clientId: string) =>
    request.get<WorkoutRoutine[]>(
      `/api/workouts/routines?clientId=${clientId}&upcoming=true`,
    ),

  createRoutine: (body: CreateRoutinePayload) =>
    request.post<CreateRoutineResponse>("/api/workouts/routines", body),

  updatePlan: (routineId: string, payload: UpdatePlanPayload) =>
    request.patch<PlanDetail>(`/api/workouts/routines/${encodeURIComponent(routineId)}`, payload),

  deletePlan: (routineId: string) =>
    request.delete<void>(`/api/workouts/routines/${encodeURIComponent(routineId)}`),

  // --- AI ---
  generateRoutine: (clientId: string, prompt: string) =>
    request.post<{ routine: Partial<WorkoutRoutine> }>("/api/ai/generate-routine", { clientId, prompt }),

  getWorkoutInsight: (routine: WorkoutRoutine, completedExercises?: unknown[]) =>
    request.post<WorkoutInsightResponse>("/api/ai/workout-insight", { routine, completedExercises }),

  // --- Workout Sessions（API 預留，後端即將新增）---
  logWorkoutSession: (body: CreateSessionBody) =>
    request.post<{ sessionId: string; totalVolume: number }>("/api/workouts/sessions", body),

  getWorkoutSessions: (params?: { limit?: number; from?: string; to?: string }) => {
    const queryParams = new URLSearchParams();
    if (typeof params?.limit === "number") queryParams.set("limit", String(params.limit));
    if (params?.from) queryParams.set("from", params.from);
    if (params?.to) queryParams.set("to", params.to);
    const query = queryParams.toString();
    return request.get<WorkoutSession[]>(
      `/api/workouts/sessions/my${query ? `?${query}` : ""}`,
    );
  },

  getMyWorkoutSessions: (from?: string, to?: string) =>
    api.getWorkoutSessions({ from, to }),

  getWorkoutSessionDetail: (sessionId: string) =>
    request.get<WorkoutSessionDetail>(`/api/workouts/sessions/${sessionId}`),

  // Coach 查學員訓練
  getClientWorkouts: (clientId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    return request.get<WorkoutSession[]>(
      `/api/coach/clients/${clientId}/workouts${query ? `?${query}` : ""}`,
    );
  },

  // --- Nutrition Plans（API 預留，後端即將新增）---
  getMyNutritionPlans: (status = "active") =>
    request.get<NutritionPlan[]>(`/api/nutrition/plans/my?status=${status}`),

  createNutritionPlan: (body: Omit<NutritionPlan, "id"> & { clientId: string }) =>
    request.post<{ planId: string }>("/api/nutrition/plans", body),

  // --- Nutrition Logs ---
  logNutrition: (body: NutritionLogBody) =>
    request.post<NutritionLog>("/api/nutrition/logs", body),

  getTodayNutritionLogs: (date: string) =>
    request.get<DayNutritionOverview>(`/api/nutrition/logs/my?date=${encodeURIComponent(date)}`),

  deleteNutritionLog: (id: string) =>
    request.delete<void>(`/api/nutrition/logs/${encodeURIComponent(id)}`),

  // --- Coach clients ---
  getMyClients: () => request.get<User[]>("/api/coach/clients"),

  // --- Client coach assignment ---
  getMyCoach: () => request.get<MyCoachResponse>("/api/coach-client/my-coach"),

  // --- Trainer learner list ---
  getMyLearners: () => request.get<LearnerListItem[]>("/api/coach-client/my-learners"),

  // --- Trainer view learner workouts ---
  getLearnerWorkoutSessions: (
    learnerId: string,
    params?: { limit?: number }
  ) => {
    const queryParams = new URLSearchParams();
    if (typeof params?.limit === "number") {
      queryParams.set("limit", String(params.limit));
    }
    const query = queryParams.toString();
    return request.get<WorkoutSession[]>(
      `/api/workouts/sessions/learner/${encodeURIComponent(learnerId)}${query ? `?${query}` : ""}`,
    );
  },

  getLearnerWorkoutSessionDetail: (learnerId: string, sessionId: string) =>
    request.get<WorkoutSessionDetail>(
      `/api/workouts/sessions/learner/${encodeURIComponent(learnerId)}/${encodeURIComponent(sessionId)}`,
    ),

  submitSessionFeedback: (sessionId: string, content: string) =>
    request.post<Pick<SessionFeedback, "id" | "content" | "createdAt" | "updatedAt">>(
      `/api/workouts/sessions/${encodeURIComponent(sessionId)}/feedback`,
      { content }
    ),

  getSessionFeedback: (sessionId: string) =>
    request.get<SessionFeedback[]>(`/api/workouts/sessions/${encodeURIComponent(sessionId)}/feedback`),

  getLearnerDashboardOverview: () =>
    request.get<LearnerDashboardOverview>(`/api/dashboard/learner/overview`),

  // --- Notifications ---
  getNotificationPreferences: () =>
    request.get<NotificationPreferences>("/api/notifications/preferences"),

  updateNotificationPreferences: (
    patch: Partial<
      Omit<NotificationPreferences, "userId">
    >,
  ) =>
    request.put<NotificationPreferences>("/api/notifications/preferences", patch),

  savePushSubscription: (payload: PushSubscriptionInput) =>
    request.post<{ success: boolean; subscription?: { id: string; endpoint: string } }>(
      "/api/notifications/push-subscriptions",
      payload,
    ),

  deletePushSubscription: (endpoint: string) =>
    request.delete<{ success: boolean }>("/api/notifications/push-subscriptions", {
      data: { endpoint },
    }),

  sendTestPush: () =>
    request.post<{ success: boolean }>("/api/notifications/test-push"),

  getNotifications: (params?: { limit?: number; cursor?: string | null }) => {
    const query = new URLSearchParams();
    if (typeof params?.limit === "number") query.set("limit", String(params.limit));
    if (params?.cursor) query.set("cursor", params.cursor);
    const qs = query.toString();
    return request.get<NotificationPageResult>(`/api/notifications/my${qs ? `?${qs}` : ""}`);
  },

  getUnreadCount: () => request.get<{ count: number }>("/api/notifications/unread-count"),

  markNotificationRead: (id: string) =>
    request.post<{ id: string; isRead: boolean; readAt: string | null }>(
      `/api/notifications/${encodeURIComponent(id)}/read`,
    ),

  // ==========================================
  // Phase H：Analytics（/api/analytics/*）
  // ==========================================
  getBodyComposition: (userId: string, from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const qs = q.toString();
    return request.get<BodyCompositionLog[]>(
      `/api/analytics/body-composition/${encodeURIComponent(userId)}${qs ? `?${qs}` : ""}`,
    );
  },

  addBodyComposition: (data: AddBodyCompositionInput) =>
    request.post<BodyCompositionLog>("/api/analytics/body-composition", data),

  deleteBodyComposition: (logId: string) =>
    request.delete<void>(`/api/analytics/body-composition/${encodeURIComponent(logId)}`),

  getWorkoutVolume: (userId: string, weeks?: number) => {
    const q = new URLSearchParams();
    if (typeof weeks === "number") q.set("weeks", String(weeks));
    const qs = q.toString();
    return request.get<WorkoutVolumeWeek[]>(
      `/api/analytics/workout-volume/${encodeURIComponent(userId)}${qs ? `?${qs}` : ""}`,
    );
  },

  // ==========================================
  // Phase D：Plans API（/api/plans/*）
  // ==========================================
  // Learner：取得自己的計劃（指派 + 自建）
  getMyPlans: () => request.get<PlanSummary[]>("/api/plans/my"),

  // 任意用戶：取得某個計劃的完整內容（需在後端通過擁有權/指派權驗證）
  getPlanDetail: (routineId: string) =>
    request.get<PlanDetail>(`/api/plans/${encodeURIComponent(routineId)}`),

  // Trainer：取得自己建立的所有 routine（可用於指派）
  getAvailablePlans: () => request.get<PlanSummary[]>("/api/plans/available"),

  // Trainer：指派（upsert）計劃給指定 learner
  assignPlan: (routineId: string, learnerId: string, note?: string) =>
    request.post<{ success: true }>(`/api/plans/assign`, { routineId, learnerId, note: note ?? null }),

  // Trainer：取消指派
  unassignPlan: (learnerId: string, routineId: string) =>
    request.delete<{ success: true }>(
      `/api/plans/assign/${encodeURIComponent(learnerId)}/${encodeURIComponent(routineId)}`,
    ),

  // Trainer：查詢此 learner 已被指派的 routineIds（用於判斷按鈕狀態）
  getAssignedRoutineIdsForLearner: (learnerId: string) =>
    request.get<{ routineIds: string[] }>(
      `/api/plans/assignments/${encodeURIComponent(learnerId)}`
    ).then((r) => r.routineIds),

  getClientNutritionLogs: (clientId: string, date: string) =>
    request.get<DayNutritionOverview>(
      `/api/coach/clients/${encodeURIComponent(clientId)}/nutrition/logs?date=${encodeURIComponent(date)}`,
    ),
};
