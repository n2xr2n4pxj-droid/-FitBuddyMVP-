import React from 'react';
import { Invitation } from '@/types/invitations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { isExpired, isExpiringSoon, getDaysSinceExpiry, getDaysUntilExpiry } from '@/utils/dateUtils';

const STATUS_CONFIG = {
  PENDING: { 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300', 
    text: '待處理', 
    icon: '⏳' 
  },
  ACCEPTED: { 
    color: 'bg-green-100 text-green-800 border-green-300', 
    text: '已接受', 
    icon: '✅' 
  },
  REJECTED: { 
    color: 'bg-red-100 text-red-800 border-red-300', 
    text: '已拒絕', 
    icon: '❌' 
  },
  EXPIRED: { 
    color: 'bg-gray-100 text-gray-800 border-gray-300', 
    text: '已過期', 
    icon: '⏱️' 
  }
};

interface InvitationCardProps {
  invitation: Invitation;
  onRevoke: (id: string) => Promise<void>;
  onResend?: (id: string) => Promise<void>;
  loading: boolean;
}

export const InvitationCard: React.FC<InvitationCardProps> = ({
  invitation,
  onRevoke,
  onResend,
  loading
}) => {
  const { toast } = useToast();
  const config = STATUS_CONFIG[invitation.status];
  const isRevokable = invitation.status === 'PENDING';
  const isResendable = invitation.status === 'EXPIRED' || invitation.status === 'REJECTED';
  
  // 檢查過期狀態
  const expired = invitation.status === 'EXPIRED' || isExpired(invitation.expiresAt);
  const expiringSoon = !expired && isExpiringSoon(invitation.expiresAt, 7);
  const daysSinceExpiry = expired ? getDaysSinceExpiry(invitation.expiresAt) : 0;
  const daysUntilExpiry = expiringSoon ? getDaysUntilExpiry(invitation.expiresAt) : 0;

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('zh-HK', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const handleRevoke = async () => {
    if (window.confirm('確定要撤銷這個邀請嗎？')) {
      try {
        await onRevoke(invitation.id);
        toast({
          title: '成功',
          description: '邀請已撤銷',
        });
      } catch (error) {
        toast({
          title: '錯誤',
          description: error instanceof Error ? error.message : '撤銷失敗',
          variant: 'destructive',
        });
      }
    }
  };

  const handleResend = async () => {
    if (!onResend) return;
    
    if (window.confirm('確定要重新發送這個邀請嗎？')) {
      try {
        await onResend(invitation.id);
        toast({
          title: '成功',
          description: '邀請已重新發送',
        });
      } catch (error) {
        toast({
          title: '錯誤',
          description: error instanceof Error ? error.message : '重新發送失敗',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge 
              variant="outline" 
              className={`${config.color} border`}
            >
              {config.icon} {config.text}
            </Badge>
          </div>
          
          <div className="mb-2">
            <p className="font-medium text-gray-900 mb-1">
              {invitation.receiverEmail}
            </p>
            {invitation.clientName && (
              <p className="text-sm text-gray-600">
                👤 客戶名稱：{invitation.clientName}
              </p>
            )}
          </div>
          
          {invitation.message && (
            <p className="text-sm text-gray-600 mb-3 p-2 bg-gray-50 rounded border-l-2 border-gray-300">
              {invitation.message}
            </p>
          )}

          <div className="text-xs text-gray-500 space-y-1">
            <p className="flex items-center gap-1">
              <span>📅</span>
              <span>發送時間：{formatDate(invitation.createdAt)}</span>
            </p>
            <p className="flex items-center gap-1">
              <span>⏰</span>
              <span>過期時間：{formatDate(invitation.expiresAt)}</span>
            </p>
            {invitation.respondedAt && (
              <p className="flex items-center gap-1">
                <span>✔️</span>
                <span>回應時間：{formatDate(invitation.respondedAt)}</span>
              </p>
            )}
          </div>

          {/* 過期警告 */}
          {expired && (
            <div 
              className="mt-3 p-3 rounded-lg border border-red-300/50"
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                borderRadius: 'var(--radius, 0.5rem)',
              }}
            >
              <p className="text-sm font-medium" style={{ color: 'hsl(var(--destructive))' }}>
                {daysSinceExpiry > 0 
                  ? `⏰ 邀請已在 ${daysSinceExpiry} 天前過期`
                  : '⏰ 邀請已過期'
                }
              </p>
            </div>
          )}
          
          {expiringSoon && daysUntilExpiry > 0 && (
            <div 
              className="mt-3 p-3 rounded-lg border border-yellow-300/50"
              style={{
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                borderRadius: 'var(--radius, 0.5rem)',
              }}
            >
              <p className="text-sm font-medium text-yellow-700">
                ⚠️ 邀請將在 {daysUntilExpiry} 天後過期
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {isRevokable && (
            <Button
              onClick={handleRevoke}
              disabled={loading}
              variant="destructive"
              size="sm"
            >
              撤銷
            </Button>
          )}
          {isResendable && onResend && (
            <Button
              onClick={handleResend}
              disabled={loading}
              variant="default"
              size="sm"
              className="bg-primary hover:bg-primary/90"
            >
              📧 重新發送
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
