// ==========================================
// FitBuddy - 完整數據庫架構
// Drizzle ORM + PostgreSQL (Neon)
// ==========================================
// 功能：
// - 用戶角色系統（USER、COACH、ADMIN）
// - 教練-客戶邀請與關聯
// - TDEE 計算與追蹤
// - 飲食記錄
// - 訓練日誌
// - 進度追蹤
// - 朋友系統（Phase 3）
// ==========================================

import { asc, desc, sql } from 'drizzle-orm';
import { 
  pgTable, 
  uuid,
  varchar,
  text, 
  timestamp, 
  integer, 
  bigint,
  real, 
  numeric,
  boolean, 
  jsonb,
  pgEnum,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==========================================
// Domain Types（供 jsonb 欄位的型別推導使用）
// ==========================================

/** workouts.exercises 每一筆動作記錄的結構 */
export interface WorkoutExerciseEntry {
  exerciseName: string | null;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  weightUnit: 'kg' | 'lbs';
}

// ==========================================
// 枚舉類型定義
// ==========================================

// 用戶角色
export const roleEnum = pgEnum('role', ['USER', 'COACH', 'ADMIN']);

// 性別
export const genderEnum = pgEnum('gender', ['MALE', 'FEMALE', 'OTHER']);

// 活動水平
export const activityLevelEnum = pgEnum('activity_level', [
  'SEDENTARY',       // 久坐（少運動或無運動）
  'LIGHTLY_ACTIVE',  // 輕度活躍（每週 1-3 天運動）
  'MODERATELY_ACTIVE', // 中度活躍（每週 3-5 天運動）
  'VERY_ACTIVE',     // 高度活躍（每週 6-7 天運動）
  'EXTREMELY_ACTIVE' // 極度活躍（每天高強度運動或體力勞動）
]);

// 健身目標
export const goalTypeEnum = pgEnum('goal_type', [
  'LOSE_WEIGHT',     // 減重
  'MAINTAIN',        // 維持
  'GAIN_MUSCLE'      // 增肌
]);

// 邀請狀態
export const invitationStatusEnum = pgEnum('invitation_status', [
  'PENDING',   // 待處理
  'ACCEPTED',  // 已接受
  'REJECTED',  // 已拒絕
  'EXPIRED'    // 已過期
]);

// relationshipStatusEnum 已廢棄（coachClientRelationships 表移除後不再使用）
// DB 中的 enum type 可在確認後用 migration 刪除

// 好友請求狀態（Phase 3）
export const friendRequestStatusEnum = pgEnum('friend_request_status', [
  'PENDING',
  'ACCEPTED',
  'REJECTED'
]);

// ==========================================
// 核心表格
// ==========================================

// 用戶表（與 Neon 一致：id 為 varchar + gen_random_uuid()，非 serial）
export const users = pgTable('users', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').unique().notNull(),
  /** 註冊用戶名稱（可為 null，相容舊資料）；唯一、不分大小寫由查詢端 lower() 處理 */
  username: text('username').unique(),
  passwordHash: text('password_hash').notNull(),
  
  // 角色與權限
  role: roleEnum('role').notNull().default('USER'),

  // P0-2：logout 時遞增，JWT payload.tv 不符則視為已撤銷
  tokenVersion: integer('token_version').default(0).notNull(),
  
  // Email 驗證
  emailVerified: boolean('email_verified').default(false).notNull(),
  emailVerificationToken: text('email_verification_token'),
  emailVerificationExpires: bigint('email_verification_expires', { mode: 'number' }), // BIGINT 存儲時間戳（毫秒）
  
  // 個人資料
  firstName: text('first_name'),
  lastName: text('last_name'),
  avatar: text('avatar'),
  phone: text('phone'),
  profileImageUrl: text('profile_image_url'),
  dateOfBirth: timestamp('date_of_birth', { withTimezone: true }),

  // TDEE 相關欄位（與 Neon 現有表一致）
  age: integer('age'),
  gender: text('gender'), // VARCHAR 與現有 DB 一致
  height: real('height'), // cm
  weight: real('weight'), // kg
  bodyFat: real('body_fat'), // %
  activityLevel: text('activity_level'),
  goal: text('goal'), // 與 storage / auth 使用的欄位名一致

  // 計算結果（自動更新）
  bmr: real('bmr'),
  tdee: real('tdee'),
  bmi: real('bmi'),
  goalCalories: integer('goal_calories'),
  goalProtein: real('goal_protein'),
  goalCarbs: real('goal_carbs'),
  goalFat: real('goal_fat'),

  // 時間戳
  lastActive: timestamp('last_active', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  roleIdx: index('users_role_idx').on(table.role),
}));

