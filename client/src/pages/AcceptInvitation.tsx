import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useInvitations } from '@/hooks/useInvitations';

export default function AcceptInvitation() {
  const params = useParams();
  const [, setLocation] = useLocation();
  
  // 從 URL 路徑參數獲取邀請碼（路由是 /auth/accept-invitation/:code）
  const code = params?.code;

  const {
    verifyInvitation,
    acceptInvitation,
    rejectInvitation,
    loading,
    error,
  } = useInvitations();

  const [invitation, setInvitation] = useState<any | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    phone: '',
    agreeTerms: false,
  });

  useEffect(() => {
    if (!code) {
      setVerifyLoading(false);
      return;
    }

    const verify = async () => {
      try {
        const data = await verifyInvitation(code);
        setInvitation(data);
      } catch (err) {
        console.error('Error verifying invitation:', err);
      } finally {
        setVerifyLoading(false);
      }
    };

    verify();
  }, [code, verifyInvitation]);

  const handleAccept = async () => {
    if (!code) return;

    // 驗證密碼
    if (!formData.password || formData.password.length < 8) {
      alert('密碼至少需要 8 個字符');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      alert('兩次輸入的密碼不一致');
      return;
    }

    if (!formData.agreeTerms) {
      alert('請同意服務條款');
      return;
    }

    setActionLoading(true);
    try {
      await acceptInvitation(
        code,
        formData.password,
        formData.phone || undefined,
        formData.agreeTerms
      );
      setActionSuccess('接受');
      
      // 2 秒後重定向到 dashboard
      setTimeout(() => {
        setLocation('/client-dashboard');
      }, 2000);
    } catch (err) {
      console.error('Error accepting invitation:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!code) return;

    if (!window.confirm('確定要拒絕此邀請嗎？')) return;

    setActionLoading(true);
    try {
      await rejectInvitation(code);
      setActionSuccess('拒絕');
      
      // 2 秒後返回登錄頁
      setTimeout(() => {
        setLocation('/login');
      }, 2000);
    } catch (err) {
      console.error('Error rejecting invitation:', err);
      alert('拒絕邀請功能尚未實現，請聯繫教練');
    } finally {
      setActionLoading(false);
    }
  };

  if (!code) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <svg className="h-12 w-12 text-red-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">無效的邀請鏈接</h1>
          <p className="text-gray-600 mb-6">邀請鏈接似乎不正確或不完整</p>
          <button
            onClick={() => setLocation('/login')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
          >
            返回登錄
          </button>
        </div>
      </div>
    );
  }

  if (verifyLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-600 font-medium">驗證邀請中...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <svg className="h-12 w-12 text-red-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">邀請無效</h1>
          <p className="text-gray-600 mb-2">{error}</p>
          <p className="text-gray-500 text-sm mb-6">邀請可能已過期或已被使用</p>
          <button
            onClick={() => setLocation('/login')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
          >
            返回登錄
          </button>
        </div>
      </div>
    );
  }

  if (actionSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <svg className="h-12 w-12 text-green-600 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {actionSuccess === '接受' ? '已接受邀請！' : '已拒絕邀請'}
          </h1>
          <p className="text-gray-600 mb-6">
            {actionSuccess === '接受' 
              ? '你現在可以開始和教練合作了' 
              : '邀請已被拒絕'}
          </p>
          <p className="text-gray-500 text-sm">2 秒後自動跳轉...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* 標題 */}
          <div className="text-center mb-8">
            <div className="inline-block bg-blue-100 rounded-full p-3 mb-4">
              <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">接受邀請</h1>
            <p className="text-gray-600">創建賬戶以接受教練邀請</p>
          </div>

          {/* 邀請詳情 */}
          {invitation && (
            <div className="bg-blue-50 rounded-lg p-6 mb-8 border border-blue-200">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 font-medium">教練名字</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {invitation.client_name || invitation.senderName || '未知教練'}
                  </p>
                </div>

                {invitation.message && (
                  <div>
                    <p className="text-sm text-gray-600 font-medium">教練寄語</p>
                    <p className="text-gray-700 mt-1 leading-relaxed">"{invitation.message}"</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-gray-600 font-medium">邀請有效期</p>
                  <p className="text-gray-700 mt-1">
                    {invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleDateString('zh-CN') : '未知'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 表單 */}
          <form onSubmit={(e) => { e.preventDefault(); handleAccept(); }} className="space-y-4 mb-6">
            {/* 密碼 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                設定密碼 *
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="至少 8 個字符"
                required
                minLength={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 確認密碼 */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                確認密碼 *
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="再次輸入密碼"
                required
                minLength={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {formData.password && formData.confirmPassword && (
                <p className={`text-xs mt-1 ${formData.password === formData.confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                  {formData.password === formData.confirmPassword ? '✅ 密碼相同' : '❌ 密碼不相同'}
                </p>
              )}
            </div>

            {/* 手機號（可選） */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                手機號（可選）
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+852 1234 5678"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 同意條款 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.agreeTerms}
                  onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                  required
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  我已閱讀並同意{' '}
                  <a href="/terms" className="text-blue-600 hover:underline font-medium">
                    服務條款
                  </a>
                  {' '}和{' '}
                  <a href="/privacy" className="text-blue-600 hover:underline font-medium">
                    隱私政策
                  </a>
                </span>
              </label>
            </div>

            {/* 錯誤提示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">⚠️ {error}</p>
              </div>
            )}

            {/* 提交按鈕 */}
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {actionLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  處理中...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  接受邀請並創建賬戶
                </>
              )}
            </button>
          </form>

          {/* 拒絕按鈕 */}
          <button
            onClick={handleReject}
            disabled={actionLoading}
            className="w-full bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 font-medium py-3 rounded-lg transition-colors"
          >
            拒絕邀請
          </button>

          {/* 提示 */}
          <p className="text-center text-xs text-gray-500 mt-6">
            接受邀請後，你將成為此教練的客戶，並可以使用健身追蹤功能
          </p>
        </div>
      </div>
    </div>
  );
}
