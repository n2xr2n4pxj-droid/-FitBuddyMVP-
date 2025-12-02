// ==========================================
// FitBuddy - 完整數據庫架構
// Drizzle ORM + PostgreSQL (Neon)
// ==========================================
// 功能：
// - 用戶角色系統（USER、COACH、BOTH、ADMIN）
// - 教練-客戶邀請與關聯
// - TDEE 計算與追蹤
// - 飲食記錄
// - 訓練日誌
// - 進度追蹤
// - 朋友系統（Phase 3）
// ==========================================

import { sql } from 'drizzle-orm';
import { 
  pgTable, 
  varchar,
  text, 
  timestamp, 
  integer, 
  real, 
  boolean, 
  pgEnum,
  index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==========================================
// 枚舉類型定義
// ==========================================

// 用戶角色
export const roleEnum = pgEnum('role', ['USER', 'COACH', 'BOTH', 'ADMIN']);

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

// 教練客戶關聯狀態
export const relationshipStatusEnum = pgEnum('relationship_status', [
  'ACTIVE',    // 活躍
  'PAUSED',    // 暫停
  'TERMINATED' // 終止
]);

// 好友請求狀態（Phase 3）
export const friendRequestStatusEnum = pgEnum('friend_request_status', [
  'PENDING',
  'ACCEPTED',
  'REJECTED'
]);

// ==========================================
// 核心表格
// ==========================================

// 用戶表
export const users = pgTable('users', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').unique().notNull(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  
  // 角色與權限
  role: roleEnum('role').default('USER').notNull(),
  
  // 個人資料
  firstName: text('first_name'),
  lastName: text('last_name'),
  avatar: text('avatar'),
  phone: text('phone'),
  dateOfBirth: timestamp('date_of_birth', { withTimezone: true }),
  emailVerified: boolean('email_verified').default(false).notNull(),
  
  // TDEE 相關欄位
  age: integer('age'),
  gender: genderEnum('gender'),
  height: real('height'), // cm
  weight: real('weight'), // kg
  bodyFat: real('body_fat'), // %
  activityLevel: activityLevelEnum('activity_level'),
  goal: goalTypeEnum('goal'),
  
  // 計算結果（自動更新）
  bmr: real('bmr'), // 基礎代謝率
  tdee: real('tdee'), // 總能量消耗
  bmi: real('bmi'), // 身體質量指數
  goalCalories: real('goal_calories'), // 目標卡路里
  goalProtein: real('goal_protein'), // 目標蛋白質 (g)
  goalCarbs: real('goal_carbs'), // 目標碳水化合物 (g)
  goalFat: real('goal_fat'), // 目標脂肪 (g)
  
  // 時間戳
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  lastActive: timestamp('last_active', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  usernameIdx: index('users_username_idx').on(table.username),
  roleIdx: index('users_role_idx').on(table.role),
}));

// ==========================================
// 教練-客戶系統
// ==========================================

// 邀請表
export const invitations = pgTable('invitations', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  
  // 邀請方和接收方
  senderId: varchar('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  receiverEmail: text('receiver_email').notNull(), // 可能是未註冊用戶的 email
  receiverId: varchar('receiver_id').references(() => users.id, { onDelete: 'cascade' }), // 接收方註冊後關聯
  
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

// 教練-客戶關聯表
export const coachClientRelationships = pgTable('coach_client_relationships', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  
  // 關聯雙方
  coachId: varchar('coach_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  clientId: varchar('client_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
  // 關聯狀態
  status: relationshipStatusEnum('status').default('ACTIVE').notNull(),
  
  // 附加信息
  notes: text('notes'), // 教練對客戶的備註
  startDate: timestamp('start_date', { withTimezone: true }).defaultNow().notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  
  // 時間戳
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  coachIdx: index('coach_client_relationships_coach_idx').on(table.coachId),
  clientIdx: index('coach_client_relationships_client_idx').on(table.clientId),
  statusIdx: index('coach_client_relationships_status_idx').on(table.status),
  uniqueRelationship: index('coach_client_relationships_unique').on(table.coachId, table.clientId),
}));

// ==========================================
// 飲食與訓練系統
// ==========================================

// 飲食記錄表
export const meals = pgTable('meals', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
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
  userId: varchar('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
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
  
  // 詳細記錄（JSON 格式）
  exercises: text('exercises'), // JSON 字符串：[{ name, sets, reps, weight }]
  
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
  userId: varchar('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
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
  userId: varchar('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
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
  senderId: varchar('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  receiverId: varchar('receiver_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
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
  user1Id: varchar('user1_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  user2Id: varchar('user2_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  user1Idx: index('friendships_user1_idx').on(table.user1Id),
  user2Idx: index('friendships_user2_idx').on(table.user2Id),
  uniqueFriendship: index('friendships_unique').on(table.user1Id, table.user2Id),
}));

// ==========================================
// 關聯關係定義（Drizzle Relations）
// ==========================================

export const usersRelations = relations(users, ({ many }) => ({
  // 邀請關係
  sentInvitations: many(invitations, { relationName: 'sender' }),
  receivedInvitations: many(invitations, { relationName: 'receiver' }),
  
  // 教練-客戶關係
  myClients: many(coachClientRelationships, { relationName: 'coach' }),
  myCoaches: many(coachClientRelationships, { relationName: 'client' }),
  
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

export const coachClientRelationshipsRelations = relations(coachClientRelationships, ({ one }) => ({
  coach: one(users, {
    fields: [coachClientRelationships.coachId],
    references: [users.id],
    relationName: 'coach',
  }),
  client: one(users, {
    fields: [coachClientRelationships.clientId],
    references: [users.id],
    relationName: 'client',
  }),
}));

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

// ==========================================
// 類型導出（供 TypeScript 使用）
// ==========================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;

export type CoachClientRelationship = typeof coachClientRelationships.$inferSelect;
export type NewCoachClientRelationship = typeof coachClientRelationships.$inferInsert;

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