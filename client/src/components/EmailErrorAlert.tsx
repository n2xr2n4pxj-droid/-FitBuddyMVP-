import React from 'react';

interface EmailErrorAlertProps {
  error: string | null;
  logId?: string;
  onDismiss: () => void;
}

export const EmailErrorAlert: React.FC<EmailErrorAlertProps> = ({
  error,
  logId,
  onDismiss
}) => {
  if (!error) return null;

  return (
    <div className="p-4 mb-4 bg-red-50 border-l-4 border-red-500 rounded">
      <div className="flex">
        <div className="flex-shrink-0">
          <span className="text-2xl">⚠️</span>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">郵件發送失敗</h3>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          {logId && (
            <p className="mt-2 text-xs text-red-600">
              Log ID: <code className="bg-red-100 px-1 py-0.5 rounded">{logId}</code>
              <br />
              💡 提示：在 <a href="/admin/emails" className="underline hover:text-red-800">郵件調試工具</a> 查看詳細日誌
            </p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="ml-4 flex-shrink-0 text-red-400 hover:text-red-500 transition-colors"
          aria-label="關閉錯誤提示"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
