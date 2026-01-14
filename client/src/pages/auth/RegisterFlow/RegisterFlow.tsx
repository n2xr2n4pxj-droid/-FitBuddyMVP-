/**
 * FitBuddy 註冊流程主容器組件
 * 
 * 多步驟註冊表單容器
 * - 使用 React + TypeScript + Zustand (稍後會創建 store)
 * - 管理 7 個步驟的註冊流程
 * - 深色主題設計
 * 
 * 注意：項目使用 wouter 而非 react-router-dom
 * 如需使用 react-router-dom，請先安裝並配置：npm install react-router-dom
 */

import React, { useState, useMemo } from 'react';
import { useLocation } from 'wouter'; // 項目使用 wouter 而非 react-router-dom
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProgressBar from '@/components/auth/ProgressBar';
import Step1Username from './Step1Username';
import Step2EmailPassword from './Step2EmailPassword';
import Step3TDEEPart1 from './Step3TDEEPart1';
import Step4ActivityGoal from './Step4ActivityGoal';
import Step5Newsletter from './Step5Newsletter';
import Step6Friends from './Step6Friends';
import Step7RoleSelection from './Step7RoleSelection';

// ========== 類型定義 ==========

/**
 * 註冊狀態類型定義
 * 包含當前步驟和所有步驟的數據
 */
export type RegisterState = {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  step1: {
    username: string;
  };
  step2: {
    email: string;
    password: string;
    agreeToTerms: boolean;
  };
  step3: {
    birthDate: Date | null;
    gender: 'male' | 'female' | null;
    height: number | null;
    weight: number | null;
  };
  step4: {
    activityLevel: string;
    goals: string[];
  };
  step5: {
    subscribeNewsletter: boolean;
  };
  step6: {
    syncContacts: boolean;
  };
  step7: {
    role: 'client' | 'coach' | 'both' | 'admin' | null;
  };
};

// ========== 步驟組件 Placeholders ==========

// Step1Username 組件已移至單獨文件
// import Step1Username from './Step1Username';

// Step2EmailPassword 組件已移至單獨文件
// import Step2EmailPassword from './Step2EmailPassword';

// Step3TDEEPart1 組件已移至單獨文件
// import Step3TDEEPart1 from './Step3TDEEPart1';

// Step4ActivityGoal 組件已移至單獨文件
// import Step4ActivityGoal from './Step4ActivityGoal';

// Step5Newsletter 組件已移至單獨文件
// import Step5Newsletter from './Step5Newsletter';

// Step6Friends 組件已移至單獨文件
// import Step6Friends from './Step6Friends';


// ========== RegisterFlow 主組件 ==========

/**
 * RegisterFlow 主容器組件
 */
