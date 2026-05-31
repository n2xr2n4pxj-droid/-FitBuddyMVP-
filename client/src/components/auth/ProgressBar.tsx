/**
 * FitBuddy 註冊流程進度條組件
 * 
 * 生產級別的進度條組件
 * - 使用 React + TypeScript + Tailwind CSS
 * - 顯示當前步驟和總步驟數
 * - 視覺化進度指示
 * 
 * @component
 */

import React from 'react';

// ========== 類型定義 ==========

/**
 * ProgressBar 組件的 Props
 */
export interface ProgressBarProps {
  /**
   * 當前步驟（從 1 開始）
   */
  currentStep: number;

  /**
   * 總步驟數
   */
  totalSteps: number;

  /**
   * 可選的自定義類名
   */
  className?: string;

  /**
   * 是否顯示百分比文字
   * @default true
   */
  showPercentage?: boolean;

  /**
   * 是否顯示步驟文字
   * @default true
   */
  showStepText?: boolean;
}

// ========== ProgressBar 組件 ==========

/**
 * ProgressBar 組件
 * 
 * 顯示註冊流程的進度條，包括：
 * - 步驟文字（如 "步驟 3/6"）
 * - 百分比文字（可選）
 * - 視覺化進度條
 * 
 * @example
 * ```tsx
 * <ProgressBar currentStep={3} totalSteps={6} />
 * ```
 */
function ProgressBar({
  currentStep,
  totalSteps,
  className = '',
  showPercentage = true,
  showStepText = true,
}: ProgressBarProps): JSX.Element {
  // 計算進度百分比
  // 確保 currentStep 在有效範圍內
  const clampedStep = Math.max(1, Math.min(currentStep, totalSteps));
  const percentage = (clampedStep / totalSteps) * 100;

  // 驗證 props
  if (totalSteps < 1) {
    console.warn('ProgressBar: totalSteps must be at least 1');
  }

  if (currentStep < 0 || currentStep > totalSteps) {
    console.warn(
      `ProgressBar: currentStep (${currentStep}) should be between 1 and ${totalSteps}`
    );
  }

  return (
    <div className={`w-full space-y-2 ${className}`}>
      {/* 文字信息區域 */}
      {(showStepText || showPercentage) && (
        <div className="flex items-center justify-between text-sm">
          {showStepText && (
            <span className="text-sm text-neutral-400 font-mono">
              Step {clampedStep} of {totalSteps}
            </span>
          )}

          {showPercentage && (
            <span className="text-sm text-neutral-400 font-mono">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}

      <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={clampedStep}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-label={`進度：步驟 ${clampedStep}，共 ${totalSteps} 步`}
        />
      </div>
    </div>
  );
}

// 導出組件
export default ProgressBar;

