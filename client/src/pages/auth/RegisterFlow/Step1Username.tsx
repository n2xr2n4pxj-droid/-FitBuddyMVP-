/**
 * FitBuddy 註冊流程 - 步驟 1: 創建用戶名稱
 *
 * 生產級別的用戶名稱輸入組件
 * - 使用 React + TypeScript + React Hook Form
 * - 即時欄位驗證（RHF）+ 可用性檢查（500ms debounce 後才觸發）
 * - 顯示驗證反饋和建議名稱
 *
 * 注意：稍後會使用 useRegisterStore (Zustand store)
 * 目前使用 props 傳遞的 onUpdate 函數更新狀態
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/useDebounce';
import { apiClient } from '@/lib/api-client';
import { regInputClass, regPrimaryButtonClass, regStepSubtitleClass, regStepTitleClass } from './register-ui';

// ========== 類型定義 ==========

/**
 * 用戶名稱驗證響應
 */
interface UsernameCheckResponse {
  available: boolean;
  suggestions?: string[];
}

/**
 * Step1Username 組件的 Props
 */
export interface Step1UsernameProps {
  /**
   * 當前用戶名稱數據
   */
  data: {
    username: string;
  };

  /**
   * 更新用戶名稱數據的回調函數
   * 稍後會改為使用 useRegisterStore
   */
  onUpdate: (data: { username: string }) => void;

  /**
   * 前往下一步的回調函數
   * 稍後會改為使用 registerStore.setCurrentStep(2)
   */
  onNext?: () => void;
}

const AVAILABILITY_DEBOUNCE_MS = 500;

// ========== 驗證 Schema ==========

/**
 * 用戶名稱驗證規則：
 * - 最少 3 個字符
 * - 最多 20 個字符
 * - 只能使用字母、數字、下劃線 (_)
 * - 不能以數字開頭
 * - 不能只有下劃線
 */
const usernameSchema = z
  .string()
  .min(1, '用戶名稱不能為空')
  .min(3, '用戶名稱至少需要 3 個字符')
  .max(20, '用戶名稱不能超過 20 個字符')
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, '用戶名稱只能包含字母、數字和下劃線，且不能以數字開頭')
  .refine((val) => val !== '_'.repeat(val.length), {
    message: '用戶名稱不能只包含下劃線',
  });

/**
 * GET /api/v1/users/check-username?username=xxx（公開，見 server/routes/users-v1.ts）
 * 後端以 users.username 做不分大小寫比對。
 */
async function checkUsernameAvailability(
  username: string
): Promise<UsernameCheckResponse> {
  const { data } = await apiClient.get<UsernameCheckResponse>(
    '/api/v1/users/check-username',
    { params: { username } }
  );
  return data;
}

// ========== Step1Username 組件 ==========

/**
 * 步驟 1: 創建用戶名稱組件
 */
