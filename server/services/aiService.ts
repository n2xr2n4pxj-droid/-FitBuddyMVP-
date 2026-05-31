const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-preview-09-2025";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithBackoff(
  input: RequestInfo | URL,
  init?: RequestInit,
  retries = 3,
  baseDelayMs = 500,
): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.ok) return response;

      // Retry only transient errors.
      if (response.status === 429 || response.status >= 500) {
        if (attempt < retries) {
          await sleep(baseDelayMs * 2 ** attempt);
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to call Gemini API after retries");
}

export async function callGeminiAI<T = any>(prompt: string): Promise<T> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetchWithBackoff(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${text}`);
  }

  const data: any = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    data?.candidates?.[0]?.content?.parts?.[0]?.textContent;

  if (!text) {
    throw new Error("Gemini API: empty response content");
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Gemini API: failed to parse JSON from response text: ${String(error)}`);
  }
}

