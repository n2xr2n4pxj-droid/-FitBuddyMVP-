import React, { useState, useEffect } from 'react';
import { EmailErrorAlert } from './EmailErrorAlert';
import { useInvitationTemplates } from '@/hooks/useInvitationTemplates';
import { InvitationTemplate } from '@/types/invitations';
import { normalizeApiError } from '@/lib/api-client';

interface CoachInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, clientName?: string, message?: string) => Promise<void>;
  loading: boolean;
}

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

export const CoachInvitationModal: React.FC<CoachInvitationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading
}) => {
  const [email, setEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [logId, setLogId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { templates, loading: templatesLoading } = useInvitationTemplates();

  // 當選擇模板時，自動填充消息
  useEffect(() => {
    if (selectedTemplateId) {
      // 先檢查預設模板
      const presetTemplate = PRESET_TEMPLATES.find((t) => t.id === selectedTemplateId);
      if (presetTemplate) {
        setMessage(presetTemplate.message);
        return;
      }
      
      // 再檢查用戶創建的模板
      const template = templates.find((t) => t.id === selectedTemplateId);
      if (template) {
        setMessage(template.message);
      }
    }
  }, [selectedTemplateId, templates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLogId(null);

    if (!email) {
      setError('請輸入郵箱地址');
      return;
    }

    // 驗證郵箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('請輸入有效的郵箱地址');
      return;
    }

    try {
      setSuccess(false);
      await onSubmit(email, clientName || undefined, message || undefined);
      setSuccess(true);
      setEmail('');
      setClientName('');
      setMessage('');
      
      // 2 秒後關閉
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (err) {
      const normalized = normalizeApiError(err);
      setError(normalized.message || '發送邀請失敗');
      
      if (normalized.logId) {
        setLogId(normalized.logId);
      }
    }
  };

  const handleClose = () => {
    if (!loading) {
      setEmail('');
      setClientName('');
      setMessage('');
      setSelectedTemplateId('');
      setError(null);
      setLogId(null);
      setSuccess(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">📨 邀請客戶</h2>

        {success && (
          <div className="p-4 mb-4 bg-green-50 border-l-4 border-green-500 rounded">
            <p className="text-sm text-green-800">✅ 邀請已發送！客戶將收到郵件。</p>
          </div>
        )}

        <EmailErrorAlert 
          error={error} 
          logId={logId || undefined}
          onDismiss={() => setError(null)}
        />

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              客戶郵箱地址 <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              客戶名稱（可選）
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="例如：張三"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              選擇模板（可選）
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading || templatesLoading}
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

          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">
              邀請信息（可選）
            </label>
            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                // 如果手動編輯，清除模板選擇
                if (selectedTemplateId) {
                  setSelectedTemplateId('');
                }
              }}
              placeholder="例如：嗨！我是你的健身教練 Gordon，希望通過 FitBuddy 幫助你達到健身目標..."
              maxLength={500}
              className="w-full px-3 py-2 border border-gray-300 rounded-md h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              {message.length}/500 字符
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '發送中...' : '發送邀請'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
