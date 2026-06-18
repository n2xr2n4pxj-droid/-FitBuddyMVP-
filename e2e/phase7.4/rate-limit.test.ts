import { describe, expect, it } from "vitest";
import request from "supertest";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

async function expectEventuallyRateLimited(
  label: string,
  makeRequest: (attempt: number) => Promise<request.Response>,
  maxAttempts: number,
  options?: { requireNon429Before429?: boolean },
): Promise<void> {
  const requireNon429Before429 = options?.requireNon429Before429 ?? true;
  let lastResponse: request.Response | undefined;
  let sawNon429 = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastResponse = await makeRequest(attempt);
    if (lastResponse.status !== 429) {
      sawNon429 = true;
    }
    if (lastResponse.status === 429) {
      if (requireNon429Before429) {
        expect(sawNon429).toBe(true);
      }
      expect(lastResponse.body?.errorCode).toBe("RATE_LIMIT_EXCEEDED");
      expect(lastResponse.headers["retry-after"]).toBeDefined();
      return;
    }
  }

  throw new Error(
    `${label} was not rate-limited within ${maxAttempts} attempts. Last status: ${lastResponse?.status}, body: ${JSON.stringify(lastResponse?.body)}`,
  );
}

describe("Phase 7.4 - rate limit hardening", () => {
  it("login endpoint should eventually return 429", async () => {
    const loginMax = Number(
      process.env.LOGIN_RATE_LIMIT_MAX ??
        (process.env.NODE_ENV === "production" ? 5 : 30),
    );
    await expectEventuallyRateLimited(
      "POST /api/auth/login",
      async (attempt) =>
        request(BASE_URL).post("/api/auth/login").send({
          email: `rate-limit-login-${Date.now()}-${attempt}@fitbuddy.test`,
          password: "WrongPassword!123",
        }),
      loginMax + 5,
      { requireNon429Before429: false },
    );
  });

  it("register and forgot-password share the same rate limit bucket", async () => {
    await expectEventuallyRateLimited(
      "POST /api/auth/register",
      async (attempt) =>
        request(BASE_URL).post("/api/auth/register").send({
          email: `rate-limit-register-${Date.now()}-${attempt}@fitbuddy.test`,
          password: "StrongPassword!123",
          firstName: "Rate",
          lastName: "Limit",
        }),
      6,
      { requireNon429Before429: false },
    );

    const res = await request(BASE_URL).post("/api/auth/forgot-password").send({
      email: `rate-limit-forgot-${Date.now()}@fitbuddy.test`,
    });

    expect(res.status).toBe(429);
    expect(res.body?.errorCode).toBe("RATE_LIMIT_EXCEEDED");
    expect(res.headers["retry-after"]).toBeDefined();
  });
});