// ==========================================
// 教練-客戶系統
// ==========================================

// 邀請表
export const invitations = pgTable('invitations', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  
  // 邀請方和接收方：改為與 users.id 一致的 UUID / varchar，並建立 FK
  senderId: varchar('sender_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  receiverEmail: text('receiver_email').notNull(), // 可能是未註冊用戶的 email
  receiverId: varchar('receiver_id')
    .references(() => users.id, { onDelete: 'set null' }),
  
  // 邀請類型與狀態
  invitationType: text('invitation_type', { enum: ['COACH_TO_CLIENT', 'CLIENT_TO_COACH'] }).notNull(),
  status: invitationStatusEnum('status').default('PENDING').notNull(),
  
  // 附加信息
  message: text('message'),
  token: text('token').unique().notNull(), // 用於郵件確認的 token
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  
  // 時間戳
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
}, (table) => ({
  senderIdx: index('invitations_sender_idx').on(table.senderId),
  receiverEmailIdx: index('invitations_receiver_email_idx').on(table.receiverEmail),
  statusIdx: index('invitations_status_idx').on(table.status),
  tokenIdx: index('invitations_token_idx').on(table.token),
}));

// 邀請模板表
export const invitationTemplates = pgTable('invitation_templates', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  coachId: varchar('coach_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  message: text('message').notNull(),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueCoachName: uniqueIndex('unique_coach_template_name').on(table.coachId, table.name),
}));

// ⚠️ coachClientRelationships 已廢棄，統一使用 coachClients
// （舊表 coach_client_relationships 仍存在於 DB，可在確認無資料後用 migration 刪除）

// ==========================================
// 飲食與訓練系統
// ==========================================

// 飲食記錄表
export const meals = pgTable('meals', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // 飲食信息
  name: text('name').notNull(),           // 對應 shared/schema 中的 foodName
  description: text('description'),
  mealType: text('meal_type', { enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] }).notNull(),
  
  // 營養數據
  calories: real('calories').notNull(),
  protein: real('protein').notNull(),     // g
  carbs: real('carbs').notNull(),         // g
  fat: real('fat').notNull(),             // g
  
  // ✅ 添加缺失的字段
  servingSize: real('serving_size'),      // 基礎份量 (g/ml)
  servingSizeUnit: varchar('serving_size_unit', { length: 10 }), // "g" or "ml"
  userServingAmount: real('user_serving_amount'), // 用戶實際份量 (g/ml)
  
  // 附加信息
  portion: text('portion'),               // 例如：1 碗、200g
  photo: text('photo'),                   // 圖片 URL
  
  // 時間戳
  consumedAt: timestamp('consumed_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('meals_user_idx').on(table.userId),
  consumedAtIdx: index('meals_consumed_at_idx').on(table.consumedAt),
  mealTypeIdx: index('meals_meal_type_idx').on(table.mealType),
}));

