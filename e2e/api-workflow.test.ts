// e2e/api-workflow.test.ts
//
// 純 API + DB 的自動化測試：完整 FitBuddy workout flow
// - Coach (Gordon) 建課表 → 指定給 Client (Amy)
// - Client 查看 upcoming routine → TRAINER POST /api/plans/assign → LEARNER GET /api/plans/my（Plans tab smoke）
// - Client 視為完成 → 要求 AI workout-summary
// - 最後直接查 Postgres 驗證 workout_routines 資料是否一致
//
// 依賴：
// - Node.js 18+（內建 fetch）
// - pg: npm install pg
// - vitest: npm install -D vitest
//
// 執行方式（範例）：
//   DATABASE_URL=postgresql://... npx vitest run e2e/api-workflow.test.ts
//
// AI 步驟：
// - 若後端已設定 GEMINI_API_KEY，會實際呼叫 /api/ai/generate-routine 與 /api/ai/workout-summary
// - 若未設定（回傳 500 且訊息含 GEMINI_API_KEY），自動改用手寫課表骨架，並略過 AI 總結（仍驗證課表 API + DB）
//

import { test } from "vitest";
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import dns from "node:dns/promises";

// 讓腳本在任何 working directory 下都能自動載入 server/.env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: path.resolve(__dirname, "..", "server", ".env.local"),
  override: false,
});

const API_BASE = process.env.API_BASE_URL || "http://localhost:3000";
const DB_URL = process.env.DATABASE_URL?.trim();
const REQUEST_TIMEOUT_MS = Number(process.env.E2E_REQUEST_TIMEOUT_MS || 10000);
let DB_HOSTNAME: string | null = null;
try {
  if (DB_URL) {
    // 僅顯示 hostname，避免洩漏密碼
    DB_HOSTNAME = new URL(DB_URL).hostname;
  }
} catch {
  DB_HOSTNAME = null;
}
// 安全保護：避免後續不小心 console.log process.env.DATABASE_URL 時洩漏敏感資訊
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "";
}

// E2E 可配置：
// - E2E_REQUIRE_DB=true  : 必須可連到 DB 並做 workout_routines 一致性驗證（預設）
// - E2E_REQUIRE_DB=false : 若 pg 連線/Node DNS 失敗，仍允許跑 API flow，但跳過 DB 驗證
const REQUIRE_DB = process.env.E2E_REQUIRE_DB !== "false";
const ALLOW_DB_SKIP = !REQUIRE_DB;

// 與 server/scripts/e2e-test.ts 對齊的測試帳號
const COACH_EMAIL = "coach@test.com"; // Gordon
const CLIENT_EMAIL = "amy@client.com"; // Amy
const PASSWORD = "password123";

// 簡單的 fetch helper：檢查 HTTP status，錯誤時丟出
async function httpJson<T>(
  url: string,
  options: RequestInit & { expectedStatus?: number | number[] } = {},
): Promise<T> {
  const { expectedStatus, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  const okStatuses =
    expectedStatus == null
      ? [200]
      : Array.isArray(expectedStatus)
      ? expectedStatus
      : [expectedStatus];

  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }

  if (!okStatuses.includes(res.status)) {
    throw new Error(
      `HTTP ${res.status} ${res.statusText} for ${url} - body: ${
        text || "<empty>"
      }`,
    );
  }
  return json as T;
}

type AiRoutineScaffold = {
  name: string;
  notes: string;
  exercises: {
    exerciseName: string;
    sets: {
      targetWeight: number | null;
      targetReps: number | null;
      targetRpe: number | null;
    }[];
  }[];
};

/** 後端未設定 Gemini 時使用的固定骨架（與 AI 回傳 shape 一致） */
const FALLBACK_AI_ROUTINE: AiRoutineScaffold = {
  name: "E2E 推胸測試課表（無 AI）",
  notes: "後端未設定 GEMINI_API_KEY，使用固定骨架；設定金鑰後可改走真實 AI。",
  exercises: [
    {
      exerciseName: "Bench Press",
      sets: [
        { targetWeight: 60, targetReps: 8, targetRpe: 8 },
      ],
    },
  ],
};

function isGeminiNotConfiguredError(bodyText: string): boolean {
  return (
    bodyText.includes("GEMINI_API_KEY") ||
    bodyText.includes("VITE_GEMINI_API_KEY") ||
    bodyText.includes("not configured on the server")
  );
}

