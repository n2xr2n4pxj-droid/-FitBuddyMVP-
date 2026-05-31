/**
 * FitBuddy 註冊流程 Zustand Store
 * 
 * 管理註冊流程的多步驟表單狀態
 * - 使用 Zustand 進行狀態管理
 * - 使用 persist 中間件保存到 localStorage
 * - 支持步驟導航、數據更新、提交等功能
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ========== 類型定義 ==========

/**
 * 步驟 1 數據類型
 */
export type RegisterStep1 = {
  username: string;
};

/**
 * 步驟 2 數據類型
 */
export type RegisterStep2 = {
  email: string;
  password: string;
  agreeToTerms: boolean;
};

/**
 * 步驟 3 數據類型
 */
export type RegisterStep3 = {
  birthDate: Date | null;
  gender: 'male' | 'female';
  height: number;
  weight: number;
};

/**
 * 步驟 4 數據類型
 */
export type RegisterStep4 = {
  activityLevel: 'low' | 'moderate' | 'high' | 'very_high';
  goals: string[];
};

/**
 * 步驟 5 數據類型
 */
export type RegisterStep5 = {
  subscribeNewsletter: boolean;
};

/**
 * 步驟 6 數據類型
 */
export type RegisterStep6 = {
  syncContacts: boolean;
};

/**
 * 完整的註冊狀態類型
 */
export type RegisterState = {
  // ===== 狀態 =====
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
  step1: RegisterStep1;
  step2: RegisterStep2;
  step3: RegisterStep3;
  step4: RegisterStep4;
  step5: RegisterStep5;
  step6: RegisterStep6;

  // ===== Actions =====
  /**
   * 設置當前步驟
   */
  setCurrentStep: (step: 1 | 2 | 3 | 4 | 5 | 6) => void;

  /**
   * 更新指定步驟的數據
   */
  updateStep: (stepNum: 1 | 2 | 3 | 4 | 5 | 6, data: any) => void;

  /**
   * 重置所有數據
   */
  resetAll: () => void;

  /**
   * 提交註冊表單
   */
  submit: () => Promise<void>;

  /**
   * 獲取所有步驟的合併數據
   */
  getFormData: () => {
    username: string;
    email: string;
    password: string;
    agreeToTerms: boolean;
    birthDate: Date | null;
    gender: 'male' | 'female';
    height: number;
    weight: number;
    activityLevel: 'low' | 'moderate' | 'high' | 'very_high';
    goals: string[];
    subscribeNewsletter: boolean;
    syncContacts: boolean;
  };
};

/**
 * 初始狀態
 */
const initialState = {
  currentStep: 1 as const,
  step1: {
    username: '',
  },
  step2: {
    email: '',
    password: '',
    agreeToTerms: false,
  },
  step3: {
    birthDate: null as Date | null,
    gender: 'male' as const,
    height: 0,
    weight: 0,
  },
  step4: {
    activityLevel: 'low' as const,
    goals: [] as string[],
  },
  step5: {
    subscribeNewsletter: false,
  },
  step6: {
    syncContacts: false,
  },
};

// ========== Zustand Store ==========

/**
 * 註冊流程 Store
 * 
 * 使用 persist 中間件將狀態保存到 localStorage
 * key: 'fitbuddy-register-flow'
 */
export const useRegisterStore = create<RegisterState>()(
  persist(
    (set, get) => ({
      // ===== 初始狀態 =====
      ...initialState,

      // ===== Actions =====

      /**
       * 設置當前步驟
       */
      setCurrentStep: (step: 1 | 2 | 3 | 4 | 5 | 6) => {
        set({ currentStep: step });
      },

      /**
       * 更新指定步驟的數據
       */
      updateStep: (stepNum: 1 | 2 | 3 | 4 | 5 | 6, data: any) => {
        set((state) => {
          const stepKey = `step${stepNum}` as keyof RegisterState;
          const currentStepData = state[stepKey] as any;

          return {
            [stepKey]: {
              ...currentStepData,
              ...data,
            },
          };
        });
      },

      /**
       * 重置所有數據
       */
      resetAll: () => {
        set(initialState);
      },

      /**
       * 提交註冊表單
       * 
       * 收集所有步驟的數據，調用註冊 API，成功後清空 store
       */
      submit: async () => {
        const state = get();
        const formData = state.getFormData();

        try {
          // 動態導入 authService 以避免循環依賴
          const { authService } = await import('@/services/authService');

          // 準備註冊數據
          // 注意：根據實際的 authService.register 接口調整字段
          const registerData = {
            email: formData.email,
            password: formData.password,
            firstName: formData.username, // 暫時使用 username 作為 firstName
            // 其他字段（birthDate, gender, height, weight 等）可以通過後續 API 更新
          };

          // 調用註冊 API
          await authService.register(registerData);

          // 成功後清空 store
          get().resetAll();
        } catch (error: any) {
          // 錯誤處理
          const errorMessage =
            error?.response?.data?.message ||
            error?.message ||
            '註冊失敗，請稍後再試';
          throw new Error(errorMessage);
        }
      },

      /**
       * 獲取所有步驟的合併數據
       */
      getFormData: () => {
        const state = get();

        return {
          username: state.step1.username,
          email: state.step2.email,
          password: state.step2.password,
          agreeToTerms: state.step2.agreeToTerms,
          birthDate: state.step3.birthDate,
          gender: state.step3.gender,
          height: state.step3.height,
          weight: state.step3.weight,
          activityLevel: state.step4.activityLevel,
          goals: state.step4.goals,
          subscribeNewsletter: state.step5.subscribeNewsletter,
          syncContacts: state.step6.syncContacts,
        };
      },
    }),
    {
      name: 'fitbuddy-register-flow', // localStorage key
      // 自定義序列化和反序列化以處理 Date 對象
      partialize: (state) => {
        // 將 Date 對象轉換為 ISO 字符串以便序列化
        const serialized = {
          ...state,
          step3: {
            ...state.step3,
            birthDate: state.step3.birthDate ? state.step3.birthDate.toISOString() : null,
          },
        };
        return serialized;
      },
      merge: (persistedState: any, currentState: RegisterState) => {
        // 將 ISO 字符串轉換回 Date 對象
        if (persistedState?.step3?.birthDate && typeof persistedState.step3.birthDate === 'string') {
          persistedState.step3.birthDate = new Date(persistedState.step3.birthDate);
        }
        return {
          ...currentState,
          ...persistedState,
          step3: {
            ...currentState.step3,
            ...persistedState.step3,
            birthDate: persistedState.step3?.birthDate
              ? new Date(persistedState.step3.birthDate)
              : null,
          },
        };
      },
    }
  )
);