// 訓練記錄表
export const workouts = pgTable('workouts', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // 訓練信息
  name: text('name').notNull(),
  description: text('description'),
  workoutType: text('workout_type', { 
    enum: ['STRENGTH', 'CARDIO', 'FLEXIBILITY', 'SPORTS', 'OTHER'] 
  }).notNull(),
  
  // 訓練數據
  duration: integer('duration').notNull(), // 分鐘
  caloriesBurned: real('calories_burned'),
  intensity: text('intensity', { enum: ['LOW', 'MODERATE', 'HIGH', 'EXTREME'] }),
  
  // 詳細記錄（jsonb 格式）
  exercises: jsonb('exercises').$type<WorkoutExerciseEntry[]>(), // [{ exerciseName, sets, reps, weight, weightUnit }]
  
  // 附加信息
  notes: text('notes'),
  photos: text('photos'), // JSON 數組：["url1", "url2"]
  
  // 時間戳
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('workouts_user_idx').on(table.userId),
  performedAtIdx: index('workouts_performed_at_idx').on(table.performedAt),
  workoutTypeIdx: index('workouts_workout_type_idx').on(table.workoutType),
}));

// ==========================================
// 進度追蹤系統
// ==========================================

// 進度記錄表
export const progressEntries = pgTable('progress_entries', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // 身體數據
  weight: real('weight').notNull(), // kg
  bodyFat: real('body_fat'), // %
  muscleMass: real('muscle_mass'), // kg
  
  // 圍度測量（可選）
  chest: real('chest'), // cm
  waist: real('waist'), // cm
  hips: real('hips'), // cm
  arms: real('arms'), // cm
  thighs: real('thighs'), // cm
  
  // 附加信息
  notes: text('notes'),
  photos: text('photos'), // JSON 數組：["url1", "url2"]
  mood: text('mood', { enum: ['EXCELLENT', 'GOOD', 'NEUTRAL', 'POOR', 'TERRIBLE'] }),
  energy: integer('energy'), // 1-10
  
  // 時間戳
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('progress_entries_user_idx').on(table.userId),
  recordedAtIdx: index('progress_entries_recorded_at_idx').on(table.recordedAt),
}));

// ==========================================
// 活動日誌系統
// ==========================================

// 活動記錄表（用於教練監測）
export const activityLogs = pgTable('activity_logs', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // 活動類型與數據
  activityType: text('activity_type', { 
    enum: ['MEAL_LOGGED', 'WORKOUT_LOGGED', 'PROGRESS_RECORDED', 'GOAL_UPDATED', 'PROFILE_UPDATED'] 
  }).notNull(),
  
  // 關聯記錄（可選）
  relatedMealId: varchar('related_meal_id').references(() => meals.id, { onDelete: 'set null' }),
  relatedWorkoutId: varchar('related_workout_id').references(() => workouts.id, { onDelete: 'set null' }),
  relatedProgressId: varchar('related_progress_id').references(() => progressEntries.id, { onDelete: 'set null' }),
  
  // 活動詳情
  summary: text('summary').notNull(), // 例如："記錄了早餐 - 燕麥粥"
  metadata: text('metadata'), // JSON 格式的額外數據
  
  // 時間戳
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('activity_logs_user_idx').on(table.userId),
  activityTypeIdx: index('activity_logs_activity_type_idx').on(table.activityType),
  createdAtIdx: index('activity_logs_created_at_idx').on(table.createdAt),
}));

// ==========================================
// 朋友系統（Phase 3）
// ==========================================

// 好友請求表
export const friendRequests = pgTable('friend_requests', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar('sender_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  receiverId: varchar('receiver_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  status: friendRequestStatusEnum('status').default('PENDING').notNull(),
  message: text('message'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
}, (table) => ({
  senderIdx: index('friend_requests_sender_idx').on(table.senderId),
  receiverIdx: index('friend_requests_receiver_idx').on(table.receiverId),
  statusIdx: index('friend_requests_status_idx').on(table.status),
}));

// 好友關聯表
export const friendships = pgTable('friendships', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  user1Id: varchar('user1_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  user2Id: varchar('user2_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  user1Idx: index('friendships_user1_idx').on(table.user1Id),
  user2Idx: index('friendships_user2_idx').on(table.user2Id),
  uniqueFriendship: uniqueIndex('friendships_unique').on(table.user1Id, table.user2Id),
}));

// ==========================================
// 教練系統 Phase 2
// ==========================================

