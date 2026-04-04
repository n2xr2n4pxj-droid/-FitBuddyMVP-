/**
 * FitBuddy 註冊流程 - 步驟 4: 活動量 & 目標
 * 
 * 生產級別的活動量和目標選擇組件
 * - 使用 React + TypeScript + 純 React 狀態（已移除 React Hook Form）
 * - React Query + Axios 統一架構（稍後集成）
 * - 完整的表單驗證（本地驗證）
 * - 活動量單選和目標複選功能
 * 
 * 注意：稍後會使用 useRegisterStore (Zustand store)
 * 目前使用 props 傳遞的 onUpdate 函數更新狀態
 */

import React, { useState } from 'react';
// ✅ 終極修復：完全移除 React Hook Form，改用純 React 狀態
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { regPrimaryButtonClass, regStepSubtitleClass, regStepTitleClass } from './register-ui';

// ========== 類型定義 ==========

/**
 * 活動量選項類型
 */
export type ActivityLevel = 'low' | 'moderate' | 'high' | 'very_high';

/**
 * 健身目標選項類型
 */
export type FitnessGoal = 'lose_weight' | 'gain_muscle' | 'maintain_health' | 'improve_fitness';

/**
 * Step4ActivityGoal 組件的 Props
 */
export interface Step4ActivityGoalProps {
  /**
   * 當前步驟數據
   */
  data: {
    activityLevel: string;
    goals: string[];
  };

  /**
   * 更新步驟數據的回調函數
   * 稍後會改為使用 registerStore.updateStep(4, data)
   */
  onUpdate: (data: { activityLevel: string; goals: string[] }) => void;

  /**
   * 前往下一步的回調函數
   * 稍後會改為使用 registerStore.setCurrentStep(5)
   */
  onNext?: () => void;
}

// ========== 常量定義 ==========

/**
 * 活動量選項配置
 */
const ACTIVITY_LEVELS: Array<{
  value: ActivityLevel;
  label: string;
  description: string;
  detail: string;
}> = [
  {
    value: 'low',
    label: '低',
    description: '大多時間坐著',
    detail: '(辦公室工作、駕駛)',
  },
  {
    value: 'moderate',
    label: '中等',
    description: '白天有輕度運動',
    detail: '(老師、售貨員、家務)',
  },
  {
    value: 'high',
    label: '高',
    description: '整天走動或站立',
    detail: '(護理師、技術工人)',
  },
  {
    value: 'very_high',
    label: '非常高',
    description: '從事體力勞動',
    detail: '(運動員、工地工人)',
  },
];

/**
 * 健身目標選項配置
 */
const FITNESS_GOALS: Array<{
  value: FitnessGoal;
  label: string;
}> = [
  { value: 'lose_weight', label: '減肥' },
  { value: 'gain_muscle', label: '增肌' },
  { value: 'maintain_health', label: '保持健康' },
  { value: 'improve_fitness', label: '改善體能' },
];

// ========== 驗證 Schema ==========
// ✅ 終極修復：移除 zod schema，改用本地驗證函數

// ========== Step4ActivityGoal 組件 ==========

/**
 * 步驟 4: 活動量 & 目標組件
 */