export default function Step1Username({
  data,
  onUpdate,
  onNext,
}: Step1UsernameProps): JSX.Element {
  const [checking, setChecking] = useState(false);
  const [availabilityResult, setAvailabilityResult] =
    useState<UsernameCheckResponse | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<{ username: string }>({
    resolver: zodResolver(z.object({ username: usernameSchema })),
    defaultValues: {
      username: data.username || '',
    },
    mode: 'onChange',
  });

  const username = watch('username');
  const debouncedUsername = useDebounce(username ?? '', AVAILABILITY_DEBOUNCE_MS);

  // 防抖後再同步父層，減少 RegisterFlow 每鍵重繪
  useEffect(() => {
    onUpdate({ username: debouncedUsername });
  }, [debouncedUsername, onUpdate]);

  // 僅依「防抖後」的值觸發可用性檢查（不於 onChange 內 await API）
  useEffect(() => {
    const trimmed = debouncedUsername.trim();

    if (trimmed.length === 0) {
      setAvailabilityResult(null);
      setChecking(false);
      return;
    }

    if (trimmed.length < 3) {
      setAvailabilityResult(null);
      setChecking(false);
      return;
    }

    let parsed: string;
    try {
      parsed = usernameSchema.parse(trimmed);
    } catch {
      setAvailabilityResult(null);
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    void (async () => {
      try {
        const result = await checkUsernameAvailability(parsed);
        if (cancelled) return;
        setAvailabilityResult(result);
      } catch (error) {
        console.error('檢查用戶名稱可用性失敗:', error);
        if (cancelled) return;
        setAvailabilityResult(null);
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedUsername]);

  const onSubmit = useCallback(
    (formData: { username: string }) => {
      const next = formData.username.trim();
      onUpdate({ username: next });
      if (onNext) {
        onNext();
      }
    },
    [onUpdate, onNext]
  );

  const handleUseSuggestion = useCallback(
    (suggestedUsername: string) => {
      setValue('username', suggestedUsername, { shouldValidate: true });
      onUpdate({ username: suggestedUsername });
    },
    [setValue, onUpdate]
  );

  const debouncedTrimmed = debouncedUsername.trim();
  const showDebouncedMinLengthHint =
    debouncedTrimmed.length > 0 &&
    debouncedTrimmed.length < 3 &&
    !errors.username;

  const isFormValid =
    isValid &&
    !checking &&
    username.trim().length > 0 &&
    availabilityResult?.available === true;
  const hasError = errors.username || (availabilityResult && !availabilityResult.available);

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className={regStepTitleClass}>建立你的帳號</h2>
        <p className={regStepSubtitleClass}>步驟 1/7：選擇用戶名稱</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-3">
          <Label htmlFor="username" className="text-sm font-medium text-white">
            用戶名稱
          </Label>
          <div className="relative">
            <Input
              id="username"
              type="text"
              placeholder="username"
              className={`${regInputClass} pr-10 ${
                hasError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : availabilityResult?.available
                    ? 'border-blue-600'
                    : ''
              }`}
              {...register('username')}
              aria-invalid={hasError ? 'true' : 'false'}
              aria-describedby={
                errors.username || availabilityResult || showDebouncedMinLengthHint
                  ? 'username-error username-suggestions'
                  : undefined
              }
              autoComplete="username"
              autoFocus
            />

            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {checking ? (
                <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
              ) : username && username.trim().length > 0 ? (
                !errors.username && availabilityResult?.available ? (
                  <Check className="w-5 h-5 text-blue-400" />
                ) : hasError ? (
                  <X className="w-5 h-5 text-red-500" />
                ) : null
              ) : null}
            </div>
          </div>

          {(errors.username || availabilityResult || showDebouncedMinLengthHint) && (
            <div
              id="username-error"
              className="space-y-3"
              role="alert"
              aria-live="polite"
            >
              {errors.username && (
                <p className="text-red-500 text-sm flex items-center gap-2">
                  <X className="w-4 h-4" />
                  {errors.username.message}
                </p>
              )}

              {showDebouncedMinLengthHint && (
                <p className="text-amber-400/90 text-sm flex items-center gap-2">
                  最少需 3 個字元（通過格式後才會檢查是否已被使用）
                </p>
              )}

              {!errors.username && availabilityResult && (
                <>
                  {availabilityResult.available ? (
                    <p className="text-blue-400 text-sm flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      用戶名稱可用
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-red-500 text-sm flex items-center gap-2">
                        <X className="w-4 h-4" />
                        用戶名稱已存在
                      </p>

                      {availabilityResult.suggestions &&
                        availabilityResult.suggestions.length > 0 && (
                          <div
                            id="username-suggestions"
                            className="bg-slate-900/50 border border-gray-700 rounded-lg p-4 space-y-2"
                          >
                            <p className="text-white/70 text-sm flex items-center gap-2">
                              <span>💡</span>
                              <span>提示: 嘗試這些名稱:</span>
                            </p>
                            <div className="space-y-2">
                              {availabilityResult.suggestions.map((suggestion, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => handleUseSuggestion(suggestion)}
                                  className="w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-800 border border-gray-700 hover:border-blue-600/50 rounded-md text-blue-400 hover:text-blue-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:ring-offset-slate-950 text-sm font-medium"
                                  aria-label={`使用建議名稱: ${suggestion}`}
                                >
                                  • {suggestion}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!errors.username && !availabilityResult && !showDebouncedMinLengthHint && username && username.trim().length > 0 && (
            <p className="text-white/50 text-xs">
              用戶名稱只能包含字母、數字和下劃線，3-20 個字符
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={!isFormValid || checking}
          className={regPrimaryButtonClass}
          aria-label="下一步"
          data-testid="button-next-step1"
        >
          {checking ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              檢查中...
            </>
          ) : (
            '下一步'
          )}
        </Button>
      </form>
    </div>
  );
}

export { usernameSchema };
