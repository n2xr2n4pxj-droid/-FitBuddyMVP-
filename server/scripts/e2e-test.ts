/**
 * FitBuddy E2E 測試腳本
 *
 * 流程：
 * 1. 健康檢查
 * 2. 初始狀態（未認證時的保護行為）
 * 3. 註冊 Coach
 * 4. 註冊 Client
 * 5. Coach 登入
 * 6. Coach 發邀請給 Client
 * 7. Client 登入
 * 8. Client 查看邀請
 * 9. Client (Amy) 接受 Coach (Gordon) 的邀請
 * 10. Coach views their active clients
 * 11. Client views their coaches
 * 12. Coach creates a Hevy-style workout routine for Client
 * 後續：Trainer Workout Tab API、Session 回饋、Plans tab smoke（POST /api/plans/assign → GET /api/plans/my）
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { db } from '../db';
import { users, invitations, coachClients, exercises, workoutRoutines } from '../db/schema';
import { eq, inArray, or } from 'drizzle-orm';

const BASE_URL = 'http://localhost:3000';
const TIMEOUT_MS = 5000;
const TOTAL_TESTS = 50;

/** Phase G：營養 API 固定香港曆日（與後端 HKT 區間一致） */
const PHASE_G_DATE = '2026-06-01';

const coachEmail = 'coach@test.com';
const clientEmail = 'amy@client.com';
const outsiderEmail = 'outsider@test.com';
const password = 'password123';

type TestFn = (ctx: TestContext) => Promise<void>;

interface TestContext {
  client: AxiosInstance;
  coachToken?: string;
  clientToken?: string;
  invitationId?: string;
  learnerId?: string;
  routineId?: string;
  learnerSessionId?: string;
  outsiderToken?: string;
  /** 專供 Test 26–29 CRUD，勿與指派 smoke 的 ctx.routineId 混用 */
  crudRoutineId?: string;
  /** Phase G：營養 log id */
  phaseGMealA?: string;
  phaseGMealB?: string;
}

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

async function resetDatabase() {
  console.log('\n🧹 Reset database: clearing coach_clients, invitations + test users');
  const testEmails = [
    coachEmail.toLowerCase(),
    clientEmail.toLowerCase(),
    outsiderEmail.toLowerCase(),
  ];
  const testUserRows = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, testEmails));
  const testIds = testUserRows.map((r) => r.id);
  if (testIds.length > 0) {
    await db
      .delete(coachClients)
      .where(
        or(
          inArray(coachClients.coachId, testIds),
          inArray(coachClients.clientId, testIds)
        )
      );
    await db
      .delete(workoutRoutines)
      .where(
        or(
          inArray(workoutRoutines.coachId, testIds),
          inArray(workoutRoutines.clientId, testIds)
        )
      );
  }
  await db.delete(invitations);
  await db.delete(users).where(inArray(users.email, testEmails));
}

/** 確保有一筆「Bench Press」動作並回傳其 id（供 Test 12 使用） */
async function ensureBenchPressExercise(): Promise<string> {
  const [existing] = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(eq(exercises.name, 'Bench Press'))
    .limit(1);
  if (existing) return existing.id;
  const [inserted] = await db
    .insert(exercises)
    .values({
      name: 'Bench Press',
      muscleGroup: 'Chest',
      equipment: 'Barbell',
      isCustom: false,
      createdBy: null,
    })
    .returning({ id: exercises.id });
  if (!inserted?.id) throw new Error('Failed to seed Bench Press exercise');
  return inserted.id;
}

async function markEmailVerified(email: string) {
  await db
    .update(users)
    .set({
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    })
    .where(eq(users.email, email.toLowerCase()));
}

async function runTest(
  idx: number,
  name: string,
  ctx: TestContext,
  fn: TestFn,
): Promise<TestResult> {
  const start = Date.now();
  console.log(`\n🧪 Test ${idx}/${TOTAL_TESTS} ${name}`);
  try {
    await fn(ctx);
    const durationMs = Date.now() - start;
    console.log(`✅ PASS (${(durationMs / 1000).toFixed(2)}s)`);
    return { id: idx, name, passed: true, durationMs };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const message =
      err?.message ||
      (typeof err === 'string' ? err : 'Unknown error');
    console.log(`❌ FAIL (${(durationMs / 1000).toFixed(2)}s) - ${message}`);
    return { id: idx, name, passed: false, durationMs, error: message };
  }
}

async function request(
  client: AxiosInstance,
  method: AxiosRequestConfig['method'],
  url: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
  } = {},
) {
  const { body, headers } = options;
  console.log(`📤 ${method} ${url}`);
  if (body !== undefined) {
    console.log('   body:', JSON.stringify(body));
  }

  try {
    const res = await client.request({
      method,
      url,
      data: body,
      headers,
    });
    console.log(
      '📥',
      res.status,
      res.statusText,
      JSON.stringify(res.data),
    );
    return res;
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.log('📥 CONNECTION ERROR: ECONNREFUSED (server not running?)');
    } else if (error.code === 'ECONNABORTED') {
      console.log('📥 TIMEOUT ERROR:', error.message);
    } else {
      console.log('📥 REQUEST ERROR:', error.message || String(error));
    }
    throw error;
  }
}

