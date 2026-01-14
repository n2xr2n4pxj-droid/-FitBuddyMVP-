/**
 * FitBuddy 註冊流程 - 步驟 3: 個人信息 (TDEE 第一部分)
 * 
 * 生產級別的個人信息輸入組件
 * - 使用 React + TypeScript + React Hook Form
 * - React Query + Axios 統一架構（稍後集成）
 * - 完整的表單驗證
 * - 單位轉換功能
 * - 自動年齡計算
 * 
 * 注意：稍後會使用 useRegisterStore (Zustand store)
 * 目前使用 props 傳遞的 onUpdate 函數更新狀態
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';

// ========== 類型定義 ==========

/**
 * Step3TDEEPart1 組件的 Props
 */
export interface Step3TDEEPart1Props {
  /**
   * 當前步驟數據
   */
  data: {
    birthDate: Date | null;
    gender: 'male' | 'female' | null;
    height: number | null;
    weight: number | null;
  };

  /**
   * 更新步驟數據的回調函數
   * 稍後會改為使用 registerStore.updateStep(3, data)
   */
  onUpdate: (data: {
    birthDate: Date | null;
    gender: 'male' | 'female';
    height: number;
    weight: number;
  }) => void;

  /**
   * 前往下一步的回調函數
   * 稍後會改為使用 registerStore.setCurrentStep(4)
   */
  onNext?: () => void;
}

// ========== 工具函數 ==========

/**
 * 獲取指定月份的天數
 */
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

/**
 * 計算年齡
 */
const calculateAge = (birthDate: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * 單位轉換函數
 */
const convertHeight = {
  cmToInches: (cm: number): number => cm * 0.3937,
  inchesToCm: (inches: number): number => inches / 0.3937,
};

const convertWeight = {
  kgToLbs: (kg: number): number => kg * 2.20462,
  lbsToKg: (lbs: number): number => lbs / 2.20462,
};

// ========== 驗證 Schema ==========

/**
 * 表單驗證 Schema
 */
const tdeePart1Schema = z.object({
  birthYear: z
    .string()
    .min(1, '出生年份為必填項')
    .refine((val) => {
      const year = parseInt(val, 10);
      return year >= 1950 && year <= 2020;
    }, '出生年份必須在 1950-2020 之間'),
  birthMonth: z
    .string()
    .min(1, '出生月份為必填項')
    .refine((val) => {
      const month = parseInt(val, 10);
      return month >= 1 && month <= 12;
    }, '出生月份必須在 1-12 之間'),
  birthDay: z
    .string()
    .min(1, '出生日期為必填項')
    .refine((val) => {
      const day = parseInt(val, 10);
      return day >= 1 && day <= 31;
    }, '出生日期必須在 1-31 之間'),
  gender: z.enum(['male', 'female'], {
    required_error: '性別為必填項',
  }),
  heightValue: z
    .string()
    .min(1, '身高為必填項')
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, '身高必須大於 0'),
  heightUnit: z.enum(['cm', 'inches']),
  weightValue: z
    .string()
    .min(1, '體重為必填項')
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, '體重必須大於 0'),
  weightUnit: z.enum(['kg', 'lbs']),
}).refine((data) => {
  // 驗證出生日期是否有效（考慮月份天數）
  const year = parseInt(data.birthYear, 10);
  const month = parseInt(data.birthMonth, 10);
  const day = parseInt(data.birthDay, 10);
  const daysInMonth = getDaysInMonth(year, month);
  return day <= daysInMonth;
}, {
  message: '無效的日期',
  path: ['birthDay'],
}).refine((data) => {
  // 驗證年齡 >= 18 歲
  const year = parseInt(data.birthYear, 10);
  const month = parseInt(data.birthMonth, 10) - 1; // Date 月份從 0 開始
  const day = parseInt(data.birthDay, 10);
  const birthDate = new Date(year, month, day);
  const age = calculateAge(birthDate);
  return age >= 18;
}, {
  message: '年齡必須至少 18 歲',
  path: ['birthYear'],
});

type TDEEPart1FormData = z.infer<typeof tdeePart1Schema>;

// ========== Step3TDEEPart1 組件 ==========

/**
 * 步驟 3: 個人信息 (TDEE 第一部分) 組件
 */
