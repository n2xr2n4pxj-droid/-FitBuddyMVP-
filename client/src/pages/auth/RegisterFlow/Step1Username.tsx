/**
 * FitBuddy 註冊流程 - 步驟 1: 創建用戶名稱
 * 
 * 生產級別的用戶名稱輸入組件
 * - 使用 React + TypeScript + React Hook Form
 * - 實時驗證用戶名稱可用性（300ms 防抖）
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

// ========== API 模擬 ==========

/**
 * 模擬已被佔用的用戶名稱
 * 稍後會替換為實際的 API 調用
 */
const TAKEN_USERNAMES = ['john', 'fitbuddy', 'admin', 'test', 'user', 'fitbuddy123'];

/**
 * 模擬檢查用戶名稱可用性的 API 調用
 * 
 * @param username - 要檢查的用戶名稱
 * @returns Promise<UsernameCheckResponse>
 */
const checkUsernameAvailability = async (
  username: string
): Promise<UsernameCheckResponse> => {
  // 模擬 API 延遲
  await new Promise((resolve) => setTimeout(resolve, 500));

  const lowerUsername = username.toLowerCase();

  // 檢查是否已被佔用
  if (TAKEN_USERNAMES.includes(lowerUsername)) {
    return {
      available: false,
      suggestions: [
        `${username}19`,
        `${username}_fitness`,
        `fit_${username}`,
      ],
    };
  }

  return { available: true };
};

// ========== Step1Username 組件 ==========

/**
 * 步驟 1: 創建用戶名稱組件
 */
export default function Step1Username({
  data,
  onUpdate,
  onNext,
}: Step1UsernameProps): JSX.Element {
  // 用戶名稱可用性檢查狀態
  const [checking, setChecking] = useState(false);
  const [availabilityResult, setAvailabilityResult] =
    useState<UsernameCheckResponse | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // React Hook Form
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
    mode: 'onChange', // 實時驗證
  });

  const username = watch('username');

  // 監聽用戶名稱變化，實時更新到父組件
  useEffect(() => {
    if (username !== data.username) {
      onUpdate({ username });
    }
  }, [username, data.username, onUpdate]);

  // 防抖檢查用戶名稱可用性
  useEffect(() => {
    // 清除之前的定時器
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // 如果用戶名稱為空或格式無效，不進行檢查
    if (!username || username.trim().length === 0) {
      setAvailabilityResult(null);
      return;
    }

    // 先進行格式驗證
    try {
      usernameSchema.parse(username);
    } catch {
      // 格式無效，不進行可用性檢查
      setAvailabilityResult(null);
      return;
    }

    // 設置防抖定時器（300ms）
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(username);
        setAvailabilityResult(result);
      } catch (error) {
        console.error('檢查用戶名稱可用性失敗:', error);
        setAvailabilityResult(null);
      } finally {
        setChecking(false);
      }
    }, 300);

    setDebounceTimer(timer);

    // 清理函數
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [username]);

  // 組件卸載時清理定時器
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  /**
   * 處理表單提交（前往下一步）
   */
  const onSubmit = useCallback(
    (formData: { username: string }) => {
      // 更新 store（稍後會改為使用 registerStore.updateStep）
      onUpdate({ username: formData.username });

      // 前往下一步（稍後會改為使用 registerStore.setCurrentStep(2)）
      if (onNext) {
        onNext();
      }
    },
    [onUpdate, onNext]
  );

  /**
   * 處理使用建議名稱
   */
  const handleUseSuggestion = useCallback(
    (suggestedUsername: string) => {
      setValue('username', suggestedUsername, { shouldValidate: true });
      onUpdate({ username: suggestedUsername });
    },
    [setValue, onUpdate]
  );

  // 判斷按鈕是否應該啟用
  // 必須同時滿足：格式有效、不在檢查中、可用性檢查結果為可用
  const isFormValid =
    isValid &&
    !checking &&
    username.trim().length > 0 &&
    availabilityResult?.available === true;
  const hasError = errors.username || (availabilityResult && !availabilityResult.available);

  return (
    <div className="w-full space-y-6">
      {/* 標題區域 */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-white">建立你的帳號</h2>
        <p className="text-lg text-gray-400">步驟 1/6: 選擇用戶名稱</p>
      </div>

      {/* 表單 */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 用戶名稱輸入框 */}
        <div className="space-y-3">
          <Label htmlFor="username" className="text-sm font-medium text-white">
            用戶名稱
          </Label>
          <div className="relative">
            <Input
              id="username"
              type="text"
              placeholder="username"
              className={`bg-slate-900/50 border-gray-700 text-white placeholder:text-white/40 focus:border-emerald-500 focus:ring-emerald-500 pr-10 ${
                hasError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : availabilityResult?.available
                  ? 'border-emerald-500'
                  : ''
              }`}
              disabled={checking}
              {...register('username')}
              aria-invalid={hasError ? 'true' : 'false'}
              aria-describedby={
                errors.username || availabilityResult
                  ? 'username-error username-suggestions'
                  : undefined
              }
              autoComplete="username"
              autoFocus
            />

            {/* 實時驗證圖標 */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {checking ? (
                <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
              ) : username && username.trim().length > 0 ? (
                !errors.username && availabilityResult?.available ? (
                  <Check className="w-5 h-5 text-emerald-500" />
                ) : hasError ? (
                  <X className="w-5 h-5 text-red-500" />
                ) : null
              ) : null}
            </div>
          </div>

          {/* 驗證錯誤和建議 */}
          {(errors.username || availabilityResult) && (
            <div
              id="username-error"
              className="space-y-3"
              role="alert"
              aria-live="polite"
            >
              {/* 格式錯誤 */}
              {errors.username && (
                <p className="text-red-500 text-sm flex items-center gap-2">
                  <X className="w-4 h-4" />
                  {errors.username.message}
                </p>
              )}

              {/* 可用性檢查結果 */}
              {!errors.username && availabilityResult && (
                <>
                  {availabilityResult.available ? (
                    <p className="text-emerald-500 text-sm flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      用戶名稱可用
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-red-500 text-sm flex items-center gap-2">
                        <X className="w-4 h-4" />
                        用戶名稱已存在
                      </p>

                      {/* 建議名稱 */}
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
                                  className="w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-800 border border-gray-700 hover:border-emerald-500/50 rounded-md text-emerald-500 hover:text-emerald-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 text-sm font-medium"
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

          {/* 提示信息 */}
          {!errors.username && !availabilityResult && username && username.trim().length > 0 && (
            <p className="text-white/50 text-xs">
              用戶名稱只能包含字母、數字和下劃線，3-20 個字符
            </p>
          )}
        </div>

        {/* 下一步按鈕 */}
        <Button
          type="submit"
          disabled={!isFormValid || checking}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 py-3 text-base rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 shadow-lg hover:shadow-emerald-500/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-500"
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

// 導出驗證 schema 供其他地方使用
export { usernameSchema };