async function main() {
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: TIMEOUT_MS,
    validateStatus: () => true, // 我們手動判斷狀態碼
  });

  const ctx: TestContext = { client };

  const results: TestResult[] = [];

  const globalStart = Date.now();

  // 清理資料庫
  await resetDatabase();

  // Test 1: API 健康檢查
  results.push(
    await runTest(1, 'API Health Check', ctx, async ({ client }) => {
      const res = await request(client, 'GET', '/api/health');
      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}`);
      }
      if (!res.data || res.data.status !== 'ok') {
        throw new Error(`Expected body.status === "ok", got ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 2: 初始狀態（未認證，應回 401）
  results.push(
    await runTest(2, 'Initial state (unauthenticated)', ctx, async ({ client }) => {
      const resUsers = await request(client, 'GET', '/api/users');
      if (resUsers.status !== 401) {
        throw new Error(`Expected /api/users to return 401 when unauthenticated, got ${resUsers.status}`);
      }

      const resInv = await request(client, 'GET', '/api/invitations');
      if (resInv.status !== 401) {
        throw new Error(`Expected /api/invitations to return 401 when unauthenticated, got ${resInv.status}`);
      }
    }),
  );

  // Test 3: 註冊 Coach（Gordon）
  results.push(
    await runTest(3, 'Register Coach (Gordon)', ctx, async ({ client }) => {
      const body = {
        email: coachEmail,
        password,
        firstName: 'Gordon',
        lastName: 'Coach',
        role: 'COACH',
      };
      const res = await request(client, 'POST', '/api/auth/register', {
        body,
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.status !== 201) {
        throw new Error(`Expected status 201, got ${res.status}`);
      }
      if (!res.data?.user || res.data.user.email !== coachEmail) {
        throw new Error('Response user.email mismatch for coach registration');
      }

      // 直接標記 email 已驗證，避免測試中卡在驗證流程
      await markEmailVerified(coachEmail);
    }),
  );

  // Test 4: 註冊 Client（Amy）
  results.push(
    await runTest(4, 'Register Client (Amy)', ctx, async ({ client }) => {
      const body = {
        email: clientEmail,
        password,
        firstName: 'Amy',
        lastName: 'Client',
        role: 'CLIENT',
      };
      const res = await request(client, 'POST', '/api/auth/register', {
        body,
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.status !== 201) {
        throw new Error(`Expected status 201, got ${res.status}`);
      }
      if (!res.data?.user || res.data.user.email !== clientEmail) {
        throw new Error('Response user.email mismatch for client registration');
      }

      await markEmailVerified(clientEmail);
    }),
  );

  // Test 5: Coach 登入
  results.push(
    await runTest(5, 'Coach login', ctx, async (ctx) => {
      const res = await request(ctx.client, 'POST', '/api/auth/login', {
        body: { email: coachEmail, password },
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}`);
      }
      if (!res.data?.token || !res.data?.refreshToken) {
        throw new Error('Expected { token, refreshToken } in response');
      }

      ctx.coachToken = res.data.token;
    }),
  );

  // Test 6: Coach 發邀請給 Amy
  results.push(
    await runTest(6, 'Coach sends invitation to Amy', ctx, async (ctx) => {
      if (!ctx.coachToken) {
        throw new Error('Coach token not set from previous test');
      }

      const res = await request(ctx.client, 'POST', '/api/invitations', {
        body: { email: clientEmail },
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.coachToken}`,
        },
      });

      // 實際路由目前回傳 200；可接受 200 或 201
      if (res.status !== 200 && res.status !== 201) {
        throw new Error(`Expected status 200/201, got ${res.status}`);
      }
      if (!res.data?.id || res.data.receiverEmail?.toLowerCase() !== clientEmail.toLowerCase()) {
        throw new Error('Invitation response missing id or receiverEmail mismatch');
      }
      ctx.invitationId = res.data.id;
    }),
  );

  // Test 7: Amy 登入
  results.push(
    await runTest(7, 'Client login (Amy)', ctx, async (ctx) => {
      const res = await request(ctx.client, 'POST', '/api/auth/login', {
        body: { email: clientEmail, password },
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}`);
      }
      if (!res.data?.token || !res.data?.refreshToken) {
        throw new Error('Expected { token, refreshToken } in response');
      }

      ctx.clientToken = res.data.token;
    }),
  );

  // Test 8: Amy 查看邀請
  results.push(
    await runTest(8, 'Client views invitations', ctx, async (ctx) => {
      if (!ctx.clientToken) {
        throw new Error('Client token not set from previous test');
      }

      const res = await request(ctx.client, 'GET', '/api/invitations', {
        headers: {
          Authorization: `Bearer ${ctx.clientToken}`,
        },
      });

      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}`);
      }
      if (!Array.isArray(res.data)) {
        throw new Error('Expected response body to be an array');
      }

      const hasInvitation = res.data.some((inv: any) => {
        const email = inv.receiverEmail || inv.receiver_email;
        return email && email.toLowerCase() === clientEmail.toLowerCase();
      });

      if (!hasInvitation) {
        throw new Error('Expected at least one invitation for client email');
      }
    }),
  );

  // Test 9: Amy 接受 Gordon 的邀請
  results.push(
    await runTest(9, 'Client (Amy) accepts Coach (Gordon) invitation', ctx, async (ctx) => {
      if (!ctx.clientToken) {
        throw new Error('Client token not set from previous test');
      }
      if (!ctx.invitationId) {
        throw new Error('Invitation ID not set from Test 6');
      }

      const res = await request(ctx.client, 'POST', `/api/invitations/${ctx.invitationId}/accept`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.clientToken}`,
        },
      });

      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}: ${res.data?.error ?? JSON.stringify(res.data)}`);
      }
      if (!res.data?.message && !res.data?.relationship) {
        throw new Error('Expected response to contain message or relationship');
      }
    }),
  );

  // Test 10: Coach views their active clients
  results.push(
    await runTest(10, 'Coach views their active clients', ctx, async (ctx) => {
      if (!ctx.coachToken) {
        throw new Error('Coach token not set from previous test');
      }
      const res = await request(ctx.client, 'GET', '/api/coach/clients', {
        headers: { Authorization: `Bearer ${ctx.coachToken}` },
      });
      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}: ${res.data?.error ?? JSON.stringify(res.data)}`);
      }
      if (!Array.isArray(res.data)) {
        throw new Error('Expected response to be an array');
      }
      const hasAmy = res.data.some(
        (c: any) => (c.email || '').toLowerCase() === clientEmail.toLowerCase()
      );
      if (!hasAmy) {
        throw new Error(`Expected at least one client with email ${clientEmail}, got: ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 11: Client views their coaches
  results.push(
    await runTest(11, 'Client views their coaches', ctx, async (ctx) => {
      if (!ctx.clientToken) {
        throw new Error('Client token not set from previous test');
      }
      const res = await request(ctx.client, 'GET', '/api/client/coaches', {
        headers: { Authorization: `Bearer ${ctx.clientToken}` },
      });
      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}: ${res.data?.error ?? JSON.stringify(res.data)}`);
      }
      if (!Array.isArray(res.data)) {
        throw new Error('Expected response to be an array');
      }
      const hasGordon = res.data.some(
        (c: any) => (c.email || '').toLowerCase() === coachEmail.toLowerCase()
      );
      if (!hasGordon) {
        throw new Error(`Expected at least one coach with email ${coachEmail}, got: ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 12: Coach creates a Hevy-style workout routine for Client
  results.push(
    await runTest(12, 'Coach creates a Hevy-style workout routine for Client', ctx, async (ctx) => {
      if (!ctx.coachToken) {
        throw new Error('Coach token not set from previous test');
      }
      const benchPressId = await ensureBenchPressExercise();
      const [clientRow] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, clientEmail.toLowerCase()))
        .limit(1);
      if (!clientRow?.id) {
        throw new Error('Client (Amy) not found in database');
      }
      const body = {
        clientId: clientRow.id,
        name: 'Push Day',
        scheduledDate: '2026-03-10T00:00:00Z',
        exercises: [
          {
            exerciseId: benchPressId,
            order: 1,
            sets: [
              { setIndex: 1, setType: 'normal', targetWeight: 100, targetReps: 8 },
            ],
          },
        ],
      };
      const res = await request(ctx.client, 'POST', '/api/workouts/routines', {
        body,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.coachToken}`,
        },
      });
      if (res.status !== 201) {
        throw new Error(`Expected status 201, got ${res.status}: ${res.data?.error ?? JSON.stringify(res.data)}`);
      }
      if (!res.data?.id || res.data?.clientId !== clientRow.id) {
        throw new Error('Expected response to contain routine id and clientId');
      }
      ctx.learnerId = clientRow.id;
      ctx.routineId = res.data.id;
    }),
  );

  // Test 13: Learner 查詢 sessions 時，limit=0 應回 400
  results.push(
    await runTest(13, 'Learner sessions invalid limit=0 returns 400', ctx, async (ctx) => {
      if (!ctx.clientToken) {
        throw new Error('Client token not set from previous test');
      }

      const res = await request(ctx.client, 'GET', '/api/workouts/sessions/my?limit=0', {
        headers: {
          Authorization: `Bearer ${ctx.clientToken}`,
        },
      });

      if (res.status !== 400) {
        throw new Error(`Expected status 400, got ${res.status}`);
      }
    }),
  );

  // Test 14: Learner 查詢 sessions 時，limit=abc 應回 400
  results.push(
    await runTest(14, 'Learner sessions invalid limit=abc returns 400', ctx, async (ctx) => {
      if (!ctx.clientToken) {
        throw new Error('Client token not set from previous test');
      }

      const res = await request(ctx.client, 'GET', '/api/workouts/sessions/my?limit=abc', {
        headers: {
          Authorization: `Bearer ${ctx.clientToken}`,
        },
      });

      if (res.status !== 400) {
        throw new Error(`Expected status 400, got ${res.status}`);
      }
    }),
  );

  // Test 15: Learner 查詢 sessions 時，limit=1.5（非整數）應回 400
  results.push(
    await runTest(15, 'Learner sessions invalid limit=1.5 returns 400', ctx, async (ctx) => {
      if (!ctx.clientToken) {
        throw new Error('Client token not set from previous test');
      }

      const res = await request(ctx.client, 'GET', '/api/workouts/sessions/my?limit=1.5', {
        headers: {
          Authorization: `Bearer ${ctx.clientToken}`,
        },
      });

      if (res.status !== 400) {
        throw new Error(`Expected status 400, got ${res.status}`);
      }
    }),
  );

  // Test 16: TRAINER 讀取名下 LEARNER 列表（供 Workout Tab 選擇學員）
  results.push(
    await runTest(16, 'Trainer fetch my-learners for workout tab', ctx, async (ctx) => {
      if (!ctx.coachToken) {
        throw new Error('Coach token not set from previous test');
      }

      const res = await request(ctx.client, 'GET', '/api/coach-client/my-learners', {
        headers: {
          Authorization: `Bearer ${ctx.coachToken}`,
        },
      });

      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}`);
      }
      if (!Array.isArray(res.data)) {
        throw new Error('Expected learners response to be an array');
      }
      const learner = res.data.find((item: any) => String(item.email || '').toLowerCase() === clientEmail.toLowerCase())
        || res.data.find((item: any) => item.id === ctx.learnerId)
        || res.data[0];
      if (!learner?.id || !learner?.name || !learner?.avatarFallback || !learner?.status) {
        throw new Error(`Unexpected learner payload: ${JSON.stringify(learner)}`);
      }
      ctx.learnerId = learner.id;
    }),
  );

  // Test 17: LEARNER 建立一筆 Session（供 TRAINER Workout Tab 展開詳情）
  results.push(
    await runTest(17, 'Learner logs workout session for trainer smoke flow', ctx, async (ctx) => {
      if (!ctx.clientToken) {
        throw new Error('Client token not set from previous test');
      }
      if (!ctx.routineId) {
        throw new Error('Routine id not set from previous test');
      }
      const benchPressId = await ensureBenchPressExercise();

      const body = {
        routineId: ctx.routineId,
        notes: 'E2E trainer workout tab smoke',
        exercises: [
          {
            exerciseId: benchPressId,
            sets: [
              { weight: 60, reps: 8 },
              { weight: 62.5, reps: 6 },
            ],
          },
        ],
      };

      const res = await request(ctx.client, 'POST', '/api/workouts/sessions', {
        body,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.clientToken}`,
        },
      });

      if (res.status !== 201) {
        throw new Error(`Expected status 201, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (!res.data?.sessionId) {
        throw new Error(`Expected sessionId in response, got: ${JSON.stringify(res.data)}`);
      }
      ctx.learnerSessionId = res.data.sessionId;
    }),
  );

  // Test 18: TRAINER 讀 learner sessions + 單筆 detail（對應 UI：選 learner -> 展開詳情）
  results.push(
    await runTest(18, 'Trainer workout tab API/UI smoke (list then detail)', ctx, async (ctx) => {
      if (!ctx.coachToken) {
        throw new Error('Coach token not set from previous test');
      }
      if (!ctx.learnerId) {
        throw new Error('Learner id not set from previous test');
      }

      const listRes = await request(
        ctx.client,
        'GET',
        `/api/workouts/sessions/learner/${ctx.learnerId}?limit=10`,
        {
          headers: {
            Authorization: `Bearer ${ctx.coachToken}`,
          },
        }
      );

      if (listRes.status !== 200) {
        throw new Error(`Expected list status 200, got ${listRes.status}`);
      }
      if (!Array.isArray(listRes.data) || listRes.data.length === 0) {
        throw new Error(`Expected non-empty sessions list, got: ${JSON.stringify(listRes.data)}`);
      }

      const targetSession =
        listRes.data.find((s: any) => s.sessionId === ctx.learnerSessionId) ?? listRes.data[0];
      if (
        !targetSession?.sessionId ||
        !targetSession?.completedAt ||
        typeof targetSession?.completedSets !== 'number'
      ) {
        throw new Error(`Unexpected session list item for UI: ${JSON.stringify(targetSession)}`);
      }

      const detailRes = await request(
        ctx.client,
        'GET',
        `/api/workouts/sessions/learner/${ctx.learnerId}/${targetSession.sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${ctx.coachToken}`,
          },
        }
      );

      if (detailRes.status !== 200) {
        throw new Error(`Expected detail status 200, got ${detailRes.status}`);
      }
      if (!Array.isArray(detailRes.data?.exercises) || detailRes.data.exercises.length === 0) {
        throw new Error(`Expected detail.exercises for UI accordion, got: ${JSON.stringify(detailRes.data)}`);
      }
      if (!Array.isArray(detailRes.data.exercises[0]?.sets)) {
        throw new Error(`Expected exercise sets array in detail payload: ${JSON.stringify(detailRes.data)}`);
      }
    }),
  );

  // Test 19: TRAINER 查非名下 LEARNER 的 sessions/detail 應回 403
  results.push(
    await runTest(19, 'Trainer unauthorized learner sessions/detail returns 403', ctx, async (ctx) => {
      if (!ctx.coachToken) {
        throw new Error('Coach token not set from previous test');
      }
      const unauthorizedLearnerId = 'not-related-learner-id';

      const listRes = await request(
        ctx.client,
        'GET',
        `/api/workouts/sessions/learner/${unauthorizedLearnerId}?limit=10`,
        {
          headers: {
            Authorization: `Bearer ${ctx.coachToken}`,
          },
        }
      );
      if (listRes.status !== 403) {
        throw new Error(`Expected list status 403, got ${listRes.status}`);
      }

      const detailRes = await request(
        ctx.client,
        'GET',
        `/api/workouts/sessions/learner/${unauthorizedLearnerId}/${ctx.learnerSessionId || 'fake-session-id'}`,
        {
          headers: {
            Authorization: `Bearer ${ctx.coachToken}`,
          },
        }
      );
      if (detailRes.status !== 403) {
        throw new Error(`Expected detail status 403, got ${detailRes.status}`);
      }
    }),
  );

  // Test 20: TRAINER 查名下 LEARNER 的 sessions/detail 應回 200（授權對照）
  results.push(
    await runTest(20, 'Trainer authorized learner sessions/detail returns 200', ctx, async (ctx) => {
      if (!ctx.coachToken) {
        throw new Error('Coach token not set from previous test');
      }
      if (!ctx.learnerId) {
        throw new Error('Learner id not set from previous test');
      }

      const listRes = await request(
        ctx.client,
        'GET',
        `/api/workouts/sessions/learner/${ctx.learnerId}?limit=10`,
        {
          headers: {
            Authorization: `Bearer ${ctx.coachToken}`,
          },
        }
      );
      if (listRes.status !== 200) {
        throw new Error(`Expected list status 200, got ${listRes.status}`);
      }
      if (!Array.isArray(listRes.data) || listRes.data.length === 0) {
        throw new Error(`Expected non-empty sessions list, got: ${JSON.stringify(listRes.data)}`);
      }

      const targetSession =
        listRes.data.find((s: any) => s.sessionId === ctx.learnerSessionId) ?? listRes.data[0];
      if (!targetSession?.sessionId) {
        throw new Error(`Expected valid target session from list, got: ${JSON.stringify(targetSession)}`);
      }

      const detailRes = await request(
        ctx.client,
        'GET',
        `/api/workouts/sessions/learner/${ctx.learnerId}/${targetSession.sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${ctx.coachToken}`,
          },
        }
      );
      if (detailRes.status !== 200) {
        throw new Error(`Expected detail status 200, got ${detailRes.status}`);
      }
      if (!Array.isArray(detailRes.data?.exercises)) {
        throw new Error(`Expected detail.exercises array, got: ${JSON.stringify(detailRes.data)}`);
      }
    }),
  );

  // Test 21: TRAINER 送出教練點評
  results.push(
    await runTest(21, 'Trainer submits feedback for learner session', ctx, async (ctx) => {
      if (!ctx.coachToken) {
        throw new Error('Coach token not set from previous test');
      }
      if (!ctx.learnerSessionId) {
        throw new Error('Learner session id not set from previous test');
      }
      const content = '深蹲最後一組深度非常標準！';

      const res = await request(
        ctx.client,
        'POST',
        `/api/workouts/sessions/${ctx.learnerSessionId}/feedback`,
        {
          body: { content },
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ctx.coachToken}`,
          },
        }
      );

      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}`);
      }
      if (!res.data?.id || res.data?.content !== content) {
        throw new Error(`Expected feedback id/content in response, got: ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 22: LEARNER 可讀取 TRAINER 點評
  results.push(
    await runTest(22, 'Learner can read trainer feedback', ctx, async (ctx) => {
      if (!ctx.clientToken) {
        throw new Error('Client token not set from previous test');
      }
      if (!ctx.learnerSessionId) {
        throw new Error('Learner session id not set from previous test');
      }

      const res = await request(
        ctx.client,
        'GET',
        `/api/workouts/sessions/${ctx.learnerSessionId}/feedback`,
        {
          headers: {
            Authorization: `Bearer ${ctx.clientToken}`,
          },
        }
      );

      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}`);
      }
      if (!Array.isArray(res.data) || res.data.length === 0) {
        throw new Error(`Expected non-empty feedback array, got: ${JSON.stringify(res.data)}`);
      }
      const hasTargetFeedback = res.data.some(
        (item: any) => item.content === '深蹲最後一組深度非常標準！'
      );
      if (!hasTargetFeedback) {
        throw new Error(`Expected submitted feedback content in response, got: ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 23: 非關聯第三方不可讀取點評（403）
  results.push(
    await runTest(23, 'Unauthorized user cannot read feedback', ctx, async (ctx) => {
      if (!ctx.learnerSessionId) {
        throw new Error('Learner session id not set from previous test');
      }

      if (!ctx.outsiderToken) {
        const registerRes = await request(ctx.client, 'POST', '/api/auth/register', {
          body: {
            email: outsiderEmail,
            password,
            firstName: 'Outsider',
            lastName: 'User',
            role: 'CLIENT',
          },
          headers: { 'Content-Type': 'application/json' },
        });
        if (registerRes.status !== 201 && registerRes.status !== 409 && registerRes.status !== 400) {
          throw new Error(`Expected register status 201/400/409, got ${registerRes.status}`);
        }
        await markEmailVerified(outsiderEmail);

        const loginRes = await request(ctx.client, 'POST', '/api/auth/login', {
          body: { email: outsiderEmail, password },
          headers: { 'Content-Type': 'application/json' },
        });
        if (loginRes.status !== 200 || !loginRes.data?.token) {
          throw new Error(`Expected outsider login 200 with token, got ${loginRes.status}`);
        }
        ctx.outsiderToken = loginRes.data.token;
      }

      const res = await request(
        ctx.client,
        'GET',
        `/api/workouts/sessions/${ctx.learnerSessionId}/feedback`,
        {
          headers: {
            Authorization: `Bearer ${ctx.outsiderToken}`,
          },
        }
      );

      if (res.status !== 403) {
        throw new Error(`Expected status 403, got ${res.status}`);
      }
    }),
  );

  // Test 24: TRAINER 指派課表（對應 UI：Plans / 指派計畫 Modal → POST /api/plans/assign）
  results.push(
    await runTest(24, 'Trainer assigns plan to learner (POST /api/plans/assign)', ctx, async (ctx) => {
      if (!ctx.coachToken) {
        throw new Error('Coach token not set from previous test');
      }
      if (!ctx.learnerId) {
        throw new Error('Learner id not set from previous test');
      }
      if (!ctx.routineId) {
        throw new Error('Routine id not set from previous test');
      }
      const res = await request(ctx.client, 'POST', '/api/plans/assign', {
        body: {
          routineId: String(ctx.routineId),
          learnerId: String(ctx.learnerId),
        },
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.coachToken}`,
        },
      });
      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (!res.data?.success) {
        throw new Error(`Expected { success: true }, got ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 25: LEARNER 即時在「我的課表」看到指派（GET /api/plans/my；對應 ClientRouter tab plans）
  results.push(
    await runTest(25, 'Learner sees assigned plan in GET /api/plans/my (trainerName)', ctx, async (ctx) => {
      if (!ctx.clientToken) {
        throw new Error('Client token not set from previous test');
      }
      if (!ctx.routineId) {
        throw new Error('Routine id not set from previous test');
      }
      const res = await request(ctx.client, 'GET', '/api/plans/my', {
        headers: { Authorization: `Bearer ${ctx.clientToken}` },
      });
      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (!Array.isArray(res.data)) {
        throw new Error(`Expected array body, got ${JSON.stringify(res.data)}`);
      }
      const assigned = res.data.find(
        (p: any) => String(p?.id) === String(ctx.routineId) && p?.isOwn === false,
      );
      if (!assigned) {
        throw new Error(
          `Expected assigned entry for routineId=${ctx.routineId}, got ${JSON.stringify(res.data)}`,
        );
      }
      if (!String(assigned.trainerName ?? '').trim()) {
        throw new Error(`Expected trainerName on assigned plan, got ${JSON.stringify(assigned)}`);
      }
    }),
  );

  // Test 26: TRAINER 建立新課表（POST）— 與 Test 12 Push Day 分開，供後續 PATCH/DELETE
  results.push(
    await runTest(26, 'Trainer creates plan for CRUD (POST /api/workouts/routines)', ctx, async (ctx) => {
      if (!ctx.coachToken) throw new Error('Coach token not set');
      if (!ctx.learnerId) throw new Error('Learner id not set');
      const benchPressId = await ensureBenchPressExercise();
      const body = {
        clientId: ctx.learnerId,
        name: 'E2E CRUD Plan',
        notes: 'e2e crud',
        exercises: [
          {
            exerciseId: benchPressId,
            order: 1,
            restTimerSeconds: 90,
            sets: [{ setIndex: 1, setType: 'normal', targetWeight: 40, targetReps: 10 }],
          },
        ],
      };
      const res = await request(ctx.client, 'POST', '/api/workouts/routines', {
        body,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.coachToken}`,
        },
      });
      if (res.status !== 201) {
        throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (!res.data?.id) throw new Error(`Expected id in body, got ${JSON.stringify(res.data)}`);
      ctx.crudRoutineId = res.data.id;
    }),
  );

  // Test 27: TRAINER 更新課表（PATCH）
  results.push(
    await runTest(27, 'Trainer updates plan (PATCH /api/workouts/routines/:id)', ctx, async (ctx) => {
      if (!ctx.coachToken) throw new Error('Coach token not set');
      if (!ctx.crudRoutineId) throw new Error('crudRoutineId not set');
      const newName = 'E2E CRUD Plan Updated';
      const res = await request(ctx.client, 'PATCH', `/api/workouts/routines/${ctx.crudRoutineId}`, {
        body: { name: newName },
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.coachToken}`,
        },
      });
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (String(res.data?.name) !== newName) {
        throw new Error(`Expected name ${newName}, got ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 28: TRAINER 軟刪除課表（DELETE）
  results.push(
    await runTest(28, 'Trainer soft-deletes plan (DELETE /api/workouts/routines/:id)', ctx, async (ctx) => {
      if (!ctx.coachToken) throw new Error('Coach token not set');
      if (!ctx.crudRoutineId) throw new Error('crudRoutineId not set');
      const res = await request(ctx.client, 'DELETE', `/api/workouts/routines/${ctx.crudRoutineId}`, {
        headers: { Authorization: `Bearer ${ctx.coachToken}` },
      });
      if (res.status !== 204) {
        throw new Error(`Expected 204, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 29: 已刪除課表不出現在 GET /api/plans/available
  results.push(
    await runTest(29, 'Deleted plan not in GET /api/plans/available', ctx, async (ctx) => {
      if (!ctx.coachToken) throw new Error('Coach token not set');
      if (!ctx.crudRoutineId) throw new Error('crudRoutineId not set');
      const res = await request(ctx.client, 'GET', '/api/plans/available', {
        headers: { Authorization: `Bearer ${ctx.coachToken}` },
      });
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}`);
      }
      if (!Array.isArray(res.data)) {
        throw new Error(`Expected array, got ${JSON.stringify(res.data)}`);
      }
      const found = res.data.some((p: any) => String(p?.id) === String(ctx.crudRoutineId));
      if (found) {
        throw new Error(`Deleted routine ${ctx.crudRoutineId} should not appear in available list`);
      }
    }),
  );

  // Test 30: Route-order regression（/api/plans/available 不應被 /:routineId 吃掉）
  results.push(
    await runTest(30, 'Route-order regression for GET /api/plans/available', ctx, async (ctx) => {
      if (!ctx.coachToken) throw new Error('Coach token not set');
      const res = await request(ctx.client, 'GET', '/api/plans/available', {
        headers: { Authorization: `Bearer ${ctx.coachToken}` },
      });
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (!Array.isArray(res.data)) {
        throw new Error(`Expected array payload, got ${JSON.stringify(res.data)}`);
      }
      const hasAvailableAsId = res.data.some(
        (item: any) =>
          String(item?.routineId ?? '').toLowerCase() === 'available' ||
          String(item?.id ?? '').toLowerCase() === 'available',
      );
      if (hasAvailableAsId) {
        throw new Error('Invalid payload: found routineId/id === "available" in /api/plans/available response');
      }
      const maybeErrorBody = res.data as { error?: string } | null;
      if (maybeErrorBody?.error === 'Plan not found') {
        throw new Error('Route collision detected: /api/plans/available was handled as /plans/:routineId');
      }
    }),
  );

  // Test 31: LEARNER dashboard overview 基本 shape
  results.push(
    await runTest(31, 'Learner dashboard overview basic shape', ctx, async (ctx) => {
      if (!ctx.clientToken) throw new Error('Client token not set');
      if (!ctx.learnerId) throw new Error('Learner id not set');
      const res = await request(ctx.client, 'GET', '/api/dashboard/learner/overview', {
        headers: { Authorization: `Bearer ${ctx.clientToken}` },
      });
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (!res.data?.learnerId) {
        throw new Error(`Expected learnerId, got ${JSON.stringify(res.data)}`);
      }
      if (String(res.data.learnerId) !== String(ctx.learnerId)) {
        throw new Error(`learnerId mismatch: expected ${ctx.learnerId}, got ${res.data.learnerId}`);
      }
      const today = String(res.data?.today ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
        throw new Error(`Expected today as yyyy-mm-dd, got ${today}`);
      }
    }),
  );

  // Test 32: LEARNER dashboard overview 含 session + feedback + plan
  results.push(
    await runTest(32, 'Learner dashboard includes session feedback and active plan', ctx, async (ctx) => {
      if (!ctx.clientToken) throw new Error('Client token not set');
      if (!ctx.learnerSessionId) throw new Error('Learner session id not set');
      if (!ctx.routineId) throw new Error('Routine id not set');
      const res = await request(ctx.client, 'GET', '/api/dashboard/learner/overview', {
        headers: { Authorization: `Bearer ${ctx.clientToken}` },
      });
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      const latestSessionId = String(res.data?.latestSession?.id ?? '');
      if (latestSessionId !== String(ctx.learnerSessionId)) {
        throw new Error(
          `Expected latestSession.id=${ctx.learnerSessionId}, got ${latestSessionId || '<empty>'}`,
        );
      }
      if (!res.data?.latestCoachFeedback) {
        throw new Error(`Expected latestCoachFeedback, got ${JSON.stringify(res.data)}`);
      }
      if (!String(res.data.latestCoachFeedback.coachName ?? '').trim()) {
        throw new Error(`Expected latestCoachFeedback.coachName, got ${JSON.stringify(res.data.latestCoachFeedback)}`);
      }
      const activeRoutineId = String(res.data?.activePlanPreview?.routineId ?? '');
      if (activeRoutineId !== String(ctx.routineId)) {
        throw new Error(
          `Expected activePlanPreview.routineId=${ctx.routineId}, got ${activeRoutineId || '<empty>'}`,
        );
      }
    }),
  );

  // Test 33: 新用戶首次 GET /api/notifications/preferences 會自動建立預設值
  results.push(
    await runTest(33, 'Create notification preferences default on first GET', ctx, async (ctx) => {
      const email = 'notif-new@test.com';
      const registerRes = await request(ctx.client, 'POST', '/api/auth/register', {
        body: {
          email,
          password,
          firstName: 'Notif',
          lastName: 'User',
          role: 'CLIENT',
        },
        headers: { 'Content-Type': 'application/json' },
      });
      if (registerRes.status !== 201 && registerRes.status !== 409) {
        throw new Error(`Expected 201/409, got ${registerRes.status}`);
      }
      await markEmailVerified(email);

      const loginRes = await request(ctx.client, 'POST', '/api/auth/login', {
        body: { email, password },
        headers: { 'Content-Type': 'application/json' },
      });
      if (loginRes.status !== 200 || !loginRes.data?.token) {
        throw new Error(`Expected login 200 with token, got ${loginRes.status}`);
      }

      const prefRes = await request(ctx.client, 'GET', '/api/notifications/preferences', {
        headers: { Authorization: `Bearer ${loginRes.data.token}` },
      });
      if (prefRes.status !== 200) {
        throw new Error(`Expected 200, got ${prefRes.status}: ${JSON.stringify(prefRes.data)}`);
      }
      if (prefRes.data?.workoutRemindersEnabled !== true) {
        throw new Error(`Expected workoutRemindersEnabled=true, got ${JSON.stringify(prefRes.data)}`);
      }
      if (prefRes.data?.marketingEnabled !== false) {
        throw new Error(`Expected marketingEnabled=false, got ${JSON.stringify(prefRes.data)}`);
      }
    }),
  );

  // Test 34: plan assigned 後 learner 可在 /api/notifications/my 看到通知
  results.push(
    await runTest(34, 'Plan assigned creates notification row', ctx, async (ctx) => {
      if (!ctx.coachToken) throw new Error('Coach token not set');
      if (!ctx.clientToken) throw new Error('Client token not set');
      if (!ctx.routineId) throw new Error('Routine id not set');
      if (!ctx.learnerId) throw new Error('Learner id not set');

      const assignRes = await request(ctx.client, 'POST', '/api/plans/assign', {
        body: { routineId: ctx.routineId, learnerId: ctx.learnerId },
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.coachToken}`,
        },
      });
      if (assignRes.status !== 200) {
        throw new Error(`Expected assign 200, got ${assignRes.status}: ${JSON.stringify(assignRes.data)}`);
      }

      const myRes = await request(ctx.client, 'GET', '/api/notifications/my?limit=20', {
        headers: { Authorization: `Bearer ${ctx.clientToken}` },
      });
      if (myRes.status !== 200) {
        throw new Error(`Expected 200, got ${myRes.status}: ${JSON.stringify(myRes.data)}`);
      }
      const list = Array.isArray(myRes.data?.notifications) ? myRes.data.notifications : [];
      const match = list.find(
        (n: any) => n?.type === 'plan_assigned' && String(n?.data?.routineId ?? '') === String(ctx.routineId),
      );
      if (!match) {
        throw new Error(`Expected plan_assigned notification for routine ${ctx.routineId}, got ${JSON.stringify(list)}`);
      }
      if (!String(match.linkUrl ?? '').includes(`/client/plans?routineId=${ctx.routineId}`)) {
        throw new Error(`Expected linkUrl with routineId, got ${JSON.stringify(match)}`);
      }
    }),
  );

  // Test 35: session feedback 後 learner 可在 /api/notifications/my 看到通知
  results.push(
    await runTest(35, 'Session feedback creates notification row', ctx, async (ctx) => {
      if (!ctx.coachToken) throw new Error('Coach token not set');
      if (!ctx.clientToken) throw new Error('Client token not set');
      if (!ctx.learnerSessionId) throw new Error('Learner session id not set');

      const feedbackRes = await request(
        ctx.client,
        'POST',
        `/api/workouts/sessions/${ctx.learnerSessionId}/feedback`,
        {
          body: { content: '通知測試：本次動作節奏很好' },
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ctx.coachToken}`,
          },
        },
      );
      if (feedbackRes.status !== 200) {
        throw new Error(`Expected feedback 200, got ${feedbackRes.status}: ${JSON.stringify(feedbackRes.data)}`);
      }

      const myRes = await request(ctx.client, 'GET', '/api/notifications/my?limit=20', {
        headers: { Authorization: `Bearer ${ctx.clientToken}` },
      });
      if (myRes.status !== 200) {
        throw new Error(`Expected 200, got ${myRes.status}: ${JSON.stringify(myRes.data)}`);
      }
      const list = Array.isArray(myRes.data?.notifications) ? myRes.data.notifications : [];
      const match = list.find(
        (n: any) =>
          n?.type === 'session_feedback' &&
          String(n?.data?.sessionId ?? '') === String(ctx.learnerSessionId),
      );
      if (!match) {
        throw new Error(
          `Expected session_feedback notification for session ${ctx.learnerSessionId}, got ${JSON.stringify(list)}`,
        );
      }
    }),
  );

  // Test 36: learner POST body composition → 201
  results.push(
    await runTest(36, 'Learner creates body composition log', ctx, async (ctx) => {
      if (!ctx.clientToken) throw new Error('Client token not set');
      if (!ctx.learnerId) throw new Error('Learner id not set');

      const measuredAt = new Date('2026-03-15T10:00:00.000Z').toISOString();
      const res = await request(ctx.client, 'POST', '/api/analytics/body-composition', {
        body: {
          measuredAt,
          weight: 65.5,
          bodyFatPct: 18.2,
          muscleMass: 28.0,
        },
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.clientToken}`,
        },
      });
      if (res.status !== 201) {
        throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (!res.data?.id || String(res.data.userId) !== String(ctx.learnerId)) {
        throw new Error(`Unexpected body: ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 37: GET body-composition list ascending by measuredAt
  results.push(
    await runTest(37, 'GET body-composition returns sorted logs', ctx, async (ctx) => {
      if (!ctx.clientToken) throw new Error('Client token not set');
      if (!ctx.learnerId) throw new Error('Learner id not set');

      const res = await request(
        ctx.client,
        'GET',
        `/api/analytics/body-composition/${encodeURIComponent(String(ctx.learnerId))}`,
        {
          headers: { Authorization: `Bearer ${ctx.clientToken}` },
        },
      );
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (!Array.isArray(res.data)) {
        throw new Error(`Expected array, got ${JSON.stringify(res.data)}`);
      }
      if (res.data.length < 1) {
        throw new Error('Expected at least one body composition log');
      }
      let prev = '';
      for (const row of res.data) {
        const t = String(row?.measuredAt ?? '');
        if (t && prev && t < prev) {
          throw new Error(`measuredAt not ascending: ${prev} then ${t}`);
        }
        if (t) prev = t;
      }
    }),
  );

  // Test 38: GET workout-volume weeks=8 shape
  results.push(
    await runTest(38, 'GET workout-volume returns weekly buckets', ctx, async (ctx) => {
      if (!ctx.clientToken) throw new Error('Client token not set');
      if (!ctx.learnerId) throw new Error('Learner id not set');

      const res = await request(
        ctx.client,
        'GET',
        `/api/analytics/workout-volume/${encodeURIComponent(String(ctx.learnerId))}?weeks=8`,
        {
          headers: { Authorization: `Bearer ${ctx.clientToken}` },
        },
      );
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (!Array.isArray(res.data) || res.data.length !== 8) {
        throw new Error(`Expected 8 weeks, got ${JSON.stringify(res.data)}`);
      }
      for (const w of res.data) {
        if (typeof w?.weekLabel !== 'string' || !w.weekLabel) {
          throw new Error(`Bad weekLabel: ${JSON.stringify(w)}`);
        }
        if (typeof w?.sessionCount !== 'number' || typeof w?.totalSets !== 'number') {
          throw new Error(`Bad counts: ${JSON.stringify(w)}`);
        }
      }
    }),
  );

  // Test 39: coach can read learner body-composition
  results.push(
    await runTest(39, 'Coach reads learner body-composition', ctx, async (ctx) => {
      if (!ctx.coachToken) throw new Error('Coach token not set');
      if (!ctx.learnerId) throw new Error('Learner id not set');

      const res = await request(
        ctx.client,
        'GET',
        `/api/analytics/body-composition/${encodeURIComponent(String(ctx.learnerId))}`,
        {
          headers: { Authorization: `Bearer ${ctx.coachToken}` },
        },
      );
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (!Array.isArray(res.data)) {
        throw new Error(`Expected array, got ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 40: unrelated learner cannot read another user's body-composition
  results.push(
    await runTest(40, 'Outsider forbidden on other user body-composition', ctx, async (ctx) => {
      if (!ctx.outsiderToken) {
        throw new Error('Outsider token not set (run after Test 23)');
      }
      if (!ctx.learnerId) throw new Error('Learner id not set');

      const res = await request(
        ctx.client,
        'GET',
        `/api/analytics/body-composition/${encodeURIComponent(String(ctx.learnerId))}`,
        {
          headers: { Authorization: `Bearer ${ctx.outsiderToken}` },
        },
      );
      if (res.status !== 403) {
        throw new Error(`Expected 403, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 41: 未帶 JWT 無法取得營養紀錄
  results.push(
    await runTest(41, 'GET nutrition logs/my without token returns 401', ctx, async ({ client }) => {
      const res = await request(
        client,
        'GET',
        `/api/nutrition/logs/my?date=${encodeURIComponent(PHASE_G_DATE)}`,
      );
      if (res.status !== 401) {
        throw new Error(`Expected 401, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 42: 學員建立第一筆飲食 log
  results.push(
    await runTest(42, 'Learner POST nutrition log (meal A)', ctx, async (ctx) => {
      if (!ctx.clientToken) throw new Error('Client token not set');
      const res = await request(ctx.client, 'POST', '/api/nutrition/logs', {
        body: {
          logDate: PHASE_G_DATE,
          mealType: 'breakfast',
          description: 'E2E meal A',
          calories: 100,
          protein: 10,
          carbs: 12,
          fat: 5,
        },
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.clientToken}`,
        },
      });
      if (res.status !== 201) {
        throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      const id = String(res.data?.id ?? '');
      if (!id) throw new Error(`Missing meal id: ${JSON.stringify(res.data)}`);
      ctx.phaseGMealA = id;
    }),
  );

  // Test 43: GET summary 與單筆加總一致
  results.push(
    await runTest(43, 'GET nutrition summary matches meal A', ctx, async (ctx) => {
      if (!ctx.clientToken) throw new Error('Client token not set');
      const res = await request(
        ctx.client,
        'GET',
        `/api/nutrition/logs/my?date=${encodeURIComponent(PHASE_G_DATE)}`,
        { headers: { Authorization: `Bearer ${ctx.clientToken}` } },
      );
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      const sum = res.data?.summary;
      if (!sum || sum.totalCalories !== 100 || sum.totalProtein !== 10) {
        throw new Error(`Unexpected summary: ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 44: 第二筆 log
  results.push(
    await runTest(44, 'Learner POST nutrition log (meal B)', ctx, async (ctx) => {
      if (!ctx.clientToken) throw new Error('Client token not set');
      const res = await request(ctx.client, 'POST', '/api/nutrition/logs', {
        body: {
          logDate: PHASE_G_DATE,
          mealType: 'lunch',
          description: 'E2E meal B',
          calories: 200,
          protein: 20,
          carbs: 25,
          fat: 8,
        },
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.clientToken}`,
        },
      });
      if (res.status !== 201) {
        throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      const id = String(res.data?.id ?? '');
      if (!id) throw new Error(`Missing meal id: ${JSON.stringify(res.data)}`);
      ctx.phaseGMealB = id;
    }),
  );

  // Test 45: 兩筆加總
  results.push(
    await runTest(45, 'GET nutrition summary sums two meals', ctx, async (ctx) => {
      if (!ctx.clientToken) throw new Error('Client token not set');
      const res = await request(
        ctx.client,
        'GET',
        `/api/nutrition/logs/my?date=${encodeURIComponent(PHASE_G_DATE)}`,
        { headers: { Authorization: `Bearer ${ctx.clientToken}` } },
      );
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      const sum = res.data?.summary;
      if (!sum || sum.totalCalories !== 300 || sum.totalProtein !== 30) {
        throw new Error(`Unexpected summary: ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 46: DELETE 第一筆
  results.push(
    await runTest(46, 'Learner DELETE first nutrition log', ctx, async (ctx) => {
      if (!ctx.clientToken) throw new Error('Client token not set');
      if (!ctx.phaseGMealA) throw new Error('phaseGMealA not set');
      const res = await request(
        ctx.client,
        'DELETE',
        `/api/nutrition/logs/${encodeURIComponent(ctx.phaseGMealA)}`,
        { headers: { Authorization: `Bearer ${ctx.clientToken}` } },
      );
      if (res.status !== 204) {
        throw new Error(`Expected 204, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 47: 刪除後加總僅剩 meal B
  results.push(
    await runTest(47, 'GET summary after delete reflects remaining meal', ctx, async (ctx) => {
      if (!ctx.clientToken) throw new Error('Client token not set');
      const res = await request(
        ctx.client,
        'GET',
        `/api/nutrition/logs/my?date=${encodeURIComponent(PHASE_G_DATE)}`,
        { headers: { Authorization: `Bearer ${ctx.clientToken}` } },
      );
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      const sum = res.data?.summary;
      if (!sum || sum.totalCalories !== 200 || sum.totalProtein !== 20) {
        throw new Error(`Unexpected summary: ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 48: 教練可讀學員當日營養
  results.push(
    await runTest(48, 'Coach GET client nutrition logs returns 200', ctx, async (ctx) => {
      if (!ctx.coachToken) throw new Error('Coach token not set');
      if (!ctx.learnerId) throw new Error('Learner id not set');
      const res = await request(
        ctx.client,
        'GET',
        `/api/coach/clients/${encodeURIComponent(String(ctx.learnerId))}/nutrition/logs?date=${encodeURIComponent(PHASE_G_DATE)}`,
        { headers: { Authorization: `Bearer ${ctx.coachToken}` } },
      );
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      const sum = res.data?.summary;
      if (!sum || sum.totalCalories !== 200) {
        throw new Error(`Unexpected coach summary: ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 49: 刪除剩餘 log（清理）
  results.push(
    await runTest(49, 'Learner DELETE second nutrition log', ctx, async (ctx) => {
      if (!ctx.clientToken) throw new Error('Client token not set');
      if (!ctx.phaseGMealB) throw new Error('phaseGMealB not set');
      const res = await request(
        ctx.client,
        'DELETE',
        `/api/nutrition/logs/${encodeURIComponent(ctx.phaseGMealB)}`,
        { headers: { Authorization: `Bearer ${ctx.clientToken}` } },
      );
      if (res.status !== 204) {
        throw new Error(`Expected 204, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // Test 50: 外人無法以教練端路徑讀他人營養
  results.push(
    await runTest(50, 'Outsider forbidden on coach client nutrition logs', ctx, async (ctx) => {
      if (!ctx.outsiderToken) throw new Error('Outsider token not set');
      if (!ctx.learnerId) throw new Error('Learner id not set');
      const res = await request(
        ctx.client,
        'GET',
        `/api/coach/clients/${encodeURIComponent(String(ctx.learnerId))}/nutrition/logs?date=${encodeURIComponent(PHASE_G_DATE)}`,
        { headers: { Authorization: `Bearer ${ctx.outsiderToken}` } },
      );
      if (res.status !== 403) {
        throw new Error(`Expected 403, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
    }),
  );

  // 總結
  const totalDurationMs = Date.now() - globalStart;
  const passedCount = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);

  console.log('\n==============================');
  if (failed.length === 0) {
    console.log(
      `✅ ${passedCount}/${TOTAL_TESTS} tests passed in ${(totalDurationMs / 1000).toFixed(2)}s`,
    );
  } else {
    console.log(
      `❌ ${passedCount}/${TOTAL_TESTS} tests passed in ${(totalDurationMs / 1000).toFixed(2)}s`,
    );
    console.log('Failed tests:', failed.map((f) => `Test ${f.id} - ${f.name}`).join(', '));
  }

  // 設定退出碼
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

// 直接執行
main().catch((err) => {
  console.error('Unexpected error in E2E script:', err);
  process.exitCode = 1;
});

