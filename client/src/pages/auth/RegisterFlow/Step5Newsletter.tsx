/**
 * FitBuddy 註冊流程 - 步驟 5: 郵件推廣活動
 * 
 * 生產級別的郵件訂閱組件
 * - 使用 React + TypeScript + React Hook Form
 * - React Query + Axios 統一架構（稍後集成）
 * - 完整的表單驗證
 * - 郵件訂閱選擇功能
 * 
 * 注意：稍後會使用 useRegisterStore (Zustand store)
 * 目前使用 props 傳遞的 onUpdate 函數更新狀態
 */

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import { regPrimaryButtonClass, regStepSubtitleClass, regStepTitleClass } from './register-ui';

// ========== 類型定義 ==========

/**
 * Step5Newsletter 組件的 Props
 */
export interface Step5NewsletterProps {
  /**
   * 當前步驟數據
   */
  data: {
    subscribeNewsletter: boolean;
  };

  /**
   * 更新步驟數據的回調函數
   * 稍後會改為使用 registerStore.updateStep(5, data)
   */
  onUpdate: (data: { subscribeNewsletter: boolean }) => void;

  /**
   * 前往下一步的回調函數
   * 稍後會改為使用 registerStore.setCurrentStep(6)
   */
  onNext?: () => void;
}

// ========== 驗證 Schema ==========

/**
 * 表單驗證 Schema
 */
const newsletterSchema = z.object({
  subscribeNewsletter: z.boolean({
    required_error: '請選擇是否訂閱郵件',
  }),
});

type NewsletterFormData = z.infer<typeof newsletterSchema>;

// ========== Step5Newsletter 組件 ==========

/**
 * 步驟 5: 郵件推廣活動組件
 */
export default function Step5Newsletter({
  data,
  onUpdate,
  onNext,
}: Step5NewsletterProps): JSX.Element {
  // React Hook Form
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<NewsletterFormData>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: {
      subscribeNewsletter: data.subscribeNewsletter ?? false,
    },
    mode: 'onChange',
  });

  const subscribeNewsletter = watch('subscribeNewsletter');

  // 監聽表單變化，實時更新到父組件
  React.useEffect(() => {
    onUpdate({
      subscribeNewsletter: subscribeNewsletter ?? false,
    });
  }, [subscribeNewsletter, onUpdate]);

  /**
   * 處理表單提交（前往下一步）
   */
  const onSubmit = (formData: NewsletterFormData) => {
    // 更新 store（稍後會改為使用 registerStore.updateStep(5, data)）
    onUpdate({
      subscribeNewsletter: formData.subscribeNewsletter,
    });

    // 前往下一步（稍後會改為使用 registerStore.setCurrentStep(6)）
    if (onNext) {
      onNext();
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 標題區域 */}
      <div>
        <h2 className={regStepTitleClass}>建立你的帳號</h2>
        <p className={regStepSubtitleClass}>步驟 5/7：保持聯繫</p>
      </div>

      {/* 郵件圖標 */}
      <div className="flex justify-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-blue-500/30 bg-blue-600/10">
          <Mail className="w-12 h-12 text-blue-400" />
        </div>
      </div>

      {/* 內容區域 */}
      <div className="space-y-6">
        {/* 標題和描述 */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-black tracking-tight text-white md:text-2xl">
            📧 訂閱我們的郵件
          </h3>
          <p className="text-base text-neutral-400">
            獲取健身提示、食譜和優惠
          </p>
        </div>

        {/* 表單 */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* 單選按鈕組 */}
          <div className="space-y-3">
            <Controller
              name="subscribeNewsletter"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value ? 'yes' : 'no'}
                  onValueChange={(value: 'yes' | 'no') => {
                    const newValue = value === 'yes';
                    field.onChange(newValue);
                    onUpdate({
                      subscribeNewsletter: newValue,
                    });
                  }}
                  className="space-y-3"
                >
                  {/* 是，發送郵件給我 */}
                  <div
                    className={`relative border-2 rounded-lg p-4 transition-all duration-200 cursor-pointer ${
                      field.value === true
                        ? 'border-blue-600 bg-blue-600/10'
                        : 'border-gray-700 bg-slate-900/50 hover:border-slate-600'
                    }`}
                    onClick={() => {
                      field.onChange(true);
                      onUpdate({
                        subscribeNewsletter: true,
                      });
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem
                        value="yes"
                        id="newsletter-yes"
                        className="border-gray-700 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor="newsletter-yes"
                          className={`text-base font-medium cursor-pointer ${
                            field.value === true
                              ? 'text-blue-400'
                              : 'text-white'
                          }`}
                        >
                          是，發送郵件給我
                        </Label>
                      </div>
                      {field.value === true && (
                        <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* 不，謝謝 */}
                  <div
                    className={`relative border-2 rounded-lg p-4 transition-all duration-200 cursor-pointer ${
                      field.value === false
                        ? 'border-blue-600 bg-blue-600/10'
                        : 'border-gray-700 bg-slate-900/50 hover:border-slate-600'
                    }`}
                    onClick={() => {
                      field.onChange(false);
                      onUpdate({
                        subscribeNewsletter: false,
                      });
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem
                        value="no"
                        id="newsletter-no"
                        className="border-gray-700 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor="newsletter-no"
                          className={`text-base font-medium cursor-pointer ${
                            field.value === false
                              ? 'text-blue-400'
                              : 'text-white'
                          }`}
                        >
                          不，謝謝
                        </Label>
                      </div>
                      {field.value === false && (
                        <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </RadioGroup>
              )}
            />
            {errors.subscribeNewsletter && (
              <p className="text-red-500 text-sm" role="alert">
                {errors.subscribeNewsletter.message}
              </p>
            )}
          </div>

          {/* 說明文字 */}
          {subscribeNewsletter && (
            <div className="bg-slate-900/50 border border-gray-700 rounded-lg p-4 space-y-2">
              <p className="text-white/80 text-sm">
                我們每週發送 1-2 封郵件
              </p>
              <p className="text-white/60 text-xs">
                你可以隨時取消訂閱
              </p>
            </div>
          )}

          {/* 下一步按鈕 */}
          <Button
            type="submit"
            disabled={!isValid}
            className={regPrimaryButtonClass}
            aria-label="下一步"
            data-testid="button-next-step5"
          >
            下一步
          </Button>
        </form>
      </div>
    </div>
  );
}