export default function Step4ActivityGoal({
  data,
  onUpdate,
  onNext,
}: Step4ActivityGoalProps): JSX.Element {
  // ✅ 終極修復：完全移除 React Hook Form，改用純 React 狀態
  // 這樣可以避免 Controller 與 RadioGroup 的交互問題
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    (data.activityLevel as ActivityLevel) || 'low'
  );
  const [goals, setGoals] = useState<FitnessGoal[]>(
    (data.goals as FitnessGoal[]) || []
  );
  
  // 本地驗證狀態
  const [errors, setErrors] = useState<{
    activityLevel?: string;
    goals?: string;
  }>({});
  
  // 驗證函數
  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    
    if (!activityLevel) {
      newErrors.activityLevel = '活動量為必填項';
    }
    
    if (!goals || goals.length === 0) {
      newErrors.goals = '至少選擇一個健身目標';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const isValid = activityLevel && goals && goals.length > 0;

  /**
   * 處理活動量變化
   */
  // ✅ 終極修復：直接更新本地狀態，不通過 React Hook Form
  const handleActivityLevelChange = (value: ActivityLevel) => {
    setActivityLevel(value);
    // 清除錯誤
    if (errors.activityLevel) {
      setErrors((prev) => ({ ...prev, activityLevel: undefined }));
    }
  };

  /**
   * 處理目標複選框變化
   */
  // ✅ 終極修復：直接更新本地狀態，不調用 onUpdate
  const handleGoalChange = (goal: FitnessGoal, checked: boolean) => {
    const currentGoals = goals || [];
    let newGoals: FitnessGoal[];

    if (checked) {
      // 添加目標
      newGoals = [...currentGoals, goal] as FitnessGoal[];
    } else {
      // 移除目標
      newGoals = currentGoals.filter((g) => g !== goal) as FitnessGoal[];
    }

    // ✅ 只更新本地狀態，不觸發父組件更新
    setGoals(newGoals);
    // 清除錯誤
    if (errors.goals) {
      setErrors((prev) => ({ ...prev, goals: undefined }));
    }
  };

  /**
   * 處理表單提交（前往下一步）
   */
  // ✅ 終極修復：只在提交時調用 onUpdate，確保只調用一次
  // ✅ 修復：使用 useRef 防止重複調用（React.StrictMode 問題）
  const isSubmittingRef = React.useRef(false);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ 防止重複提交（React.StrictMode 在開發環境會掛載兩次）
    if (isSubmittingRef.current) {
      console.log('⚠️ [Step4ActivityGoal] handleSubmit already called, skipping...');
      return;
    }
    
    isSubmittingRef.current = true;
    console.log('✅ [Step4ActivityGoal] handleSubmit called - ONLY CALLED ONCE');
    
    // 驗證
    if (!validate()) {
      isSubmittingRef.current = false; // 驗證失敗，重置標記
      return;
    }
    
    // ✅ 更新父組件狀態（先更新）
    console.log('[Step4ActivityGoal] Calling onUpdate with data...');
    onUpdate({
      activityLevel,
      goals,
    });

    // ✅ 前往下一步（後調用，此時 onUpdate 已觸發狀態更新）
    // useEffect 會在 registerState 更新後自動驗證並進入下一步
    console.log('[Step4ActivityGoal] Calling onNext...');
    if (onNext) {
      onNext();
    }
    
    // ✅ 重置提交標記（延遲一點，確保狀態更新完成）
    setTimeout(() => {
      isSubmittingRef.current = false;
    }, 300);
  };

  return (
    <div className="w-full space-y-6">
      {/* 標題區域 */}
      <div>
        <h2 className={regStepTitleClass}>建立你的帳號</h2>
        <p className={regStepSubtitleClass}>步驟 4/7：活動量與目標</p>
      </div>

      {/* 提示框 */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="flex-1 space-y-1">
            <p className="text-blue-300 text-sm font-semibold">小提示:</p>
            <p className="text-blue-200/90 text-sm">
              如果不確定選哪個，建議選低一級，避免高估你的熱量需求。
            </p>
          </div>
        </div>
      </div>

      {/* 表單 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 活動量選擇 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-white">活動量</Label>
          {/* ✅ 終極修復：完全移除 Controller，直接使用 RadioGroup */}
          {/* ✅ 快速修復：移除 onClick 雙重觸發，只使用 onValueChange */}
          <RadioGroup
            value={activityLevel}
            onValueChange={(value) => handleActivityLevelChange(value as ActivityLevel)}
            className="space-y-3"
          >
            {ACTIVITY_LEVELS.map((level) => (
              <div
                key={level.value}
                className={`relative border-2 rounded-lg p-4 transition-all duration-200 cursor-pointer ${
                  activityLevel === level.value
                    ? 'border-blue-600 bg-blue-600/10'
                    : 'border-gray-700 bg-slate-900/50 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    value={level.value}
                    id={`activity-${level.value}`}
                    className="mt-1 border-gray-700 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={`activity-${level.value}`}
                      className={`text-base font-semibold cursor-pointer ${
                        activityLevel === level.value
                          ? 'text-blue-400'
                          : 'text-white'
                      }`}
                    >
                      {level.label}
                    </Label>
                    <p className="text-white/80 text-sm">{level.description}</p>
                    <p className="text-white/60 text-xs">{level.detail}</p>
                    {level.value === 'very_high' && (
                      <p className="text-white/50 text-xs mt-1">
                        適用於高度活躍的生活型態
                      </p>
                    )}
                  </div>
                  {activityLevel === level.value && (
                    <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </RadioGroup>
          {errors.activityLevel && (
            <p className="text-red-500 text-sm" role="alert">
              {errors.activityLevel}
            </p>
          )}
        </div>

        {/* 健身目標選擇 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-white">健身目標</Label>
          <div className="space-y-3">
            {FITNESS_GOALS.map((goal) => {
              // ✅ 終極修復：使用本地狀態
              const isChecked = goals.includes(goal.value as FitnessGoal);
              return (
                <div
                  key={goal.value}
                  className={`relative border-2 rounded-lg p-4 transition-all duration-200 cursor-pointer ${
                    isChecked
                      ? 'border-blue-600 bg-blue-600/10'
                      : 'border-gray-700 bg-slate-900/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* ✅ 快速修復：移除 onClick 雙重觸發，只使用 onCheckedChange */}
                    <Checkbox
                      id={`goal-${goal.value}`}
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        handleGoalChange(goal.value as FitnessGoal, checked === true)
                      }
                      className="border-gray-700 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <Label
                      htmlFor={`goal-${goal.value}`}
                      className={`flex-1 text-base font-medium cursor-pointer ${
                        isChecked ? 'text-blue-400' : 'text-white'
                      }`}
                    >
                      {goal.label}
                    </Label>
                    {isChecked && (
                      <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {errors.goals && (
            <p className="text-red-500 text-sm" role="alert">
              {errors.goals}
            </p>
          )}
          <p className="text-white/60 text-xs">
            可以選擇多個目標，至少選擇一個
          </p>
        </div>

        {/* 下一步按鈕 */}
        <Button
          type="submit"
          disabled={!isValid}
          className={regPrimaryButtonClass}
          aria-label="下一步"
          data-testid="button-next-step4"
        >
          下一步
        </Button>
      </form>
    </div>
  );
}
