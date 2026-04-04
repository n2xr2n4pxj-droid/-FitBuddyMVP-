import { Router } from "express";
import { verifyJWT } from "../replitAuth";
import { callGeminiAI } from "../services/aiService";

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
router.post("/ai/generate-routine", verifyJWT, async (req: any, res: any) => {
  try {
    const { prompt } = req.body ?? {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "prompt is required" });
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
${prompt}

Constraints:
- Use Traditional Chinese (Hong Kong) for all names and notes.
- Use realistic weights and reps for the described goal.
- If you are unsure, use null for numeric fields instead of guessing wildly.`;

    const json = await callGeminiAI(systemPrompt);
    return res.status(200).json(json);
  } catch (error: any) {
    console.error("❌ [API] POST /api/ai/generate-routine Error:", error);
    return res.status(500).json({
      error:
        error?.message ??
        "Failed to generate routine from AI. Please try again later.",
    });
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
router.post("/ai/workout-insight", verifyJWT, async (req: any, res: any) => {
  try {
    const { routine, completedExercises } = req.body ?? {};
    if (!routine) {
      return res.status(400).json({ error: "routine is required" });
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
    return res.status(500).json({
      error:
        error?.message ??
        "Failed to generate workout summary from AI. Please try again later.",
    });
  }
});

export default router;

