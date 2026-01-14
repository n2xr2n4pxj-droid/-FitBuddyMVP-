/**
 * FitBuddy 註冊流程 - 步驟 7: 角色選擇
 * 
 * 生產級別的角色選擇組件
 * - 使用 React + TypeScript
 * - 深色主題設計，與註冊流程其他步驟保持一致
 * - 完整的表單驗證
 * - 角色選擇功能
 * 
 * 注意：這是註冊流程的最後一步（步驟 7）
 * 完成後將進入 Dashboard
 */

import React, { useState } from 'react';
import { User, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

// ========== 類型定義 ==========

/**
 * Step7RoleSelection 組件的 Props
 */
export interface Step7RoleSelectionProps {
  /**
   * 當前步驟數據
   */
  data: {
    role: 'client' | 'coach' | 'both' | 'admin' | null;
  };

  /**
   * 更新步驟數據的回調函數
   */
  onUpdate: (data: { role: 'client' | 'coach' | 'both' | 'admin' }) => void;

  /**
   * 完成註冊的回調函數（選擇角色後）
   */
  onComplete?: () => void;
}

// ========== Step7RoleSelection 組件 ==========

/**
 * 步驟 7: 角色選擇組件
 */
export default function Step7RoleSelection({
  data,
  onUpdate,
  onComplete,
}: Step7RoleSelectionProps): JSX.Element {
  const [selectedRole, setSelectedRole] = useState<'client' | 'coach' | 'both' | 'admin' | null>(
    data.role || null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { selectRole, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  /**
   * 處理角色選擇
   */
  const handleRoleChange = (value: string) => {
    const role = value as 'client' | 'coach' | 'both' | 'admin';
    setSelectedRole(role);
    onUpdate({ role });
  };

  /**
   * 處理完成註冊（提交角色選擇）
   */
  const handleComplete = async () => {
    if (!selectedRole) {
      toast({
        title: '請選擇角色',
        description: '請選擇您的角色以繼續',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 調用 selectRole API
      await selectRole(selectedRole);

      toast({
        title: '角色選擇成功',
        description: `您已成功註冊為 ${selectedRole === 'client' ? '客戶' : selectedRole === 'coach' ? '教練' : selectedRole === 'both' ? '客戶與教練' : '管理員'}`,
      });

      // 調用 onComplete 回調（如果提供）
      if (onComplete) {
        onComplete();
      } else {
        // 默認行為：重定向到 Dashboard
        setLocation('/dashboard');
      }
    } catch (error: any) {
      const errorMessage = 
        error?.response?.data?.error || 
        error?.response?.data?.message || 
        error?.message || 
        '角色選擇失敗，請稍後再試';
      
      toast({
        title: '角色選擇失敗',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      {/* 標題 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold text-white">
          選擇您的角色
        </h2>
        <p className="text-gray-400 text-sm md:text-base">
          請選擇您的角色以完成註冊
        </p>
      </div>

      {/* 角色選擇選項 */}
      <div className="space-y-4">
        <RadioGroup
          value={selectedRole || ''}
          onValueChange={handleRoleChange}
          className="space-y-4"
        >
          {/* 客戶選項 */}
          <div className="relative">
            <RadioGroupItem
              value="client"
              id="role-client"
              className="peer sr-only"
            />
            <Label
              htmlFor="role-client"
              className="flex items-center gap-4 p-4 border-2 border-gray-700 rounded-lg cursor-pointer hover:border-emerald-500/50 transition-all duration-200 peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-500/10"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400">
                <User className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white">客戶</div>
                <div className="text-sm text-gray-400">
                  記錄您的飲食和運動，追蹤健康目標
                </div>
              </div>
            </Label>
          </div>

          {/* 教練選項 */}
          <div className="relative">
            <RadioGroupItem
              value="coach"
              id="role-coach"
              className="peer sr-only"
            />
            <Label
              htmlFor="role-coach"
              className="flex items-center gap-4 p-4 border-2 border-gray-700 rounded-lg cursor-pointer hover:border-emerald-500/50 transition-all duration-200 peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-500/10"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400">
                <Shield className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white">教練</div>
                <div className="text-sm text-gray-400">
                  管理客戶，制定訓練計劃和營養建議
                </div>
              </div>
            </Label>
          </div>

          {/* 客戶與教練選項 */}
          <div className="relative">
            <RadioGroupItem
              value="both"
              id="role-both"
              className="peer sr-only"
            />
            <Label
              htmlFor="role-both"
              className="flex items-center gap-4 p-4 border-2 border-gray-700 rounded-lg cursor-pointer hover:border-emerald-500/50 transition-all duration-200 peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-500/10"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white">客戶與教練</div>
                <div className="text-sm text-gray-400">
                  同時擁有客戶和教練功能
                </div>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* 提示文字 */}
      <div className="text-center text-sm text-gray-400">
        您之後可以在個人設置中更改角色
      </div>

      {/* 完成按鈕 */}
      <Button
        onClick={handleComplete}
        disabled={!selectedRole || isSubmitting}
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-6 text-base rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 shadow-lg hover:shadow-emerald-500/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="完成註冊"
      >
        {isSubmitting ? '處理中...' : '完成註冊'}
      </Button>
    </div>
  );
}
