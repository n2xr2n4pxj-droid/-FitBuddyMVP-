import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("請輸入有效的 Email 地址").trim(),
  password: z
    .string()
    .min(6, "密碼至少需要 6 個字元")
    .max(128, "密碼長度過長"),
});

export type LoginInput = z.infer<typeof loginSchema>;
