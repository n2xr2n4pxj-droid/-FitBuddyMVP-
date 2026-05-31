import { Router } from "express";
import { verifyJWT } from "../replitAuth";
import { callGeminiAI } from "../services/aiService";
import { sendError } from "../lib/response";
import { ErrorCodes } from "@shared/error-codes";
import { aiLimiter } from "../middleware/rateLimiter";

const router = Router();

/**
 * POST /api/ai/generate-routine
 *
 * Request body:
 * {
 *   "prompt": string
 * }
 *
 * Response JSON (BackendAiRoutineResponse):
 * {
 *   "name": string,
 *   "notes": string,
 *   "exercises": [
 *     {
 *       "exerciseName": string,
 *       "sets": [
 *         { "targetWeight": number | null, "targetReps": number | null, "targetRpe": number | null }
 *       ]
 *     }
 *   ]
 * }
 */
router.post("/ai/generate-routine", verifyJWT, aiLimiter, async (req: any, res: any) => {
  try {
    const { prompt } = req.body ?? {};
    if (typeof prompt !== "string") {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "prompt is required");
    }
    const trimmed = prompt.trim();
    if (!trimmed) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "prompt is required");
    }
    if (trimmed.length > 2000) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "prompt 最多 2000 字");
    }

    const systemPrompt = `You are a professional strength and hypertrophy coach.
The client is using a Hong Kong fitness coaching app called FitBuddy.
Based on the following request from the coach, generate a structured workout routine.

Return ONLY valid JSON that strictly matches this TypeScript shape:
{
  "name": "string (routine name, in Traditional Chinese)",
  "notes": "string (coach notes and tips, in Traditional Chinese)",
  "exercises": [
    {
      "exerciseName": "string (in Traditional Chinese)",
      "sets": [
        {
          "targetWeight": number | null, // in kg
          "targetReps": number | null,
          "targetRpe": number | null    // 1-10
        }
      ]
    }
  ]
}

The coach's request:
${trimmed}

Constraints:
- Use Traditional Chinese (Hong Kong) for all names and notes.
- Use realistic weights and reps for the described goal.
- If you are unsure, use null for numeric fields instead of guessing wildly.`;

    const json = await callGeminiAI(systemPrompt);
    return res.status(200).json(json);
  } catch (error: any) {
    console.error("❌ [API] POST /api/ai/generate-routine Error:", error);
    return sendError(
      res,
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      "Failed to generate routine from AI. Please try again later.",
    );
  }
});

/**
 * POST /api/ai/workout-insight
 *
 * Request body:
 * {
 *   "routine": any,              // 前端的 WorkoutRoutine 物件
 *   "completedExercises": any[]  // 簡化後的完成情況（可選）
 * }
 *
 * Response JSON (BackendAiSummaryResponse):
 * {
 *   "summary": string,           // 粵語鼓勵文（繁體）
 *   "highlights": string[],      // 本次訓練亮點
 *   "suggestions": string[]      // 下次建議
 * }
 */
router.post("/ai/workout-insight", verifyJWT, aiLimiter, async (req: any, res: any) => {
  try {
    const { routine, completedExercises } = req.body ?? {};
    if (!routine) {
      return sendError(res, 400, ErrorCodes.VALIDATION_ERROR, "routine is required");
    }
    const payloadSize = Buffer.byteLength(JSON.stringify(req.body ?? {}), "utf8");
    if (payloadSize > 50_000) {
      return sendError(res, 413, ErrorCodes.VALIDATION_ERROR, "payload 超過大小限制");
    }

    const name = routine?.name ?? "本次訓練";
    const summaryJson = JSON.stringify(
      {
        routine,
        completedExercises,
      },
      null,
      2,
    );

    const systemPrompt = `You are a motivating personal fitness coach in Hong Kong.
The following JSON describes a client's completed workout in a coaching app (FitBuddy).

Workout name: ${name}
Full data:
${summaryJson}

Return ONLY valid JSON matching this shape:
{
  "summary": "string (2-3 sentences, colloquial Hong Kong Cantonese, Traditional Chinese, with emojis)",
  "highlights": ["string", ...],   // key positives / what they did well
  "suggestions": ["string", ...]   // concrete suggestions for next time
}
`;

    const json = await callGeminiAI(systemPrompt);
    return res.status(200).json(json);
  } catch (error: any) {
    console.error("❌ [API] POST /api/ai/workout-insight Error:", error);
    return sendError(
      res,
      500,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      "Failed to generate workout summary from AI. Please try again later.",
    );
  }
});

export default router;

