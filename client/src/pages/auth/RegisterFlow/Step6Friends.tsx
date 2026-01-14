/**
 * FitBuddy 註冊流程 - 步驟 6: 同步聯繫人
 * 
 * 生產級別的同步聯繫人組件
 * - 使用 React + TypeScript + React Hook Form
 * - React Query + Axios 統一架構（稍後集成）
 * - 完整的表單驗證
 * - 聯繫人同步選擇功能
 * 
 * 注意：稍後會使用 useRegisterStore (Zustand store)
 * 目前使用 props 傳遞的 onUpdate 函數更新狀態
 */

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';

// ========== 類型定義 ==========

/**
 * Step6Friends 組件的 Props
 */
export interface Step6FriendsProps {
  /**
   * 當前步驟數據
   */
  data: {
    syncContacts: boolean;
  };

  /**
   * 更新步驟數據的回調函數
   * 稍後會改為使用 registerStore.updateStep(6, data)
   */
  onUpdate: (data: { syncContacts: boolean }) => void;

  /**
   * 前往下一步/完成註冊的回調函數
   * 稍後會改為使用 registerStore.setCurrentStep(7) 或 submit()
   */
  onNext?: () => void;
}

// ========== 驗證 Schema ==========

/**
 * 表單驗證 Schema
 */
const friendsSchema = z.object({
  syncContacts: z.boolean({
    required_error: '請選擇是否同步聯繫人',
  }),
});

type FriendsFormData = z.infer<typeof friendsSchema>;

// ========== Step6Friends 組件 ==========

/**
 * 步驟 6: 同步聯繫人組件
 */
export default function Step6Friends({
  data,
  onUpdate,
  onNext,
}: Step6FriendsProps): JSX.Element {
  // React Hook Form
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<FriendsFormData>({
    resolver: zodResolver(friendsSchema),
    defaultValues: {
      syncContacts: data.syncContacts ?? false,
    },
    mode: 'onChange',
  });

  const syncContacts = watch('syncContacts');

  // 監聽表單變化，實時更新到父組件
  React.useEffect(() => {
    onUpdate({
      syncContacts: syncContacts ?? false,
    });
  }, [syncContacts, onUpdate]);

  /**
   * 處理表單提交（完成註冊）
   */
  const onSubmit = (formData: FriendsFormData) => {
    // 更新 store（稍後會改為使用 registerStore.updateStep(6, data)）
    onUpdate({
      syncContacts: formData.syncContacts,
    });

    // 完成註冊（稍後會改為使用 registerStore.submit()）
    if (onNext) {
      onNext();
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 標題區域 */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-white">建立你的帳號</h2>
        <p className="text-lg text-gray-400">步驟 6/6: 找到朋友</p>
      </div>

      {/* 圖標 */}
      <div className="flex justify-center">
        <div className="w-24 h-24 rounded-full bg-blue-500/20 border-2 border-blue-500/50 flex items-center justify-center">
          <Users className="w-12 h-12 text-blue-400" />
        </div>
      </div>

      {/* 內容區域 */}
      <div className="space-y-6">
        {/* 標題和描述 */}
        <div className="text-center space-y-2">
          <h3 className="text-xl md:text-2xl font-bold text-white">
            🔍 找到你的朋友
          </h3>
          <p className="text-white/70 text-sm md:text-base">
            同步聯繫人以找到使用 FitBuddy 的朋友，一起健身更有動力！
          </p>
        </div>

        {/* 表單 */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* 單選按鈕組 */}
          <div className="space-y-3">
            <Controller
              name="syncContacts"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value ? 'yes' : 'no'}
                  onValueChange={(value: 'yes' | 'no') => {
                    const newValue = value === 'yes';
                    field.onChange(newValue);
                    onUpdate({
                      syncContacts: newValue,
                    });
                  }}
                  className="space-y-3"
                >
                  {/* 是，同步聯繫人 */}
                  <div
                    className={`relative border-2 rounded-lg p-4 transition-all duration-200 cursor-pointer ${
                      field.value === true
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-gray-700 bg-slate-900/50 hover:border-slate-600'
                    }`}
                    onClick={() => {
                      field.onChange(true);
                      onUpdate({
                        syncContacts: true,
                      });
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem
                        value="yes"
                        id="sync-yes"
                        className="border-gray-700 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor="sync-yes"
                          className={`text-base font-medium cursor-pointer ${
                            field.value === true
                              ? 'text-emerald-500'
                              : 'text-white'
                          }`}
                        >
                          是，同步聯繫人
                        </Label>
                      </div>
                      {field.value === true && (
                        <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* 不，謝謝 */}
                  <div
                    className={`relative border-2 rounded-lg p-4 transition-all duration-200 cursor-pointer ${
                      field.value === false
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-gray-700 bg-slate-900/50 hover:border-slate-600'
                    }`}
                    onClick={() => {
                      field.onChange(false);
                      onUpdate({
                        syncContacts: false,
                      });
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem
                        value="no"
                        id="sync-no"
                        className="border-gray-700 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor="sync-no"
                          className={`text-base font-medium cursor-pointer ${
                            field.value === false
                              ? 'text-emerald-500'
                              : 'text-white'
                          }`}
                        >
                          不，謝謝
                        </Label>
                      </div>
                      {field.value === false && (
                        <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </RadioGroup>
              )}
            />
            {errors.syncContacts && (
              <p className="text-red-500 text-sm" role="alert">
                {errors.syncContacts.message}
              </p>
            )}
          </div>

          {/* 說明文字 */}
          {syncContacts && (
            <div className="bg-slate-900/50 border border-gray-700 rounded-lg p-4 space-y-2">
              <p className="text-white/80 text-sm">
                我們只會同步已註冊 FitBuddy 的聯繫人
              </p>
              <p className="text-white/60 text-xs">
                你的隱私受到保護，隨時可以在設置中取消同步
              </p>
            </div>
          )}

          {/* 完成按鈕 */}
          <Button
            type="submit"
            disabled={!isValid}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 py-3 text-base rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 shadow-lg hover:shadow-emerald-500/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-500"
            aria-label="完成註冊"
            data-testid="button-complete-registration"
          >
            完成並進入儀表板
          </Button>
        </form>
      </div>
    </div>
  );
}