export default function Step3TDEEPart1({
  data,
  onUpdate,
  onNext,
}: Step3TDEEPart1Props): JSX.Element {
  // 單位狀態
  const [heightUnit, setHeightUnit] = useState<'cm' | 'inches'>('cm');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

  // 初始化表單數據
  const initializeFormData = (): Partial<TDEEPart1FormData> => {
    const result: Partial<TDEEPart1FormData> = {
      gender: (data.gender || 'male') as 'male' | 'female',
      heightUnit: 'cm',
      weightUnit: 'kg',
    };

    // 解析出生日期
    if (data.birthDate) {
      const date = new Date(data.birthDate);
      result.birthYear = date.getFullYear().toString();
      result.birthMonth = (date.getMonth() + 1).toString(); // Date 月份從 0 開始
      result.birthDay = date.getDate().toString();
    }

    // 解析身高和體重（統一轉換為 cm 和 kg）
    if (data.height !== null) {
      result.heightValue = data.height.toString();
    }
    if (data.weight !== null) {
      result.weightValue = data.weight.toString();
    }

    return result;
  };

  // React Hook Form
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<TDEEPart1FormData>({
    resolver: zodResolver(tdeePart1Schema),
    defaultValues: {
      ...initializeFormData(),
    },
    mode: 'onChange',
  });

  const birthYear = watch('birthYear');
  const birthMonth = watch('birthMonth');
  const birthDay = watch('birthDay');
  const heightValue = watch('heightValue');
  const weightValue = watch('weightValue');

  // 計算可用天數（根據年份和月份）
  const availableDays = useMemo(() => {
    if (!birthYear || !birthMonth) return 31;
    const year = parseInt(birthYear, 10);
    const month = parseInt(birthMonth, 10);
    return getDaysInMonth(year, month);
  }, [birthYear, birthMonth]);

  // 計算年齡
  const calculatedAge = useMemo(() => {
    if (!birthYear || !birthMonth || !birthDay) return null;
    try {
      const year = parseInt(birthYear, 10);
      const month = parseInt(birthMonth, 10) - 1;
      const day = parseInt(birthDay, 10);
      const birthDate = new Date(year, month, day);
      
      // 驗證日期有效性
      if (
        birthDate.getFullYear() === year &&
        birthDate.getMonth() === month &&
        birthDate.getDate() === day
      ) {
        return calculateAge(birthDate);
      }
    } catch (error) {
      // 無效日期
    }
    return null;
  }, [birthYear, birthMonth, birthDay]);

  // 生成選項數組
  const years = Array.from({ length: 71 }, (_, i) => 1950 + i); // 1950-2020
  const months = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
  const days = Array.from({ length: availableDays }, (_, i) => i + 1); // 1-availableDays

  /**
   * 處理身高單位切換
   */
  const handleHeightUnitChange = (newUnit: 'cm' | 'inches') => {
    if (!heightValue) {
      setHeightUnit(newUnit);
      setValue('heightUnit', newUnit);
      return;
    }

    const currentValue = parseFloat(heightValue);
    if (isNaN(currentValue)) return;

    let convertedValue: number;
    if (heightUnit === 'cm' && newUnit === 'inches') {
      convertedValue = convertHeight.cmToInches(currentValue);
    } else if (heightUnit === 'inches' && newUnit === 'cm') {
      convertedValue = convertHeight.inchesToCm(currentValue);
    } else {
      return;
    }

    setValue('heightValue', convertedValue.toFixed(1));
    setHeightUnit(newUnit);
    setValue('heightUnit', newUnit);
  };

  /**
   * 處理體重單位切換
   */
  const handleWeightUnitChange = (newUnit: 'kg' | 'lbs') => {
    if (!weightValue) {
      setWeightUnit(newUnit);
      setValue('weightUnit', newUnit);
      return;
    }

    const currentValue = parseFloat(weightValue);
    if (isNaN(currentValue)) return;

    let convertedValue: number;
    if (weightUnit === 'kg' && newUnit === 'lbs') {
      convertedValue = convertWeight.kgToLbs(currentValue);
    } else if (weightUnit === 'lbs' && newUnit === 'kg') {
      convertedValue = convertWeight.lbsToKg(currentValue);
    } else {
      return;
    }

    setValue('weightValue', convertedValue.toFixed(1));
    setWeightUnit(newUnit);
    setValue('weightUnit', newUnit);
  };

  /**
   * 監聽表單變化，實時更新到父組件
   */
  useEffect(() => {
    const subscription = watch((formData) => {
      if (
        formData.birthYear &&
        formData.birthMonth &&
        formData.birthDay &&
        formData.gender &&
        formData.heightValue &&
        formData.weightValue
      ) {
        try {
          const year = parseInt(formData.birthYear, 10);
          const month = parseInt(formData.birthMonth, 10) - 1;
          const day = parseInt(formData.birthDay, 10);
          const birthDate = new Date(year, month, day);

          // 驗證日期有效性
          if (
            birthDate.getFullYear() === year &&
            birthDate.getMonth() === month &&
            birthDate.getDate() === day
          ) {
            // 轉換身高為 cm
            let heightInCm = parseFloat(formData.heightValue);
            if (formData.heightUnit === 'inches') {
              heightInCm = convertHeight.inchesToCm(heightInCm);
            }

            // 轉換體重為 kg
            let weightInKg = parseFloat(formData.weightValue);
            if (formData.weightUnit === 'lbs') {
              weightInKg = convertWeight.lbsToKg(weightInKg);
            }

            onUpdate({
              birthDate,
              gender: formData.gender,
              height: heightInCm,
              weight: weightInKg,
            });
          }
        } catch (error) {
          // 忽略錯誤
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, onUpdate]);

  /**
   * 處理表單提交（前往下一步）
   */
  const onSubmit = (formData: TDEEPart1FormData) => {
    const year = parseInt(formData.birthYear, 10);
    const month = parseInt(formData.birthMonth, 10) - 1;
    const day = parseInt(formData.birthDay, 10);
    const birthDate = new Date(year, month, day);

    // 轉換身高為 cm
    let heightInCm = parseFloat(formData.heightValue);
    if (formData.heightUnit === 'inches') {
      heightInCm = convertHeight.inchesToCm(heightInCm);
    }

    // 轉換體重為 kg
    let weightInKg = parseFloat(formData.weightValue);
    if (formData.weightUnit === 'lbs') {
      weightInKg = convertWeight.lbsToKg(weightInKg);
    }

    // 更新 store（稍後會改為使用 registerStore.updateStep(3, data)）
    onUpdate({
      birthDate,
      gender: formData.gender,
      height: heightInCm,
      weight: weightInKg,
    });

    // 前往下一步（稍後會改為使用 registerStore.setCurrentStep(4)）
    if (onNext) {
      onNext();
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 標題區域 */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-white">建立你的帳號</h2>
        <p className="text-lg text-gray-400">
          步驟 3/6: 個人信息 (用於計算 TDEE)
        </p>
      </div>

      {/* 表單 */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* 出生日期 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white">出生日期</Label>
          <div className="grid grid-cols-3 gap-2">
            {/* 年份 */}
            <Controller
              name="birthYear"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    className="bg-slate-900/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500"
                    aria-invalid={errors.birthYear ? 'true' : 'false'}
                  >
                    <SelectValue placeholder="年" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year} 年
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />

            {/* 月份 */}
            <Controller
              name="birthMonth"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    className="bg-slate-900/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500"
                    aria-invalid={errors.birthMonth ? 'true' : 'false'}
                  >
                    <SelectValue placeholder="月" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {months.map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {month} 月
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />

            {/* 日期 */}
            <Controller
              name="birthDay"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                  }}
                >
                  <SelectTrigger
                    className="bg-slate-900/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500"
                    aria-invalid={errors.birthDay ? 'true' : 'false'}
                  >
                    <SelectValue placeholder="日" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {days.map((day) => (
                      <SelectItem key={day} value={day.toString()}>
                        {day} 日
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {errors.birthYear && (
            <p className="text-red-500 text-sm" role="alert">
              {errors.birthYear.message}
            </p>
          )}
          {errors.birthMonth && (
            <p className="text-red-500 text-sm" role="alert">
              {errors.birthMonth.message}
            </p>
          )}
          {errors.birthDay && (
            <p className="text-red-500 text-sm" role="alert">
              {errors.birthDay.message}
            </p>
          )}

          {/* 年齡顯示 */}
          {calculatedAge !== null && (
            <div className="mt-2 p-3 bg-slate-900/50 border border-gray-700 rounded-lg">
              <p className="text-white text-sm">
                年齡: <span className="font-semibold">{calculatedAge} 歲</span>
              </p>
              <p className="text-white/60 text-xs mt-1">
                年齡會影響你的卡路里需求
              </p>
            </div>
          )}
        </div>

        {/* 性別 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white">性別</Label>
          <Controller
            name="gender"
            control={control}
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={(value: 'male' | 'female') => field.onChange(value)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="female"
                    id="gender-female"
                    className="border-gray-700 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
                  />
                  <Label
                    htmlFor="gender-female"
                    className="text-white cursor-pointer flex items-center gap-2"
                  >
                    <span className="text-lg">♀</span>
                    <span>女性</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="male"
                    id="gender-male"
                    className="border-gray-700 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
                  />
                  <Label
                    htmlFor="gender-male"
                    className="text-white cursor-pointer flex items-center gap-2"
                  >
                    <span className="text-lg">♂</span>
                    <span>男性</span>
                  </Label>
                </div>
              </RadioGroup>
            )}
          />
          {errors.gender && (
            <p className="text-red-500 text-sm" role="alert">
              {errors.gender.message}
            </p>
          )}
          <p className="text-white/60 text-xs">性別會影響你的新陳代謝</p>
        </div>

        {/* 身高 */}
        <div className="space-y-2">
          <Label htmlFor="height" className="text-sm font-medium text-white">
            身高
          </Label>
          <div className="flex gap-2">
            <Controller
              name="heightValue"
              control={control}
              render={({ field }) => (
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  placeholder="173"
                  className={`flex-1 bg-slate-900/50 border-gray-700 text-white placeholder:text-white/40 focus:border-emerald-500 focus:ring-emerald-500 ${
                    errors.heightValue
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                      : ''
                  }`}
                  {...field}
                  aria-invalid={errors.heightValue ? 'true' : 'false'}
                  aria-describedby={errors.heightValue ? 'height-error' : undefined}
                />
              )}
            />
            <Controller
              name="heightUnit"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || heightUnit}
                  onValueChange={(value: 'cm' | 'inches') => {
                    field.onChange(value);
                    handleHeightUnitChange(value);
                  }}
                >
                  <SelectTrigger className="w-24 bg-slate-900/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cm">厘米</SelectItem>
                    <SelectItem value="inches">英吋</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {errors.heightValue && (
            <p id="height-error" className="text-red-500 text-sm" role="alert">
              {errors.heightValue.message}
            </p>
          )}
        </div>

        {/* 體重 */}
        <div className="space-y-2">
          <Label htmlFor="weight" className="text-sm font-medium text-white">
            體重
          </Label>
          <div className="flex gap-2">
            <Controller
              name="weightValue"
              control={control}
              render={({ field }) => (
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  placeholder="70"
                  className={`flex-1 bg-slate-900/50 border-gray-700 text-white placeholder:text-white/40 focus:border-emerald-500 focus:ring-emerald-500 ${
                    errors.weightValue
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                      : ''
                  }`}
                  {...field}
                  aria-invalid={errors.weightValue ? 'true' : 'false'}
                  aria-describedby={errors.weightValue ? 'weight-error' : undefined}
                />
              )}
            />
            <Controller
              name="weightUnit"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || weightUnit}
                  onValueChange={(value: 'kg' | 'lbs') => {
                    field.onChange(value);
                    handleWeightUnitChange(value);
                  }}
                >
                  <SelectTrigger className="w-24 bg-slate-900/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">公斤</SelectItem>
                    <SelectItem value="lbs">磅</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {errors.weightValue && (
            <p id="weight-error" className="text-red-500 text-sm" role="alert">
              {errors.weightValue.message}
            </p>
          )}
        </div>

        {/* 下一步按鈕 */}
        <Button
          type="submit"
          disabled={!isValid}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 py-3 text-base rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 shadow-lg hover:shadow-emerald-500/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-500"
          aria-label="下一步"
          data-testid="button-next-step3"
        >
          下一步
        </Button>
      </form>
    </div>
  );
}