export default function RegisterFlow(): JSX.Element {
  // 使用 wouter 的 useLocation hook（項目實際使用 wouter 而非 react-router-dom）
  // 如果需要 react-router-dom 的 useNavigate，請先安裝並配置 react-router-dom
  const [location, setLocation] = useLocation();

  // ✅ 優化：使用 useMemo 緩存初始步驟計算結果，避免重複計算
  const initialStep = useMemo((): 1 | 2 | 3 | 4 | 5 | 6 | 7 => {
    try {
      // ✅ 優化：使用更快的 URLSearchParams API
      const searchParams = new URLSearchParams(window.location.search);
      const stepParam = searchParams.get('step');
      if (stepParam) {
        const step = parseInt(stepParam, 10);
        if (step >= 1 && step <= 7) {
          return step as 1 | 2 | 3 | 4 | 5 | 6 | 7;
        }
      }
    } catch (error) {
      // URL 解析失敗，使用默認值
      console.error('[RegisterFlow] Error parsing URL:', error);
    }
    return 1;
  }, []); // ✅ 只在組件掛載時計算一次

  // 暫時使用 useState 管理狀態，稍後會遷移到 Zustand store
  const [registerState, setRegisterState] = useState<RegisterState>({
    currentStep: initialStep,
    step1: {
      username: '',
    },
    step2: {
      email: '',
      password: '',
      agreeToTerms: false,
    },
    step3: {
      birthDate: null,
      gender: null,
      height: null,
      weight: null,
    },
    step4: {
      activityLevel: '',
      goals: [],
    },
    step5: {
      subscribeNewsletter: false,
    },
    step6: {
      syncContacts: false,
    },
    step7: {
      role: null,
    },
  });

  const { currentStep } = registerState;
  const totalSteps = 7;

  /**
   * 更新當前步驟的數據
   */
  const updateStepData = <K extends keyof RegisterState>(
    stepKey: K,
    data: Partial<RegisterState[K]>
  ): void => {
    setRegisterState((prev) => {
      const currentStepData = prev[stepKey] as RegisterState[K];
      if (typeof currentStepData === 'object' && currentStepData !== null) {
        return {
          ...prev,
          [stepKey]: {
            ...currentStepData,
            ...data,
          } as RegisterState[K],
        };
      }
      return prev;
    });
  };

  /**
   * 驗證當前步驟
   * 稍後會實現具體的驗證邏輯
   */
  const validateCurrentStep = (): boolean => {
    // TODO: 實現各步驟的驗證邏輯
    switch (currentStep) {
      case 1:
        return registerState.step1.username.trim().length > 0;
      case 2:
        return (
          registerState.step2.email.trim().length > 0 &&
          registerState.step2.password.length >= 6 &&
          registerState.step2.agreeToTerms
        );
      case 3:
        return (
          registerState.step3.birthDate !== null &&
          registerState.step3.gender !== null &&
          registerState.step3.height !== null &&
          registerState.step3.weight !== null
        );
      case 4:
        return (
          registerState.step4.activityLevel.length > 0 &&
          registerState.step4.goals.length > 0
        );
      case 5:
        return true; // 訂閱是可選的
      case 6:
        return true; // 同步聯繫人是可選的
      case 7:
        return registerState.step7.role !== null; // 角色選擇是必需的
      default:
        return false;
    }
  };

  /**
   * 處理下一步
   */
  const handleNext = (): void => {
    // 驗證當前步驟
    if (!validateCurrentStep()) {
      // TODO: 顯示錯誤提示
      console.warn('當前步驟驗證失敗');
      return;
    }

    // 更新 store（暫時只是狀態更新）
    // TODO: 稍後遷移到 Zustand store

    // 進行下一步
    if (currentStep < totalSteps) {
      setRegisterState((prev) => ({
        ...prev,
        currentStep: (prev.currentStep + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      }));
    } else {
      // 最後一步：完成註冊並進入儀表盤
      handleComplete();
    }
  };

  /**
   * 處理上一步
   */
  const handleBack = (): void => {
    if (currentStep > 1) {
      setRegisterState((prev) => ({
        ...prev,
        currentStep: (prev.currentStep - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      }));
    }
  };

  /**
   * 處理完成註冊
   */
  const handleComplete = (): void => {
    // TODO: 實現註冊邏輯
    console.log('註冊數據:', registerState);
    
    // 導航到儀表盤
    setLocation('/dashboard');
  };

  /**
   * 處理返回/關閉
   */
  const handleClose = (): void => {
    // 如果當前步驟 >= 3（從 OAuth 跳轉來），返回 Dashboard
    // 否則返回登入頁面
    if (currentStep >= 3) {
      setLocation('/dashboard');
    } else {
      setLocation('/login');
    }
  };

  /**
   * 渲染當前步驟的組件
   */
  const renderCurrentStep = (): JSX.Element => {
    switch (currentStep) {
      case 1:
        return (
          <Step1Username
            data={registerState.step1}
            onUpdate={(data) => updateStepData('step1', data)}
            onNext={handleNext}
          />
        );
      case 2:
        return (
          <Step2EmailPassword
            data={registerState.step2}
            onUpdate={(data) => updateStepData('step2', data)}
            onNext={handleNext}
          />
        );
      case 3:
        return (
          <Step3TDEEPart1
            data={registerState.step3}
            onUpdate={(data) => updateStepData('step3', data)}
            onNext={handleNext}
          />
        );
      case 4:
        return (
          <Step4ActivityGoal
            data={registerState.step4}
            onUpdate={(data) => updateStepData('step4', data)}
            onNext={handleNext}
          />
        );
      case 5:
        return (
          <Step5Newsletter
            data={registerState.step5}
            onUpdate={(data) => updateStepData('step5', data)}
            onNext={handleNext}
          />
        );
      case 6:
        return (
          <Step6Friends
            data={registerState.step6}
            onUpdate={(data) => updateStepData('step6', data)}
            onNext={handleNext}
          />
        );
      case 7:
        return (
          <Step7RoleSelection
            data={registerState.step7}
            onUpdate={(data) => updateStepData('step7', data)}
            onComplete={handleComplete}
          />
        );
      default:
        return <div>未知步驟</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-hidden pt-40 pb-32">
      {/* 背景裝飾 */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-72 h-72 bg-emerald-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-600 rounded-full blur-3xl"></div>
      </div>

      {/* 頂部返回/關閉按鈕 */}
      <div className="w-full pt-6 pb-4 px-4 flex items-center justify-between z-10 relative">
        <button
          onClick={handleClose}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 rounded-md px-2 py-1"
          aria-label="返回"
        >
          <X className="w-5 h-5" />
          <span className="text-sm font-medium">關閉</span>
        </button>
      </div>

      {/* 主要內容區域 */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-4 py-8 z-10 relative">
        <div className="w-full max-w-md space-y-8">
          {/* 進度條 */}
          <div className="w-full">
            <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
          </div>

          {/* 當前步驟的表單組件 */}
          <div className="min-h-[400px] flex items-center justify-center">
            {renderCurrentStep()}
          </div>
        </div>
      </div>

      {/* 底部導航按鈕 - 僅顯示返回按鈕，各步驟組件內部已包含下一步按鈕 */}
      {currentStep > 1 && (
        <div className="w-full px-4 pb-8 z-10 relative">
          <div className="max-w-md mx-auto">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              className="w-full border-2 border-gray-700 hover:border-white/40 bg-transparent hover:bg-white/5 text-white font-semibold px-4 py-3 text-base rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-[0.98]"
              aria-label="上一步"
            >
              返回
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
