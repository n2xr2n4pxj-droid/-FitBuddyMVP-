import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useInvitations } from '@/hooks/useInvitations';
import { useInvitationTemplates } from '@/hooks/useInvitationTemplates';

// 預設模板
const PRESET_TEMPLATES = [
  {
    id: 'preset-standard',
    name: '標準邀請',
    message: '你好，我是你的健身教練。我在 FitBuddy 上提供專業的健身指導。期待與你合作！'
  },
  {
    id: 'preset-enthusiastic',
    name: '熱情邀請',
    message: '嘿！我是你的專業健身教練。讓我們一起開始你的健身之旅吧！點擊接受加入。'
  },
  {
    id: 'preset-special',
    name: '特別邀請',
    message: '我專門為你準備了健身計劃。加入 FitBuddy 與我合作，達到你的健身目標！'
  },
  {
    id: 'preset-vip',
    name: 'VIP 邀請',
    message: '作為我的 VIP 客戶，你將獲得個性化的健身和營養指導。立即加入 FitBuddy！'
  },
  {
    id: 'preset-trial',
    name: '免費試用',
    message: '免費試用我的健身指導 7 天！無需承諾，立即加入 FitBuddy 開始吧！'
  }
];

export default function SendInvitation() {
  const [, setLocation] = useLocation();
  const { sendInvitation, loading, error } = useInvitations();
  const { templates, loading: templatesLoading } = useInvitationTemplates();

  const [formData, setFormData] = useState({
    clientEmail: '',
    message: '',
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 當選擇模板時，自動填充消息
  useEffect(() => {
    if (selectedTemplateId) {
      // 先檢查預設模板
      const presetTemplate = PRESET_TEMPLATES.find((t) => t.id === selectedTemplateId);
      if (presetTemplate) {
        setFormData((prev) => ({ ...prev, message: presetTemplate.message }));
        return;
      }
      
      // 再檢查用戶創建的模板
      const template = templates.find((t) => t.id === selectedTemplateId);
      if (template) {
        setFormData((prev) => ({ ...prev, message: template.message }));
      }
    }
  }, [selectedTemplateId, templates]);

  // 驗證郵箱格式
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // 驗證
    if (!formData.clientEmail.trim()) {
      setValidationError('請輸入客戶郵箱');
      return;
    }

    if (!isValidEmail(formData.clientEmail)) {
      setValidationError('郵箱格式不正確');
      return;
    }

    try {
      // sendInvitation 簽名: (email: string, clientName?: string, message?: string)
      // 這裡我們將 message 作為第三個參數傳遞，clientName 留空
      await sendInvitation(
        formData.clientEmail.trim(),
        undefined, // clientName - 可選，這裡不提供
        formData.message.trim() || undefined // message - 可選
      );
      setSuccess(true);
      setFormData({ clientEmail: '', message: '' });
      
      // 1.5 秒後返回邀請列表
      setTimeout(() => {
        setLocation('/coach-dashboard');
      }, 1500);
    } catch (err) {
      console.error('Error sending invitation:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8">
      <div className="max-w-md mx-auto">
        {/* 標題 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">邀請客戶</h1>
          <p className="text-gray-600">發送邀請給您的客戶</p>
        </div>

        {/* 卡片 */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          {/* 成功提示 */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium">✓ 邀請已發送</p>
              <p className="text-green-700 text-sm mt-1">客戶將收到郵件，1.5 秒後返回教練儀表板...</p>
            </div>
          )}

          {/* 錯誤提示 */}
          {(error || validationError) && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">✗ 出錯了</p>
              <p className="text-red-700 text-sm mt-1">{error || validationError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 郵箱輸入 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                客戶郵箱 *
              </label>
              <input
                id="email"
                type="email"
                placeholder="client@example.com"
                value={formData.clientEmail}
                onChange={(e) => {
                  setFormData({ ...formData, clientEmail: e.target.value });
                  setValidationError(null);
                }}
                disabled={loading || success}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">輸入客戶的郵箱地址</p>
            </div>

            {/* 模板選擇 */}
            <div>
              <label htmlFor="template" className="block text-sm font-medium text-gray-700 mb-2">
                選擇模板 (可選)
              </label>
              <select
                id="template"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                disabled={loading || success || templatesLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">選擇模板...</option>
                {/* 預設模板 */}
                <optgroup label="預設模板">
                  {PRESET_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </optgroup>
                {/* 用戶創建的模板 */}
                {templates.length > 0 && (
                  <optgroup label="我的模板">
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                選擇模板後會自動填充邀請信息，您仍可編輯
              </p>
            </div>

            {/* 信息輸入 */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                個人信息 (可選)
              </label>
              <textarea
                id="message"
                placeholder="例如: 我很期待和你一起訓練，讓我們開始吧！"
                value={formData.message}
                onChange={(e) => {
                  setFormData({ ...formData, message: e.target.value });
                  // 如果手動編輯，清除模板選擇
                  if (selectedTemplateId) {
                    setSelectedTemplateId('');
                  }
                }}
                disabled={loading || success}
                rows={3}
                maxLength={500}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.message.length}/500 字符 - 可選的個人信息，會包含在邀請郵件中
              </p>
            </div>

            {/* 提交按鈕 */}
            <button
              type="submit"
              disabled={loading || success}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  發送中...
                </>
              ) : success ? (
                <>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  已發送！
                </>
              ) : (
                '發送邀請'
              )}
            </button>

            {/* 返回按鈕 */}
            <button
              type="button"
              onClick={() => setLocation('/coach-dashboard')}
              disabled={loading}
              className="w-full bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 font-medium py-2.5 rounded-lg transition-colors duration-200"
            >
              返回教練儀表板
            </button>
          </form>
        </div>

        {/* 提示信息 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>💡 提示:</strong> 邀請將在 30 天後過期。客戶需要驗證郵箱才能接受邀請。
          </p>
        </div>
      </div>
    </div>
  );
}