// 教練-客戶關聯表（簡化版）
export const coachClients = pgTable('coach_clients', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  
  // 關聯雙方：使用 UUID / varchar，關聯 users.id
  coachId: varchar('coach_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar('client_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // 狀態
  status: text('status', { enum: ['active', 'paused', 'completed'] }).default('active').notNull(),
  
  // 日期
  startDate: timestamp('start_date', { withTimezone: true }).defaultNow().notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  
  // 備註
  notes: text('notes'),
  
  // 時間戳
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  coachIdx: index('coach_clients_coach_idx').on(table.coachId),
  clientIdx: index('coach_clients_client_idx').on(table.clientId),
  statusIdx: index('coach_clients_status_idx').on(table.status),
  uniqueRelationship: index('coach_clients_unique').on(table.coachId, table.clientId),
  coachClientStatusIdx: index('coach_clients_coach_client_status_idx')
    .on(table.coachId, table.clientId, table.status),
}));

// ⚠️ workoutPlans 已廢棄，統一使用 workoutRoutines（正規化結構 + 軟刪除）
// （舊表 workout_plans 仍存在於 DB，可在確認無資料後用 migration 刪除）

// ==========================================
// Hevy 風格訓練模組（動作庫 / 課表 / 組數）
// ==========================================

// 全域動作庫（系統內建 + 教練自訂）
export const exercises = pgTable('exercises', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  muscleGroup: varchar('muscle_group', { length: 64 }),
  equipment: varchar('equipment', { length: 64 }),
  isCustom: boolean('is_custom').default(false).notNull(),
  createdBy: varchar('created_by').references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  muscleGroupIdx: index('exercises_muscle_group_idx').on(table.muscleGroup),
  equipmentIdx: index('exercises_equipment_idx').on(table.equipment),
  createdByIdx: index('exercises_created_by_idx').on(table.createdBy),
}));

// 課表/計畫主檔（教練開給學員的菜單）
export const workoutRoutines = pgTable('workout_routines', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  coachId: varchar('coach_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  clientId: varchar('client_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  notes: text('notes'),
  scheduledDate: timestamp('scheduled_date', { withTimezone: true }),
  isCompleted: boolean('is_completed').default(false).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  /** 軟刪除：非 null 表示課表已刪除，列表/指派應排除 */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  coachIdx: index('workout_routines_coach_idx').on(table.coachId),
  clientIdx: index('workout_routines_client_idx').on(table.clientId),
  scheduledDateIdx: index('workout_routines_scheduled_date_idx').on(table.scheduledDate),
  clientUpcomingIdx: index('workout_routines_client_upcoming_idx')
    .on(table.clientId, asc(table.scheduledDate))
    .where(sql`deleted_at IS NULL AND is_completed = false`),
  coachActiveIdx: index('workout_routines_coach_active_idx')
    .on(table.coachId)
    .where(sql`deleted_at IS NULL`),
}));

// 訓練計畫指派（Phase D）
// 用於：TRAINER 指派某個 workout_routines（routineId）給 LEARNER（learnerId）
// 重點：routineId / learnerId / trainerId 全部要用 varchar，與既有 users.id / workout_routines.id 嚴格對齊
export const planAssignments = pgTable('plan_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  routineId: varchar('routine_id')
    .notNull()
    .references(() => workoutRoutines.id, { onDelete: 'cascade' }),
  learnerId: varchar('learner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  trainerId: varchar('trainer_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  note: text('note'),
}, (table) => ({
  // 同一個 routine 只允許同一個 learner 保留一筆指派（upsert 用）
  routineLearnerIdx: uniqueIndex('routine_learner_idx').on(table.routineId, table.learnerId),
  learnerAssignedAtIdx: index('plan_assignments_learner_assigned_at_idx')
    .on(table.learnerId, desc(table.assignedAt)),
}));

// 課表中的動作清單
export const routineExercises = pgTable('routine_exercises', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  routineId: varchar('routine_id')
    .notNull()
    .references(() => workoutRoutines.id, { onDelete: 'cascade' }),
  exerciseId: varchar('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'restrict' }),
  order: integer('order').notNull(),
  supersetId: varchar('superset_id', { length: 64 }),
  restTimerSeconds: integer('rest_timer_seconds').default(90),
}, (table) => ({
  routineIdx: index('routine_exercises_routine_idx').on(table.routineId),
  exerciseIdx: index('routine_exercises_exercise_idx').on(table.exerciseId),
}));

