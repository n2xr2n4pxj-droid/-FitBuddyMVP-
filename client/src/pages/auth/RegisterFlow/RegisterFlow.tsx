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

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'wouter'; // 項目使用 wouter 而非 react-router-dom
import { useAuth } from '@/hooks/useAuth'; // ✅ 添加 useAuth 來檢查是否已認證
import { useAuthStore } from '@/store/auth.store';
import { tokenManager } from '@/lib/api-client';
import { savePendingCoachRef } from '@/lib/coach-ref';
import { extractAuthPayload } from '@/types/auth-payload';
import { X } from 'lucide-react';
import AuthPhoneShell from '@/components/auth/AuthPhoneShell';
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
    tdee: number | null; // ✅ 添加 TDEE 字段
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
  const [, setLocation] = useLocation();
  const { user, token, fetchMe } = useAuth();
  const { fetchMe: storeFetchMe } = useAuthStore();
  const coachRef = useMemo((): string | null => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const value = searchParams.get('coach_ref');
      return value && value.trim() ? value.trim() : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (coachRef) {
      savePendingCoachRef(coachRef);
    }
  }, [coachRef]);

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
      tdee: null, // ✅ 添加 TDEE 初始值
    },
    step4: {
      activityLevel: 'low', // ✅ 修復：設置默認值，避免 Step5 收到空值
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

  // ✅ 使用 useRef 標記是否應該自動進入下一步（響應狀態更新）
  const pendingNextRef = useRef<boolean>(false);

  /**
   * 更新當前步驟的數據
   * ✅ 修復：使用 useCallback 包裹，避免每次渲染時創建新函數
   */
  const updateStepData = useCallback(
    <K extends keyof RegisterState>(
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
    },
    []
  );

  /**
   * 驗證當前步驟
   * ✅ 修復：使用 useCallback 包裹，避免每次渲染時重新創建
   */
  const validateCurrentStep = useCallback((): boolean => {
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
          registerState.step3.weight !== null &&
          registerState.step3.tdee !== null // ✅ 添加 TDEE 驗證
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
  }, [currentStep, registerState]);

  /**
   * 處理完成註冊
   * ✅ 修復：區分 OAuth 用戶和普通註冊用戶
   */
  const handleComplete = useCallback(async (): Promise<void> => {
    try {
      console.log('註冊數據:', registerState);
      console.log('當前用戶:', user);
      console.log('是否有 token:', !!token);
      
      // ✅ 檢查是否是 OAuth 用戶（已有 token）
      const isOAuthUser = !!token && !!user;
      
      if (isOAuthUser) {
        // OAuth 用戶：先寫入 TDEE，再更新角色，最後刷新 auth 狀態再導向
        console.log('OAuth 用戶：更新 TDEE、角色並刷新狀態');

        const { step3, step4 } = registerState;
        const hasTDEEData =
          step3.gender != null &&
          step3.height != null &&
          step3.weight != null &&
          step4.activityLevel &&
          step4.goals?.length > 0;

        if (hasTDEEData) {
          const birthDate = step3.birthDate;
          const today = new Date();
          const age = birthDate
            ? today.getFullYear() -
              birthDate.getFullYear() -
              (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)
            : null;
          if (age == null || age < 1 || age > 120) {
            alert('請填寫有效的出生日期以計算 TDEE');
            return;
          }
          const activityLevelMap: Record<string, string> = {
            low: 'sedentary',
            moderate: 'moderate',
            high: 'heavy',
            very_high: 'athlete',
          };
          const goalMap: Record<string, string> = {
            lose_weight: 'weight_loss',
            gain_muscle: 'weight_gain',
            maintain_health: 'maintain',
            improve_fitness: 'maintain',
          };
          const backendActivity = activityLevelMap[step4.activityLevel] || step4.activityLevel;
          const goal = goalMap[step4.goals[0]] || 'maintain';

          try {
            const tdeeResponse = await fetch('/api/tdee/calculate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              credentials: 'include',
              body: JSON.stringify({
                age,
                gender: step3.gender,
                height: step3.height,
                weight: step3.weight,
                activityLevel: backendActivity,
                goal,
              }),
            });
            if (!tdeeResponse.ok) {
              const errData = await tdeeResponse.json().catch(() => ({}));
              console.error('TDEE 寫入失敗:', errData);
              alert(errData.message || 'TDEE 儲存失敗，請稍後再試');
              return;
            }
            console.log('TDEE 寫入成功');
          } catch (tdeeError) {
            console.error('TDEE 寫入錯誤:', tdeeError);
            alert('TDEE 儲存過程中發生錯誤，請稍後再試');
            return;
          }
        }

        if (registerState.step7.role) {
          try {
            const roleResponse = await fetch('/api/auth/role-select', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              credentials: 'include',
              body: JSON.stringify({
                role: registerState.step7.role,
              }),
            });

            const roleData = await roleResponse.json();

            if (!roleResponse.ok) {
              console.error('角色更新失敗:', roleData);
              alert(roleData.message || '角色更新失敗，請稍後再試');
              return;
            }

            console.log('角色更新成功:', roleData);
          } catch (roleError) {
            console.error('角色更新錯誤:', roleError);
            alert('角色更新過程中發生錯誤，請稍後再試');
            return;
          }
        }

        try {
          await fetchMe();
          // 同步更新 Zustand store 的 registrationComplete，確保整頁重載後不被導回 Step 3
          await storeFetchMe();
        } catch (meErr) {
          console.error('刷新用戶狀態失敗:', meErr);
          alert('無法刷新登入狀態，請重新整理頁面');
          return;
        }

        setLocation('/');
      } else {
        // 普通註冊用戶：調用註冊 API
        console.log('普通註冊用戶：調用註冊 API');
        
        // ✅ 檢查是否有 email 和 password
        if (!registerState.step2.email || !registerState.step2.password) {
          console.error('註冊失敗：缺少 email 或 password', {
            email: registerState.step2.email,
            hasPassword: !!registerState.step2.password,
          });
          alert('註冊失敗：請提供 email 和 password');
          return;
        }
        
        // 準備註冊數據
        const registrationData = {
          email: registerState.step2.email,
          password: registerState.step2.password,
          username: registerState.step1.username,
          firstName: registerState.step1.username,
          lastName: '',
          role: registerState.step7.role || 'client',
          coachRef,
          // 額外的註冊信息（如果需要）
          birthDate: registerState.step3.birthDate,
          gender: registerState.step3.gender,
          height: registerState.step3.height,
          weight: registerState.step3.weight,
          activityLevel: registerState.step4.activityLevel,
          goals: registerState.step4.goals,
          subscribeNewsletter: registerState.step5.subscribeNewsletter,
          syncContacts: registerState.step6.syncContacts,
        };

        console.log('發送註冊數據:', { ...registrationData, password: '***' });

        // 調用註冊 API
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(registrationData),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('註冊失敗:', data);
          // TODO: 顯示錯誤提示
          alert(data.message || '註冊失敗，請稍後再試');
          return;
        }

        console.log('註冊成功:', data);

        const payload = extractAuthPayload(data);
        if (!payload.token) {
          alert('註冊成功，請前往登入頁登入');
          setLocation('/login');
          return;
        }

        localStorage.setItem('fitbuddy_token', payload.token);
        tokenManager.setAccessToken(payload.token);
        if (payload.refreshToken) {
          tokenManager.setRefreshToken(payload.refreshToken);
        }

        try {
          await fetchMe();
          // 同步更新 Zustand store 的 registrationComplete，確保整頁重載後不被導回 Step 3
          await storeFetchMe();
        } catch (meErr) {
          console.error('刷新用戶狀態失敗:', meErr);
          tokenManager.clear();
          localStorage.removeItem('fitbuddy_token');
          alert('無法完成登入，請稍後使用登入頁登入');
          setLocation('/login');
          return;
        }

        setLocation('/');
      }
    } catch (error) {
      console.error('註冊錯誤:', error);
      // TODO: 顯示錯誤提示
      alert('註冊過程中發生錯誤，請稍後再試');
    }
  }, [registerState, user, token, setLocation, fetchMe, coachRef]);

  /**
   * 處理下一步（使用 useEffect 響應狀態更新）
   * ✅ 修復：使用 useRef 標記 + useEffect 響應狀態變化，而不是 setTimeout
   * 
   * 關鍵：不在此處驗證，因為 onUpdate 可能還沒完成狀態更新
   * 驗證將在 useEffect 中進行，此時 registerState 已經是最新值
   */
  const handleNext = useCallback((): void => {
    console.log('[RegisterFlow] handleNext called, currentStep:', currentStep);
    
    // ✅ 設置標記，表示用戶點擊了「下一步」
    // 注意：此時 onUpdate 可能還在執行中，registerState 尚未更新
    // 所以不在這裡驗證，而是在 useEffect 中驗證（此時狀態已更新）
    pendingNextRef.current = true;
    
    console.log('[RegisterFlow] Pending next flag set, waiting for state update...');
    // ✅ 注意：不立即驗證或進入下一步
    // useEffect 會在 registerState 更新後自動觸發，此時才進行驗證
  }, [currentStep]);

  /**
   * ✅ 使用 useEffect 監聽狀態更新，自動進入下一步
   * 這確保了當 updateStepData 完成狀態更新後，才執行驗證和下一步
   * 
   * 執行流程：
   * 1. 用戶點擊「下一步」→ handleNext() → pendingNextRef.current = true
   * 2. Step 組件調用 onUpdate() → registerState 更新
   * 3. registerState 變化觸發此 useEffect
   * 4. 檢查 pendingNextRef.current === true → 驗證當前步驟
   * 5. 驗證通過 → 進入下一步
   */
  useEffect(() => {
    // ✅ 只有當 pendingNextRef 為 true 時才執行（用戶點擊了「下一步」）
    if (!pendingNextRef.current) {
      return;
    }

    console.log('[RegisterFlow] useEffect triggered, registerState updated, currentStep:', currentStep);
    console.log('[RegisterFlow] Validating step', currentStep, 'with updated state...');

    // ✅ 驗證當前步驟（使用已更新的狀態）
    // 此時 registerState 已經是最新值（onUpdate 已完成）
    if (!validateCurrentStep()) {
      console.warn('[RegisterFlow] Validation failed for step:', currentStep);
      console.warn('[RegisterFlow] Step data:', registerState[`step${currentStep}` as keyof RegisterState]);
      // 驗證失敗，重置標記
      pendingNextRef.current = false;
      return;
    }

    console.log('[RegisterFlow] Validation passed for step:', currentStep);

    // ✅ 驗證通過，進入下一步
    if (currentStep < totalSteps) {
      const nextStep = (currentStep + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
      console.log('[RegisterFlow] Moving to next step:', nextStep);
      setRegisterState((prev) => ({
        ...prev,
        currentStep: nextStep,
      }));
      // ✅ 重置標記，等待下一次操作
      pendingNextRef.current = false;
    } else {
      // 最後一步：完成註冊並進入儀表盤
      console.log('[RegisterFlow] Last step completed, calling handleComplete...');
      pendingNextRef.current = false;
      handleComplete();
    }
    // ✅ 依賴項：
    // - registerState: 當狀態更新時觸發（onUpdate 完成後）
    // - currentStep: 當步驟變化時觸發（確保驗證正確的步驟）
    // - totalSteps: 常量，但包含以確保完整性
    // - validateCurrentStep: 驗證函數的引用
    // - handleComplete: 完成函數的引用
  }, [registerState, currentStep, totalSteps, validateCurrentStep, handleComplete]);

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
   * 處理返回/關閉
   */
  const handleClose = (): void => {
    // 步驟 >= 3 表示已透過 OAuth 登入、正在補填資料 → 回 Dashboard
    // 步驟 1-2 為未登入的一般註冊流程 → 回首頁（Landing Page）
    if (currentStep >= 3) {
      setLocation('/dashboard');
    } else {
      setLocation('/');
    }
  };

  // ✅ 修復：為每個步驟創建穩定的 onUpdate 回調，避免每次渲染時創建新函數
  // 這樣可以防止子組件（Step3、Step4）的 useEffect 無限觸發
  const handleStep1Update = useCallback((data: any) => updateStepData('step1', data), [updateStepData]);
  const handleStep2Update = useCallback((data: any) => updateStepData('step2', data), [updateStepData]);
  const handleStep3Update = useCallback((data: any) => updateStepData('step3', data), [updateStepData]);
  const handleStep4Update = useCallback((data: any) => updateStepData('step4', data), [updateStepData]);
  const handleStep5Update = useCallback((data: any) => updateStepData('step5', data), [updateStepData]);
  const handleStep6Update = useCallback((data: any) => updateStepData('step6', data), [updateStepData]);
  const handleStep7Update = useCallback((data: any) => updateStepData('step7', data), [updateStepData]);

  /**
   * 渲染當前步驟的組件
   */
  const renderCurrentStep = (): JSX.Element => {
    switch (currentStep) {
      case 1:
        return (
          <Step1Username
            data={registerState.step1}
            onUpdate={handleStep1Update}
            onNext={handleNext}
          />
        );
      case 2:
        return (
          <Step2EmailPassword
            data={registerState.step2}
            onUpdate={handleStep2Update}
            onNext={handleNext}
          />
        );
      case 3:
        return (
          <Step3TDEEPart1
            data={registerState.step3}
            onUpdate={handleStep3Update}
            onNext={handleNext}
          />
        );
      case 4:
        return (
          <Step4ActivityGoal
            data={registerState.step4}
            onUpdate={handleStep4Update}
            onNext={handleNext}
          />
        );
      case 5:
        return (
          <Step5Newsletter
            data={registerState.step5}
            onUpdate={handleStep5Update}
            onNext={handleNext}
          />
        );
      case 6:
        return (
          <Step6Friends
            data={registerState.step6}
            onUpdate={handleStep6Update}
            onNext={handleNext}
          />
        );
      case 7:
        return (
          <Step7RoleSelection
            data={registerState.step7}
            onUpdate={handleStep7Update}
            onComplete={handleComplete}
          />
        );
      default:
        return <div>未知步驟</div>;
    }
  };

  return (
    <AuthPhoneShell>
      <div className="flex shrink-0 justify-end px-6 pt-6">
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-neutral-400 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          aria-label="關閉"
        >
          <X className="h-5 w-5" />
          關閉
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 text-white sm:py-10">
        <div className="mx-auto w-full pb-10">
          <div className="w-full rounded-3xl border border-white/10 bg-neutral-900/80 px-0 py-12 shadow-2xl backdrop-blur-xl">
            <div className="mb-10 w-full">
              <ProgressBar
                currentStep={currentStep}
                totalSteps={totalSteps}
                showPercentage={false}
              />
            </div>

            <div
              key={currentStep}
              className="min-h-[min(400px,55vh)] w-full animate-in fade-in duration-300"
            >
              {renderCurrentStep()}
            </div>

            {currentStep > 1 && (
              <div className="mt-10 border-t border-white/10 pt-8">
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full rounded-xl bg-transparent px-8 py-4 font-medium text-neutral-500 transition-all hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
                  aria-label="上一步"
                >
                  上一步
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthPhoneShell>
  );
}
