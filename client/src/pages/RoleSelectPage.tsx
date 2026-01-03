import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

export default function RoleSelectPage() {
  const [, setLocation] = useLocation();
  const { user, selectRole, isLoading, error } = useAuth();
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [localError, setLocalError] = useState<string>('');

  const handleSelectRole = async () => {
    if (!selectedRole) return;

    setLocalError('');

    try {
      logger.info('ROLE_SELECT', 'Role selection attempt', { 
        userId: user?.id, 
        selectedRole 
      });

      await selectRole(selectedRole as 'client' | 'coach' | 'both' | 'admin');

      logger.info('ROLE_SELECT', 'Role selected successfully', { 
        userId: user?.id, 
        selectedRole 
      });

      // 根據選擇的角色重定向
      if (selectedRole === 'client') {
        setLocation('/client-dashboard');
      } else if (selectedRole === 'coach') {
        setLocation('/coach-dashboard');
      } else if (selectedRole === 'both') {
        // 如果選擇 both，可以讓用戶選擇默認儀表板，這裡先導向教練儀表板
        setLocation('/coach-dashboard');
      } else {
        setLocation('/');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to select role';
      setLocalError(errorMessage);
      logger.error('ROLE_SELECT', 'Role selection failed', { 
        userId: user?.id, 
        selectedRole, 
        error: errorMessage 
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            歡迎, {user?.firstName || user?.email}! 👋
          </h1>
          <p className="text-gray-600 mt-2">請選擇你的身份</p>
        </div>

        {(error || localError) && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error || localError}
          </div>
        )}

        <div className="space-y-3 mb-6">
          {['client', 'coach', 'both'].map((role) => (
            <label
              key={role}
              className="flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md"
              style={{
                borderColor: selectedRole === role ? '#3b82f6' : '#e5e7eb',
                backgroundColor: selectedRole === role ? '#eff6ff' : 'white',
              }}
            >
              <input
                type="radio"
                name="role"
                value={role}
                checked={selectedRole === role}
                onChange={(e) => setSelectedRole(e.target.value)}
                disabled={isLoading}
                className="w-4 h-4"
              />
              <span className="ml-4 capitalize font-semibold text-gray-900">
                {role === 'client' && '💪 客戶端'}
                {role === 'coach' && '👨‍🏫 教練'}
                {role === 'both' && '🌟 兩者都是'}
              </span>
            </label>
          ))}
        </div>

        <button
          onClick={handleSelectRole}
          disabled={!selectedRole || isLoading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? '處理中...' : '確認選擇'}
        </button>

        <p className="text-center text-gray-600 text-sm mt-4">
          您之後可以在個人資料中更改此設定
        </p>
      </div>
    </div>
  );
}