// 每個動作的具體組數細節
export const exerciseSets = pgTable('exercise_sets', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  routineExerciseId: varchar('routine_exercise_id')
    .notNull()
    .references(() => routineExercises.id, { onDelete: 'cascade' }),
  setIndex: integer('set_index').notNull(),
  setType: varchar('set_type', { length: 32 }),
  targetWeight: real('target_weight'),
  targetReps: integer('target_reps'),
  targetRpe: integer('target_rpe'),
  actualWeight: real('actual_weight'),
  actualReps: integer('actual_reps'),
  isCompleted: boolean('is_completed').default(false).notNull(),
}, (table) => ({
  routineExerciseIdx: index('exercise_sets_routine_exercise_idx').on(table.routineExerciseId),
}));

// Learner 訓練 Session 主檔（每次實際訓練打卡）
export const workoutSessions = pgTable('workout_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // 與 workout_routines.id (varchar) 嚴格對齊，避免 FK 型別衝突
  routineId: varchar('routine_id')
    .references(() => workoutRoutines.id, { onDelete: 'set null' }),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  notes: text('notes'),
  rpe: integer('rpe'),
}, (table) => ({
  userIdx: index('workout_sessions_user_idx').on(table.userId),
  routineIdx: index('workout_sessions_routine_idx').on(table.routineId),
  completedAtIdx: index('workout_sessions_completed_at_idx').on(table.completedAt),
  userCompletedAtIdx: index('workout_sessions_user_completed_at_idx')
    .on(table.userId, table.completedAt)
    .where(sql`completed_at IS NOT NULL`),
  userListIdx: index('workout_sessions_user_list_idx')
    .on(table.userId, desc(table.completedAt), desc(table.startedAt)),
}));

// Session 動作清單（快照：避免課表後續變更影響歷史記錄）
export const sessionExercises = pgTable('session_exercises', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => workoutSessions.id, { onDelete: 'cascade' }),
  exerciseName: text('exercise_name').notNull(),
  // TODO P1: 待建立 masterExercises 表後加 exerciseId FK，支援動作 PR 統計
  orderIndex: integer('order_index').notNull(),
}, (table) => ({
  sessionIdx: index('session_exercises_session_idx').on(table.sessionId),
}));

// Session 每組記錄
export const sessionSets = pgTable('session_sets', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionExerciseId: uuid('session_exercise_id')
    .notNull()
    .references(() => sessionExercises.id, { onDelete: 'cascade' }),
  setNumber: integer('set_number').notNull(),
  weight: numeric('weight', { precision: 5, scale: 2 }),
  reps: integer('reps'),
  completed: boolean('completed').default(false).notNull(),
}, (table) => ({
  sessionExerciseIdx: index('session_sets_session_exercise_idx').on(table.sessionExerciseId),
}));

// Session 教練點評（Phase C++）
export const sessionFeedbacks = pgTable('session_feedbacks', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => workoutSessions.id, { onDelete: 'cascade' }),
  trainerId: varchar('trainer_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => ({
  sessionIdx: index('session_feedbacks_session_idx').on(table.sessionId),
  sessionTrainerUnique: uniqueIndex('session_feedbacks_session_trainer_unique').on(
    table.sessionId,
    table.trainerId
  ),
}));

// ==========================================
// 體態紀錄 InBody（Phase H）
// ==========================================

export const bodyCompositionLogs = pgTable(
  'body_composition_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
    weight: numeric('weight', { precision: 5, scale: 2 }).notNull(),
    bodyFatPct: numeric('body_fat_pct', { precision: 4, scale: 2 }),
    muscleMass: numeric('muscle_mass', { precision: 5, scale: 2 }),
    visceralFat: integer('visceral_fat'),
    bmi: numeric('bmi', { precision: 4, scale: 2 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userMeasuredIdx: index('body_composition_logs_user_measured_idx').on(table.userId, table.measuredAt),
  }),
);

