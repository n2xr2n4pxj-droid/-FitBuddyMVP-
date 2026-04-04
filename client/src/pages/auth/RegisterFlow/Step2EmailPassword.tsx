/**
 * FitBuddy 註冊流程 - 步驟 2: Email + Password
 * 
 * 生產級別的郵箱和密碼輸入組件
 * - 使用 React + TypeScript + React Hook Form
 * - React Query + Axios 統一架構（稍後集成）
 * - 完整的表單驗證
 * - OAuth 登入選項
 * 
 * 注意：稍後會使用 useRegisterStore (Zustand store)
 * 目前使用 props 傳遞的 onUpdate 函數更新狀態
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { AiFillApple } from 'react-icons/ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import GoogleLoginButton from '@/components/GoogleLoginButton';
import { regInputClass, regPrimaryButtonClass, regStepSubtitleClass, regStepTitleClass } from './register-ui';

// ========== 類型定義 ==========

/**
 * Step2EmailPassword 組件的 Props
 */
export interface Step2EmailPasswordProps {
  /**
   * 當前步驟數據
   */
  data: {
    email: string;
    password: string;
    agreeToTerms: boolean;
  };

  /**
   * 更新步驟數據的回調函數
   * 稍後會改為使用 registerStore.updateStep(2, data)
   */
  onUpdate: (data: { email: string; password: string; agreeToTerms: boolean }) => void;

  /**
   * 前往下一步的回調函數
   * 稍後會改為使用 registerStore.setCurrentStep(3)
   */
  onNext?: () => void;
}

// ========== 驗證 Schema ==========

/**
 * 表單驗證 Schema
 */
const emailPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email 為必填項')
    .email('請輸入有效的 Email 格式'),
  password: z
    .string()
    .min(1, '密碼為必填項')
    .min(6, '密碼至少需要 6 個字符'),
  agreeToTerms: z
    .boolean()
    .refine((val) => val === true, {
      message: '必須同意使用條款和隱私政策才能繼續',
    }),
});

type EmailPasswordFormData = z.infer<typeof emailPasswordSchema>;

// ========== Step2EmailPassword 組件 ==========

/**
 * 步驟 2: Email + Password 組件
 */
export default function Step2EmailPassword({
  data,
  onUpdate,
  onNext,
}: Step2EmailPasswordProps): JSX.Element {
  // 密碼顯示/隱藏狀態
  const [showPassword, setShowPassword] = useState(false);

  // React Hook Form
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<EmailPasswordFormData>({
    resolver: zodResolver(emailPasswordSchema),
    defaultValues: {
      email: data.email || '',
      password: data.password || '',
      agreeToTerms: data.agreeToTerms || false,
    },
    mode: 'onChange', // 實時驗證
  });

  const email = watch('email');
  const password = watch('password');
  const agreeToTerms = watch('agreeToTerms');

  // 監聽表單變化，實時更新到父組件
  React.useEffect(() => {
    if (
      email !== data.email ||
      password !== data.password ||
      agreeToTerms !== data.agreeToTerms
    ) {
      onUpdate({
        email: email || '',
        password: password || '',
        agreeToTerms: agreeToTerms || false,
      });
    }
  }, [email, password, agreeToTerms, data, onUpdate]);

  /**
   * 處理表單提交（前往下一步）
   */
  const onSubmit = (formData: EmailPasswordFormData) => {
    // 更新 store（稍後會改為使用 registerStore.updateStep(2, data)）
    onUpdate({
      email: formData.email.trim(),
      password: formData.password,
      agreeToTerms: formData.agreeToTerms,
    });

    // 前往下一步（稍後會改為使用 registerStore.setCurrentStep(3)）
    if (onNext) {
      onNext();
    }
  };

  /**
   * 處理 OAuth 登入（Apple）
   */
  const handleAppleSignUp = () => {
    alert('OAuth coming soon');
  };

  /**
   * 處理條款複選框變化
   */
  const handleTermsChange = (checked: boolean) => {
    setValue('agreeToTerms', checked, { shouldValidate: true });
    onUpdate({
      email: email || '',
      password: password || '',
      agreeToTerms: checked,
    });
  };

  // 判斷按鈕是否應該啟用
  const isFormValid = isValid && agreeToTerms;

  return (
    <div className="w-full space-y-6">
      {/* 標題區域 */}
      <div>
        <h2 className={regStepTitleClass}>建立你的帳號</h2>
        <p className={regStepSubtitleClass}>步驟 2/7：郵箱和密碼</p>
      </div>

      {/* 表單 */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email 輸入框 */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-white">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="example@gmail.com"
            className={`${regInputClass} ${
              errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
            }`}
            {...register('email')}
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'email-error' : undefined}
            autoComplete="email"
            autoFocus
          />
          {errors.email && (
            <p id="email-error" className="text-red-500 text-sm" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password 輸入框 */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-white">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="最少 6 個字符"
              className={`${regInputClass} pr-10 ${
                errors.password
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : ''
              }`}
              {...register('password')}
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={errors.password ? 'password-error' : undefined}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/80 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:ring-offset-neutral-950 rounded-md p-1"
              aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="text-red-500 text-sm" role="alert">
              {errors.password.message}
            </p>
          )}
          {!errors.password && password && password.length > 0 && (
            <p className="text-white/50 text-xs">最少 6 個字符</p>
          )}
        </div>

        {/* 條款複選框 */}
        <div className="space-y-2">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="agreeToTerms"
              checked={agreeToTerms}
              onCheckedChange={handleTermsChange}
              className="mt-1 border-neutral-700 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              aria-invalid={errors.agreeToTerms ? 'true' : 'false'}
              aria-describedby={errors.agreeToTerms ? 'terms-error' : undefined}
            />
            <Label
              htmlFor="agreeToTerms"
              className="text-sm text-white/80 cursor-pointer leading-relaxed"
              onClick={() => handleTermsChange(!agreeToTerms)}
            >
              我同意{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 hover:underline font-semibold"
                onClick={(e) => e.stopPropagation()}
              >
                使用條款
              </a>{' '}
              和{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 hover:underline font-semibold"
                onClick={(e) => e.stopPropagation()}
              >
                隱私政策
              </a>
            </Label>
          </div>
          {errors.agreeToTerms && (
            <p id="terms-error" className="text-red-500 text-sm ml-7" role="alert">
              {errors.agreeToTerms.message}
            </p>
          )}
        </div>

        {/* 下一步按鈕 */}
        <Button
          type="submit"
          disabled={!isFormValid}
          className={regPrimaryButtonClass}
          aria-label="下一步"
          data-testid="button-next-step2"
        >
          下一步
        </Button>
      </form>

      {/* 分隔線 */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/20"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-neutral-900/80 text-neutral-500">或</span>
        </div>
      </div>

      {/* OAuth 按鈕 */}
      <div className="space-y-3">
        {/* Apple 登入 */}
        <Button
          type="button"
          variant="outline"
          disabled
          onClick={handleAppleSignUp}
          className="w-full flex justify-center gap-3 px-4 py-2.5 border border-neutral-700 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition-colors opacity-40 cursor-not-allowed"
          aria-label="使用 Apple 繼續"
        >
          <AiFillApple className="h-5 w-5 text-white" aria-hidden />
          繼續使用 Apple（即將推出）
        </Button>

        {/* Google 登入 */}
        <div className="w-full">
          <GoogleLoginButton
            flow="register"
            buttonClassName="w-full flex justify-center gap-3 px-4 py-2.5 border border-neutral-700 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
