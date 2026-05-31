# AI Endpoints - FitBuddy MVP

本文件說明 FitBuddy 內部使用的兩支 AI 相關後端端點，供前端與未來維護參考。

後端路由檔案：`server/routes/ai.ts`  
前端 helper：`client/src/features/workouts/aiHelpers.ts`

所有端點皆掛載在 `/api` 之下，且受 JWT 保護（`verifyJWT` middleware）。

---

## 1. POST /api/ai/generate-routine

**用途**：  
教練在建立課表時，將簡短的文字需求丟給 AI，由 AI 產生一個「Hevy 風格」的課表骨架（僅含動作名稱與目標組數設定）。

### Request

- **URL**: `/api/ai/generate-routine`
- **Method**: `POST`
- **Auth**: Bearer JWT（`Authorization: Bearer <token>`）
- **Headers**:
  - `Content-Type: application/json`

#### Request Body

```jsonc
{
  "prompt": "針對新手的 45 分鐘推胸訓練，重點放在肌肥大。"
}
```

- `prompt` (string, required):  
  教練對課表的文字描述（目標、時長、部位等），會直接放入 Gemini 的提示中。

### Response

- **Status**: `200 OK`（成功）
- **Content-Type**: `application/json`

#### Response Body - BackendAiRoutineResponse

```jsonc
{
  "name": "推胸肌肥大訓練",
  "notes": "專注動作控制，離心放慢 2-3 秒，避免借力。",
  "exercises": [
    {
      "exerciseName": "槓鈴卧推",
      "sets": [
        { "targetWeight": 40, "targetReps": 10, "targetRpe": 7 },
        { "targetWeight": 40, "targetReps": 10, "targetRpe": 8 },
        { "targetWeight": 40, "targetReps": 8,  "targetRpe": 8 }
      ]
    },
    {
      "exerciseName": "啞鈴上斜卧推",
      "sets": [
        { "targetWeight": 16, "targetReps": 12, "targetRpe": 7 },
        { "targetWeight": 16, "targetReps": 12, "targetRpe": 8 }
      ]
    }
  ]
}
```

- `name` (string): 課表名稱（繁體中文，通常為短句）。
- `notes` (string): 教練對學員的整體建議／注意事項（繁體中文）。
- `exercises` (array):
  - `exerciseName` (string): 動作名稱（繁體中文）。
  - `sets` (array):
    - `targetWeight` (number \| null): 目標重量（kg）。
    - `targetReps` (number \| null): 目標次數。
    - `targetRpe` (number \| null): 目標 RPE（1–10）。

> 前端會使用 `backendAiRoutineToUI` 將此結構轉為 `WorkoutRoutine`，並與現有 `baseRoutine` 合併。

### 錯誤回傳

- `400 Bad Request`

```json
{ "error": "prompt is required" }
```

- `500 Internal Server Error`

```json
{ "error": "Gemini_API 相關錯誤訊息..." }
```

---

## 2. POST /api/ai/workout-summary

**用途**：  
學員完成訓練打卡後，將整體課表與完成情況丟給 AI，由 AI 產生：

- 粵語鼓勵文（summary）
- 亮點（highlights）
- 下次建議（suggestions）

### Request

- **URL**: `/api/ai/workout-summary`
- **Method**: `POST`
- **Auth**: Bearer JWT
- **Headers**:
  - `Content-Type: application/json`

#### Request Body

```jsonc
{
  "routine": {
    "id": "r1",
    "name": "Leg Day (Hypertrophy)",
    "clientId": "uuid-of-client",
    "notes": "注意離心控制，深蹲不要急。",
    "scheduledDate": "2026-03-10T00:00:00Z",
    "isCompleted": false,
    "exercises": [
      {
        "id": "re1",
        "exerciseId": "e1",
        "exerciseName": "Barbell Squat",
        "order": 1,
        "restTimerSeconds": 120,
        "sets": [
          {
            "id": "s1",
            "setIndex": 1,
            "setType": "warmup",
            "targetWeight": 60,
            "targetReps": 10,
            "targetRpe": null,
            "actualWeight": 60,
            "actualReps": 10,
            "isCompleted": true
          }
        ]
      }
    ]
  },
  "completedExercises": [
    {
      "name": "Barbell Squat",
      "sets": [
        {
          "targetWeight": 60,
          "targetReps": 10,
          "actualWeight": 60,
          "actualReps": 10
        }
      ]
    }
  ]
}
```

- `routine`：前端的 `WorkoutRoutine` 物件（完整結構）。
- `completedExercises`：由前端預先整理的「已完成 set 摘要」，方便在 prompt 中使用。

### Response

- **Status**: `200 OK`
- **Content-Type**: `application/json`

#### Response Body - BackendAiSummaryResponse

```jsonc
{
  "summary": "今日腿日做得好正！深蹲每組都堅持到目標次數，力量同穩定性都好有進步💪🔥 下次可以試吓微微加重，保持同樣控制節奏，效果會更好！",
  "highlights": [
    "所有深蹲組數均完成目標 reps",
    "姿勢控制穩定，沒有明顯掉速"
  ],
  "suggestions": [
    "下次嘗試每組加 2.5kg，保持同樣 RPE",
    "訓練前預留多一點熱身時間，減少膝蓋壓力"
  ]
}
```

- `summary` (string)：2–3 句粵語鼓勵文（繁體＋ emoji），前端目前只顯示這段。
- `highlights` (string[])：AI 覺得這次訓練做得好的地方。
- `suggestions` (string[])：下次可以改善或調整的點。

> 若未來前端要顯示亮點與建議，只需擴充 UI，無須修改此端點。

### 錯誤回傳

- `400 Bad Request`

```json
{ "error": "routine is required" }
```

- `500 Internal Server Error`

```json
{ "error": "Failed to generate workout summary from AI. Please try again later." }
```

---

## 3. 環境變數

- `GEMINI_API_KEY`（建議專供後端使用）
- `VITE_GEMINI_API_KEY`（若已存在，可作為 fallback，但不建議繼續在前端使用）
- `GEMINI_MODEL`（可選，預設：`gemini-2.5-flash-preview-09-2025`）

---

## 4. 安全性說明

- 這兩支端點皆使用 `verifyJWT` middleware，僅已登入用戶可以呼叫。
- 前端不再直接持有 Gemini API Key，所有外部 AI 呼叫都經由後端代理完成。
- 如需限制用量，可在 `server/routes/ai.ts` 中加入簡單的節流／配額檢查。 