// ==========================================
// 通知系統（Phase F）
// ==========================================

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 64 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  linkUrl: varchar('link_url', { length: 512 }),
  data: jsonb('data').default(sql`'{}'::jsonb`).notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
}, (table) => ({
  userIdx: index('notifications_user_idx').on(table.userId),
  sentAtIdx: index('notifications_sent_at_idx').on(table.sentAt),
  isReadIdx: index('notifications_is_read_idx').on(table.isRead),
  userSentAtIdx: index('notifications_user_sent_at_idx')
    .on(table.userId, desc(table.sentAt)),
}));

export const userNotificationPreferences = pgTable('user_notification_preferences', {
  userId: varchar('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  workoutRemindersEnabled: boolean('workout_reminders_enabled').default(true).notNull(),
  sessionFeedbackEnabled: boolean('session_feedback_enabled').default(true).notNull(),
  planAssignedEnabled: boolean('plan_assigned_enabled').default(true).notNull(),
  marketingEnabled: boolean('marketing_enabled').default(false).notNull(),
  quietHoursStart: varchar('quiet_hours_start', { length: 5 }).default('22:00').notNull(),
  quietHoursEnd: varchar('quiet_hours_end', { length: 5 }).default('08:00').notNull(),
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  auth: varchar('auth', { length: 512 }).notNull(),
  p256dh: varchar('p256dh', { length: 512 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),
  userAgent: varchar('user_agent', { length: 512 }),
}, (table) => ({
  userIdx: index('push_subscriptions_user_idx').on(table.userId),
  endpointUniqueIdx: uniqueIndex('push_subscriptions_endpoint_unique').on(table.endpoint),
}));

// ==========================================
// 郵件日誌系統
// ==========================================

// 郵件日誌表
// 注意：字段名必須與實際數據庫表結構匹配
export const emailLogs = pgTable('email_logs', {
  id: varchar('id').primaryKey().notNull(), // UUID 字符串
  coach_id: varchar('coach_id').references(() => users.id, { onDelete: 'set null' }),
  recipient_email: varchar('recipient_email').notNull(), // 收件人郵箱（數據庫中是 recipient_email，不是 to）
  subject: varchar('subject').notNull(), // 郵件主題
  message_id: varchar('message_id'), // SendGrid 的 message ID
  status: varchar('status').notNull().default('sent'), // 郵件狀態：sent, failed, bounced 等（數據庫中是 status，不是 success）
  error_message: text('error_message'), // 錯誤信息（數據庫中是 error_message，不是 error）
  type: varchar('type').default('general'), // 郵件類型：invitation, verification, general 等
  sent_at: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(), // 發送時間（數據庫中是 sent_at，不是 timestamp）
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), // 記錄建立時間
}, (table) => ({
  typeIdx: index('email_logs_type_idx').on(table.type),
  recipientEmailIdx: index('email_logs_recipient_email_idx').on(table.recipient_email),
  sentAtIdx: index('email_logs_sent_at_idx').on(table.sent_at),
  statusIdx: index('email_logs_status_idx').on(table.status),
  coachIdIdx: index('email_logs_coach_id_idx').on(table.coach_id),
  messageIdIdx: index('email_logs_message_id_idx').on(table.message_id),
}));

// ==========================================
// 關聯關係定義（Drizzle Relations）
// ==========================================

export const usersRelations = relations(users, ({ many }) => ({
  // 邀請關係
  sentInvitations: many(invitations, { relationName: 'sender' }),
  receivedInvitations: many(invitations, { relationName: 'receiver' }),
  
  // 教練-客戶關係（統一使用 coachClients）
  coachClientsAsCoach: many(coachClients, { relationName: 'coach' }),
  coachClientsAsClient: many(coachClients, { relationName: 'client' }),
  workoutRoutinesAsCoach: many(workoutRoutines, { relationName: 'coach' }),
  workoutRoutinesAsClient: many(workoutRoutines, { relationName: 'client' }),
  workoutSessions: many(workoutSessions),
  bodyCompositionLogs: many(bodyCompositionLogs),
  sessionFeedbacksAsTrainer: many(sessionFeedbacks, { relationName: 'trainer' }),
  notifications: many(notifications),
  pushSubscriptions: many(pushSubscriptions),
  customExercises: many(exercises, { relationName: 'createdBy' }),
  
  // 個人數據
  meals: many(meals),
  workouts: many(workouts),
  progressEntries: many(progressEntries),
  activityLogs: many(activityLogs),
  
  // 朋友系統
  sentFriendRequests: many(friendRequests, { relationName: 'sender' }),
  receivedFriendRequests: many(friendRequests, { relationName: 'receiver' }),
  friendships1: many(friendships, { relationName: 'user1' }),
  friendships2: many(friendships, { relationName: 'user2' }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  sender: one(users, {
    fields: [invitations.senderId],
    references: [users.id],
    relationName: 'sender',
  }),
  receiver: one(users, {
    fields: [invitations.receiverId],
    references: [users.id],
    relationName: 'receiver',
  }),
}));

// coachClientRelationshipsRelations 已移除（表已廢棄）

export const mealsRelations = relations(meals, ({ one }) => ({
  user: one(users, {
    fields: [meals.userId],
    references: [users.id],
  }),
}));

export const workoutsRelations = relations(workouts, ({ one }) => ({
  user: one(users, {
    fields: [workouts.userId],
    references: [users.id],
  }),
}));

export const progressEntriesRelations = relations(progressEntries, ({ one }) => ({
  user: one(users, {
    fields: [progressEntries.userId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
  meal: one(meals, {
    fields: [activityLogs.relatedMealId],
    references: [meals.id],
  }),
  workout: one(workouts, {
    fields: [activityLogs.relatedWorkoutId],
    references: [workouts.id],
  }),
  progress: one(progressEntries, {
    fields: [activityLogs.relatedProgressId],
    references: [progressEntries.id],
  }),
}));

export const friendRequestsRelations = relations(friendRequests, ({ one }) => ({
  sender: one(users, {
    fields: [friendRequests.senderId],
    references: [users.id],
    relationName: 'sender',
  }),
  receiver: one(users, {
    fields: [friendRequests.receiverId],
    references: [users.id],
    relationName: 'receiver',
  }),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  user1: one(users, {
    fields: [friendships.user1Id],
    references: [users.id],
    relationName: 'user1',
  }),
  user2: one(users, {
    fields: [friendships.user2Id],
    references: [users.id],
    relationName: 'user2',
  }),
}));

export const coachClientsRelations = relations(coachClients, ({ one }) => ({
  coach: one(users, {
    fields: [coachClients.coachId],
    references: [users.id],
    relationName: 'coach',
  }),
  client: one(users, {
    fields: [coachClients.clientId],
    references: [users.id],
    relationName: 'client',
  }),
}));

// workoutPlansRelations 已移除（表已廢棄）

export const exercisesRelations = relations(exercises, ({ one }) => ({
  createdByUser: one(users, {
    fields: [exercises.createdBy],
    references: [users.id],
    relationName: 'createdBy',
  }),
}));

export const workoutRoutinesRelations = relations(workoutRoutines, ({ one, many }) => ({
  coach: one(users, {
    fields: [workoutRoutines.coachId],
    references: [users.id],
    relationName: 'coach',
  }),
  client: one(users, {
    fields: [workoutRoutines.clientId],
    references: [users.id],
    relationName: 'client',
  }),
  routineExercises: many(routineExercises),
}));

export const routineExercisesRelations = relations(routineExercises, ({ one, many }) => ({
  routine: one(workoutRoutines, {
    fields: [routineExercises.routineId],
    references: [workoutRoutines.id],
  }),
  exercise: one(exercises, {
    fields: [routineExercises.exerciseId],
    references: [exercises.id],
  }),
  exerciseSets: many(exerciseSets),
}));

export const exerciseSetsRelations = relations(exerciseSets, ({ one }) => ({
  routineExercise: one(routineExercises, {
    fields: [exerciseSets.routineExerciseId],
    references: [routineExercises.id],
  }),
}));

export const workoutSessionsRelations = relations(workoutSessions, ({ one, many }) => ({
  learner: one(users, {
    fields: [workoutSessions.userId],
    references: [users.id],
  }),
  routine: one(workoutRoutines, {
    fields: [workoutSessions.routineId],
    references: [workoutRoutines.id],
  }),
  sessionExercises: many(sessionExercises),
  feedbacks: many(sessionFeedbacks),
}));

export const bodyCompositionLogsRelations = relations(bodyCompositionLogs, ({ one }) => ({
  user: one(users, {
    fields: [bodyCompositionLogs.userId],
    references: [users.id],
  }),
}));

export const sessionExercisesRelations = relations(sessionExercises, ({ one, many }) => ({
  session: one(workoutSessions, {
    fields: [sessionExercises.sessionId],
    references: [workoutSessions.id],
  }),
  sessionSets: many(sessionSets),
}));

export const sessionSetsRelations = relations(sessionSets, ({ one }) => ({
  sessionExercise: one(sessionExercises, {
    fields: [sessionSets.sessionExerciseId],
    references: [sessionExercises.id],
  }),
}));

export const sessionFeedbacksRelations = relations(sessionFeedbacks, ({ one }) => ({
  session: one(workoutSessions, {
    fields: [sessionFeedbacks.sessionId],
    references: [workoutSessions.id],
  }),
  trainer: one(users, {
    fields: [sessionFeedbacks.trainerId],
    references: [users.id],
    relationName: 'trainer',
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const userNotificationPreferencesRelations = relations(
  userNotificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [userNotificationPreferences.userId],
      references: [users.id],
    }),
  }),
);

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

// ==========================================
// 類型導出（供 TypeScript 使用）
// ==========================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;

export type InvitationTemplate = typeof invitationTemplates.$inferSelect;
export type NewInvitationTemplate = typeof invitationTemplates.$inferInsert;

// CoachClientRelationship types 已移除（統一使用 CoachClient）

export type Meal = typeof meals.$inferSelect;
export type NewMeal = typeof meals.$inferInsert;

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;

export type ProgressEntry = typeof progressEntries.$inferSelect;
export type NewProgressEntry = typeof progressEntries.$inferInsert;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;

export type FriendRequest = typeof friendRequests.$inferSelect;
export type NewFriendRequest = typeof friendRequests.$inferInsert;

export type Friendship = typeof friendships.$inferSelect;
export type NewFriendship = typeof friendships.$inferInsert;

export type CoachClient = typeof coachClients.$inferSelect;
export type NewCoachClient = typeof coachClients.$inferInsert;

// WorkoutPlan types 已移除（統一使用 WorkoutRoutine）

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
export type WorkoutRoutine = typeof workoutRoutines.$inferSelect;
export type NewWorkoutRoutine = typeof workoutRoutines.$inferInsert;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type NewRoutineExercise = typeof routineExercises.$inferInsert;
export type ExerciseSet = typeof exerciseSets.$inferSelect;
export type NewExerciseSet = typeof exerciseSets.$inferInsert;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type NewWorkoutSession = typeof workoutSessions.$inferInsert;
export type SessionExercise = typeof sessionExercises.$inferSelect;
export type NewSessionExercise = typeof sessionExercises.$inferInsert;
export type SessionSet = typeof sessionSets.$inferSelect;
export type NewSessionSet = typeof sessionSets.$inferInsert;
export type SessionFeedback = typeof sessionFeedbacks.$inferSelect;
export type NewSessionFeedback = typeof sessionFeedbacks.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type UserNotificationPreference = typeof userNotificationPreferences.$inferSelect;
export type NewUserNotificationPreference = typeof userNotificationPreferences.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;

export type BodyCompositionLog = typeof bodyCompositionLogs.$inferSelect;
export type NewBodyCompositionLog = typeof bodyCompositionLogs.$inferInsert;

export type EmailLog = typeof emailLogs.$inferSelect;
export type NewEmailLog = typeof emailLogs.$inferInsert;