/** 嘗試呼叫 generate-routine；若因未設定 API key 失敗則回傳 fallback */
async function tryGenerateRoutineOrFallback(
  coachToken: string,
): Promise<{ routine: AiRoutineScaffold; usedAi: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/ai/generate-routine`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${coachToken}`,
      },
      body: JSON.stringify({
        prompt: "針對新手的45分鐘推胸訓練（API e2e 測試）",
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  if (res.status === 200) {
    try {
      const routine = JSON.parse(text) as AiRoutineScaffold;
      if (routine?.name && Array.isArray(routine.exercises)) {
        return { routine, usedAi: true };
      }
    } catch {
      /* fall through */
    }
    throw new Error(
      `generate-routine 200 but invalid JSON: ${text.slice(0, 500)}`,
    );
  }
  if (res.status === 500 && isGeminiNotConfiguredError(text)) {
    console.warn(
      "⚠ 後端未設定 GEMINI_API_KEY，略過 AI 生成課表，改用 FALLBACK_AI_ROUTINE",
    );
    return { routine: FALLBACK_AI_ROUTINE, usedAi: false };
  }
  throw new Error(
    `HTTP ${res.status} for /api/ai/generate-routine - body: ${text || "<empty>"}`,
  );
}

/** 嘗試 workout-summary；無 Gemini 時略過 */
async function tryWorkoutSummaryOrSkip(
  clientToken: string,
  routineForClient: unknown,
  completedExercises: unknown[],
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/ai/workout-summary`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        routine: routineForClient,
        completedExercises,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  if (res.status === 200) {
    try {
      const json = JSON.parse(text) as { summary?: string };
      if (json.summary) {
        console.log("✓ AI summary:", json.summary);
        return;
      }
    } catch {
      /* fall through */
    }
    throw new Error(`workout-summary 200 but invalid body: ${text.slice(0, 500)}`);
  }
  if (res.status === 500 && isGeminiNotConfiguredError(text)) {
    console.warn(
      "⚠ 後端未設定 GEMINI_API_KEY，略過 /api/ai/workout-summary（課表與 DB 仍已驗證）",
    );
    return;
  }
  throw new Error(
    `HTTP ${res.status} for /api/ai/workout-summary - body: ${text || "<empty>"}`,
  );
}

// 登入，若帳號不存在時可選擇先註冊
async function ensureUserAndLogin(
  email: string,
  password: string,
  role: "COACH" | "CLIENT",
) {
  // 先嘗試直接登入
  try {
    const loginRes = await httpJson<any>(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      expectedStatus: [200],
    });
    return {
      token: loginRes.token as string,
      refreshToken: loginRes.refreshToken as string | undefined,
      user: loginRes.user,
    };
  } catch {
    // 登入失敗 → 嘗試註冊
    const registerRes = await httpJson<any>(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        firstName: role === "COACH" ? "Gordon" : "Amy",
        lastName: role === "COACH" ? "Coach" : "Client",
        role,
      }),
      expectedStatus: [201, 400, 409], // 若已存在可能回 400/409，視後端實作
    });

    // 若回 201，裡面應該有 user；若 400/409 則視為已存在，直接忽略
    if (registerRes?.user?.email === email) {
      // 某些流程需要 emailVerified，這裡假設後端已處理或不強制
    }

    // 再登入一次
    const loginRes = await httpJson<any>(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      expectedStatus: 200,
    });
    return {
      token: loginRes.token as string,
      refreshToken: loginRes.refreshToken as string | undefined,
      user: loginRes.user,
    };
  }
}

test(
  "complete workout flow: coach creates routine, student logs, AI summary, DB verifies",
  async () => {
  if (REQUIRE_DB && !DB_URL) {
    throw new Error(
      "DATABASE_URL is not set. Please export it or load server/.env.local (required when E2E_REQUIRE_DB=true).",
    );
  }

  console.log("== e2e api-workflow start ==");

  // 僅在需要 DB 驗證時才建立 pg Pool，避免 Node 在 require_db=false 模式下仍做 DNS/連線嘗試
  const db =
    REQUIRE_DB && DB_URL ? new Pool({ connectionString: DB_URL }) : null;

  try {
    // Node DNS 檢查：避免後面才因 ENOTFOUND 卡住且訊息太晚出現
    if (REQUIRE_DB && DB_HOSTNAME) {
      try {
        await dns.lookup(DB_HOSTNAME);
        console.log(`✓ Node DNS resolve ok: ${DB_HOSTNAME}`);
      } catch (e: any) {
        const code = e?.code ? String(e.code) : "UNKNOWN";
        throw new Error(
          `Node.js DNS resolve failed for DB hostname. code=${code} message=${
            e?.message ?? String(e)
          }\nDB hostname=${DB_HOSTNAME}\n` +
            `你可以對照：psql 若能連上，但 Node 解析失敗，通常是環境 DNS/網路限制差異導致（vitest/Node 與系統 resolver 不一致）。` +
            `\n如果你只是要跑 API flow 可把 E2E_REQUIRE_DB=false（此時不需要測試端直連 DB）。`,
        );
      }
    }

    // 1. Coach Gordon 登入（必要時自動註冊）
    console.log("Step 1/15: login coach");
    const coachLogin = await ensureUserAndLogin(
      COACH_EMAIL,
      PASSWORD,
      "COACH",
    );
    const coachToken = coachLogin.token;
    const coachId = coachLogin.user.id as string;
    console.log("✓ Coach logged in:", COACH_EMAIL, "id=", coachId);

    // 2. Client Amy 登入（必要時自動註冊）
    console.log("Step 2/15: login client");
    const clientLogin = await ensureUserAndLogin(
      CLIENT_EMAIL,
      PASSWORD,
      "CLIENT",
    );
    const clientToken = clientLogin.token;
    const clientId = clientLogin.user.id as string;
    console.log("✓ Client logged in:", CLIENT_EMAIL, "id=", clientId);

    // 3. 教練送邀請給客戶（invitation flow）
    console.log("Step 3/15: coach sends invitation");
    const invitationSend = await httpJson<any>(
      `${API_BASE}/api/invitations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coachToken}`,
        },
        body: { email: CLIENT_EMAIL },
        expectedStatus: [200, 201, 400],
      },
    );

    const invitationIdFromSend =
      invitationSend?.id ?? invitationSend?.data?.id ?? null;
    if (invitationIdFromSend) {
      console.log("✓ Invitation id from send:", invitationIdFromSend);
    }

    console.log("Step 4/15: client views invitations");
    const clientInvList = await httpJson<any[]>(
      `${API_BASE}/api/invitations`,
      {
        headers: { Authorization: `Bearer ${clientToken}` },
        expectedStatus: 200,
      },
    );

    if (!Array.isArray(clientInvList)) {
      throw new Error("Expected /api/invitations to return an array");
    }

    const hasAmyInvitation = clientInvList.some((inv: any) => {
      const email = inv.receiverEmail ?? inv.receiver_email ?? "";
      return String(email).toLowerCase() === CLIENT_EMAIL.toLowerCase();
    });

    if (!hasAmyInvitation) {
      console.warn(
        `⚠ Client did not find an invitation for ${CLIENT_EMAIL}. Will continue to validate coach-client relationship via /api/coach/clients and /api/client/coaches.`,
      );
    }

    const invitationId =
      invitationIdFromSend ?? clientInvList[0]?.id ?? null;

    console.log("Step 5/15: client accepts invitation (if available)");
    if (invitationId) {
      try {
        await httpJson<any>(
          `${API_BASE}/api/invitations/${invitationId}/accept`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${clientToken}`,
            },
            expectedStatus: 200,
          },
        );
        console.log("✓ Invitation accepted:", invitationId);
      } catch (e: any) {
        // 若已接受過，或邀請狀態不允許，後面用 coach/clients 驗證關係即可
        console.warn(
          "⚠ Invitation accept failed (may already be accepted).",
          e?.message ?? e,
        );
      }
    } else {
      console.warn("⚠ invitationId missing; will validate coach-client via APIs.");
    }

    console.log("Step 6/15: coach views active clients");
    const coachClients = await httpJson<any[]>(
      `${API_BASE}/api/coach/clients`,
      {
        headers: { Authorization: `Bearer ${coachToken}` },
        expectedStatus: 200,
      },
    );

    const hasAmyClient = coachClients.some((c: any) => {
      const email = c.email ?? "";
      return String(email).toLowerCase() === CLIENT_EMAIL.toLowerCase();
    });
    if (!hasAmyClient) {
      throw new Error(
        `Expected coach active clients to include ${CLIENT_EMAIL}, got ${JSON.stringify(coachClients)}`,
      );
    }

    console.log("Step 7/15: client views their coaches");
    const clientCoaches = await httpJson<any[]>(
      `${API_BASE}/api/client/coaches`,
      {
        headers: { Authorization: `Bearer ${clientToken}` },
        expectedStatus: 200,
      },
    );

    const hasGordonCoach = clientCoaches.some((c: any) => {
      const email = c.email ?? "";
      return String(email).toLowerCase() === COACH_EMAIL.toLowerCase();
    });
    if (!hasGordonCoach) {
      throw new Error(
        `Expected client coaches to include ${COACH_EMAIL}, got ${JSON.stringify(clientCoaches)}`,
      );
    }

    // 8. Coach 呼叫 AI 生成課表骨架（無 GEMINI_API_KEY 時改用手寫骨架）
    console.log("Step 8/15: generate routine (or fallback)");
    const { routine: aiRoutine, usedAi } = await tryGenerateRoutineOrFallback(
      coachToken,
    );
    console.log(
      usedAi ? `✓ AI generated routine: ${aiRoutine.name}` : `✓ Using fallback routine: ${aiRoutine.name}`,
    );

    // 4. 透過後端 GET /api/exercises 取得 Bench Press 的 exerciseId（不依賴測試端直連 DB）
    console.log(
      "Step 9/15: ensure Bench Press exercise via GET /api/exercises",
    );

    const exercisesRes = await httpJson<any>(
      `${API_BASE}/api/exercises?search=${encodeURIComponent(
        "Bench Press",
      )}&limit=10`,
      {
        headers: { Authorization: `Bearer ${clientToken}` },
        expectedStatus: 200,
      },
    );

    const exercisesList = Array.isArray(exercisesRes)
      ? exercisesRes
      : Array.isArray(exercisesRes?.exercises)
        ? exercisesRes.exercises
        : [];

    const match =
      exercisesList.find(
        (e: any) => String(e?.name ?? "").toLowerCase() === "bench press",
      ) ?? exercisesList[0];

    if (!match?.id) {
      throw new Error(
        "Bench Press exercise not found via /api/exercises. " +
          "請確保資料庫 exercises 表內已有 Bench Press（你可先跑 server/scripts/e2e-test.ts 進行 seed）。",
      );
    }

    const benchPressId = String(match.id);
    console.log("✓ Bench Press exercise id:", benchPressId);

    // 5. Coach 建立真正的 workout_routines 記錄
    console.log("Step 10/15: create workout routine in DB via API");
    const aiFirstExercise = aiRoutine.exercises?.[0];
    const aiFirstSet = aiFirstExercise?.sets?.[0];

    const createRoutineBody = {
      clientId,
      name: aiRoutine.name || "Push Day",
      notes: aiRoutine.notes || "自動化測試產生的課表",
      scheduledDate: new Date().toISOString(),
      exercises: [
        {
          exerciseId: benchPressId,
          order: 1,
          sets: [
            {
              setIndex: 1,
              setType: "normal",
              targetWeight: aiFirstSet?.targetWeight ?? 60,
              targetReps: aiFirstSet?.targetReps ?? 8,
              targetRpe: aiFirstSet?.targetRpe ?? 8,
            },
          ],
        },
      ],
    };

    const createdRoutine = await httpJson<{
      id: string;
      clientId: string;
      coachId: string;
      name: string;
      notes: string | null;
      scheduledDate: string | null;
      isCompleted: boolean;
    }>(`${API_BASE}/api/workouts/routines`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${coachToken}`,
      },
      body: JSON.stringify(createRoutineBody),
      expectedStatus: 201,
    });

    const routineId = createdRoutine.id;
    console.log(
      "✓ Routine created in API:",
      routineId,
      "name=",
      createdRoutine.name,
    );

    // 6. Client Amy 以 /api/workouts/routines 查詢 upcoming 課表
    console.log("Step 11/15: client fetch upcoming routine");
    const upcomingRes = await httpJson<{
      routines: {
        id: string;
        name: string;
        clientId: string;
        notes: string;
        scheduledDate: string;
        isCompleted: boolean;
        exercises: any[];
      }[];
    }>(
      `${API_BASE}/api/workouts/routines?clientId=${encodeURIComponent(
        clientId,
      )}&upcoming=true&limit=10`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${clientToken}`,
        },
        expectedStatus: 200,
      },
    );

    if (!Array.isArray(upcomingRes.routines)) {
      throw new Error("Expected upcomingRes.routines to be an array");
    }
    const routineForClient = upcomingRes.routines.find(
      (r) => r.id === routineId,
    );
    if (!routineForClient) {
      throw new Error(
        `Client did not see the created routine in upcoming list. routines=${JSON.stringify(
          upcomingRes.routines,
        )}`,
      );
    }
    console.log(
      "✓ Client sees created routine via GET /api/workouts/routines",
    );

    // Plans tab 最小 smoke：對應 LEARNER 路由 ClientRouter tab「plans」所用 GET /api/plans/my；
    // TRAINER 端 Modal 對應 POST /api/plans/assign（Bearer coachToken）。
    console.log("Step 12/15: trainer POST /api/plans/assign");
    const assignRes = await httpJson<{ success?: boolean }>(
      `${API_BASE}/api/plans/assign`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coachToken}`,
        },
        body: JSON.stringify({ routineId, learnerId: clientId }),
        expectedStatus: 200,
      },
    );
    if (!assignRes?.success) {
      throw new Error(
        `Expected assign { success: true }, got ${JSON.stringify(assignRes)}`,
      );
    }
    console.log("✓ Plan assigned to learner");

    console.log("Step 13/15: learner GET /api/plans/my (assigned + trainerName)");
    const myPlans = await httpJson<
      {
        id: string;
        name: string;
        isOwn?: boolean;
        trainerName?: string;
      }[]
    >(`${API_BASE}/api/plans/my`, {
      headers: { Authorization: `Bearer ${clientToken}` },
      expectedStatus: 200,
    });
    if (!Array.isArray(myPlans)) {
      throw new Error(
        `Expected /api/plans/my array, got ${JSON.stringify(myPlans)}`,
      );
    }
    const assignedEntry = myPlans.find(
      (p) => p.id === routineId && p.isOwn === false,
    );
    if (!assignedEntry) {
      throw new Error(
        `Expected assigned plan for routineId=${routineId}, got ${JSON.stringify(myPlans)}`,
      );
    }
    if (!String(assignedEntry.trainerName ?? "").trim()) {
      throw new Error(
        `Expected trainerName on assigned plan, got ${JSON.stringify(assignedEntry)}`,
      );
    }
    console.log(
      "✓ Learner sees assigned plan with trainerName:",
      assignedEntry.trainerName,
    );

    // 7. Client 完成訓練 → 呼叫 /api/ai/workout-summary
    console.log("Step 14/15: request workout summary (or skip)");
    const completedExercises = [
      {
        name: routineForClient.exercises?.[0]?.exerciseName || "Bench Press",
        sets: [
          {
            targetWeight: aiFirstSet?.targetWeight ?? 60,
            targetReps: aiFirstSet?.targetReps ?? 8,
            actualWeight: aiFirstSet?.targetWeight ?? 60,
            actualReps: aiFirstSet?.targetReps ?? 8,
          },
        ],
      },
    ];

    await tryWorkoutSummaryOrSkip(
      clientToken,
      routineForClient,
      completedExercises,
    );

    // 8. 直接查 Postgres 驗證 workout_routines（僅在 E2E_REQUIRE_DB=true 時做）
    console.log("Step 15/15: optional Postgres verification (E2E_REQUIRE_DB)");
    if (REQUIRE_DB) {
      if (!db) throw new Error("DATABASE_URL not available for DB verification");

      const dbResult = await db.query<{
        id: string;
        coach_id: string;
        client_id: string;
        name: string;
        notes: string | null;
        is_completed: boolean;
      }>(
        `SELECT id, coach_id, client_id, name, notes, is_completed
         FROM workout_routines
         WHERE id = $1`,
        [routineId],
      );

      if (dbResult.rows.length !== 1) {
        throw new Error(
          `Expected 1 row in workout_routines, got ${dbResult.rows.length}`,
        );
      }

      const row = dbResult.rows[0];
      console.log("✓ DB row:", row);

      if (row.client_id !== clientId) {
        throw new Error(
          `DB client_id mismatch. expected=${clientId}, got=${row.client_id}`,
        );
      }
      if (row.coach_id !== coachId) {
        throw new Error(
          `DB coach_id mismatch. expected=${coachId}, got=${row.coach_id}`,
        );
      }
      if (row.name !== createdRoutine.name) {
        throw new Error(
          `DB name mismatch. expected=${createdRoutine.name}, got=${row.name}`,
        );
      }

      console.log(
        "✅ DB verification passed for workout_routines.id =",
        routineId,
      );
    } else {
      console.log(
        "ℹ️ E2E_REQUIRE_DB=false: skip direct Postgres verification (server-side API already exercised DB).",
      );
    }
  } finally {
    if (db) {
      await new Promise<void>((resolve) => {
        db.end(() => resolve());
      });
    }
  }
  },
  60000,
);

