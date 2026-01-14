/**
 * FitBuddy 註冊流程 - 步驟 4: 活動量 & 目標
 * 
 * 生產級別的活動量和目標選擇組件
 * - 使用 React + TypeScript + React Hook Form
 * - React Query + Axios 統一架構（稍後集成）
 * - 完整的表單驗證
 * - 活動量單選和目標複選功能
 * 
 * 注意：稍後會使用 useRegisterStore (Zustand store)
 * 目前使用 props 傳遞的 onUpdate 函數更新狀態
 */

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

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

/**
 * 表單驗證 Schema
 */
const activityGoalSchema = z.object({
  activityLevel: z.enum(['low', 'moderate', 'high', 'very_high'], {
    required_error: '活動量為必填項',
  }),
  goals: z
    .array(z.enum(['lose_weight', 'gain_muscle', 'maintain_health', 'improve_fitness']))
    .min(1, '至少選擇一個健身目標'),
});

type ActivityGoalFormData = z.infer<typeof activityGoalSchema>;

// ========== Step4ActivityGoal 組件 ==========

/**
 * 步驟 4: 活動量 & 目標組件
 */
export default function Step4ActivityGoal({
  data,
  onUpdate,
  onNext,
}: Step4ActivityGoalProps): JSX.Element {
  // React Hook Form
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<ActivityGoalFormData>({
    resolver: zodResolver(activityGoalSchema),
    defaultValues: {
      activityLevel: (data.activityLevel as ActivityLevel) || 'low',
      goals: (data.goals as FitnessGoal[]) || [],
    },
    mode: 'onChange',
  });

  const activityLevel = watch('activityLevel');
  const goals = watch('goals') || [];

  // 監聽表單變化，實時更新到父組件
  React.useEffect(() => {
    if (activityLevel && goals.length > 0) {
      onUpdate({
        activityLevel,
        goals,
      });
    }
  }, [activityLevel, goals, onUpdate]);

  /**
   * 處理目標複選框變化
   */
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

    setValue('goals', newGoals, { shouldValidate: true });
    onUpdate({
      activityLevel: activityLevel || 'low',
      goals: newGoals,
    });
  };

  /**
   * 處理表單提交（前往下一步）
   */
  const onSubmit = (formData: ActivityGoalFormData) => {
    // 更新 store（稍後會改為使用 registerStore.updateStep(4, data)）
    onUpdate({
      activityLevel: formData.activityLevel,
      goals: formData.goals,
    });

    // 前往下一步（稍後會改為使用 registerStore.setCurrentStep(5)）
    if (onNext) {
      onNext();
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 標題區域 */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-white">建立你的帳號</h2>
        <p className="text-lg text-gray-400">步驟 4/6: 活動量和目標</p>
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 活動量選擇 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-white">活動量</Label>
          <Controller
            name="activityLevel"
            control={control}
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={(value: ActivityLevel) => {
                  field.onChange(value);
                  onUpdate({
                    activityLevel: value,
                    goals: goals || [],
                  });
                }}
                className="space-y-3"
              >
                {ACTIVITY_LEVELS.map((level) => (
                  <div
                    key={level.value}
                    className={`relative border-2 rounded-lg p-4 transition-all duration-200 cursor-pointer ${
                      field.value === level.value
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-gray-700 bg-slate-900/50 hover:border-slate-600'
                    }`}
                    onClick={() => {
                      field.onChange(level.value);
                      onUpdate({
                        activityLevel: level.value,
                        goals: goals || [],
                      });
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <RadioGroupItem
                        value={level.value}
                        id={`activity-${level.value}`}
                        className="mt-1 border-gray-700 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
                      />
                      <div className="flex-1 space-y-1">
                        <Label
                          htmlFor={`activity-${level.value}`}
                          className={`text-base font-semibold cursor-pointer ${
                            field.value === level.value
                              ? 'text-emerald-500'
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
                      {field.value === level.value && (
                        <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </RadioGroup>
            )}
          />
          {errors.activityLevel && (
            <p className="text-red-500 text-sm" role="alert">
              {errors.activityLevel.message}
            </p>
          )}
        </div>

        {/* 健身目標選擇 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-white">健身目標</Label>
          <div className="space-y-3">
            {FITNESS_GOALS.map((goal) => {
              const isChecked = goals.includes(goal.value as FitnessGoal);
              return (
                <div
                  key={goal.value}
                  className={`relative border-2 rounded-lg p-4 transition-all duration-200 cursor-pointer ${
                    isChecked
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-gray-700 bg-slate-900/50 hover:border-slate-600'
                  }`}
                  onClick={() => handleGoalChange(goal.value as FitnessGoal, !isChecked)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`goal-${goal.value}`}
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        handleGoalChange(goal.value as FitnessGoal, checked === true)
                      }
                      className="border-gray-700 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    />
                    <Label
                      htmlFor={`goal-${goal.value}`}
                      className={`flex-1 text-base font-medium cursor-pointer ${
                        isChecked ? 'text-emerald-500' : 'text-white'
                      }`}
                    >
                      {goal.label}
                    </Label>
                    {isChecked && (
                      <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {errors.goals && (
            <p className="text-red-500 text-sm" role="alert">
              {errors.goals.message}
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
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 py-3 text-base rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 shadow-lg hover:shadow-emerald-500/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-500"
          aria-label="下一步"
          data-testid="button-next-step4"
        >
          下一步
        </Button>
      </form>
    </div>
  );
}
