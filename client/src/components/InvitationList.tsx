import React, { useState } from 'react';
import { Invitation, InvitationStatus } from '@/types/invitations';
import { InvitationCard } from './InvitationCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface InvitationListProps {
  invitations: Invitation[];
  onRevoke: (id: string) => Promise<void>;
  onResend?: (id: string) => Promise<void>;
  loading: boolean;
}

const STATUS_LABELS: Record<InvitationStatus, { label: string; icon: string }> = {
  PENDING: { label: '待處理', icon: '⏳' },
  ACCEPTED: { label: '已接受', icon: '✅' },
  REJECTED: { label: '已拒絕', icon: '❌' },
  EXPIRED: { label: '已過期', icon: '⏱️' },
};

export const InvitationList: React.FC<InvitationListProps> = ({
  invitations,
  onRevoke,
  onResend,
  loading
}) => {
  const [filterStatus, setFilterStatus] = useState<InvitationStatus | null>(null);

  const filtered = filterStatus
    ? invitations.filter(inv => inv.status === filterStatus)
    : invitations;

  const stats = {
    total: invitations.length,
    pending: invitations.filter(inv => inv.status === 'PENDING').length,
    accepted: invitations.filter(inv => inv.status === 'ACCEPTED').length,
    rejected: invitations.filter(inv => inv.status === 'REJECTED').length,
    expired: invitations.filter(inv => inv.status === 'EXPIRED').length
  };

  return (
    <div>
      {/* 統計信息 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">總數</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground mt-1">待處理</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
            <p className="text-xs text-muted-foreground mt-1">已接受</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            <p className="text-xs text-muted-foreground mt-1">已拒絕</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-600">{stats.expired}</p>
            <p className="text-xs text-muted-foreground mt-1">已過期</p>
          </CardContent>
        </Card>
      </div>

      {/* 過濾按鈕 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Button
          onClick={() => setFilterStatus(null)}
          variant={filterStatus === null ? 'default' : 'outline'}
          size="sm"
        >
          全部
        </Button>
        {(Object.keys(STATUS_LABELS) as InvitationStatus[]).map(status => {
          const config = STATUS_LABELS[status];
          const countMap: Record<InvitationStatus, number> = {
            PENDING: stats.pending,
            ACCEPTED: stats.accepted,
            REJECTED: stats.rejected,
            EXPIRED: stats.expired,
          };
          const count = countMap[status];
          return (
            <Button
              key={status}
              onClick={() => setFilterStatus(status)}
              variant={filterStatus === status ? 'default' : 'outline'}
              size="sm"
            >
              {config.icon} {config.label} ({count})
            </Button>
          );
        })}
      </div>

      {/* 邀請列表 */}
      <div className="space-y-3">
        {loading && filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            載入中...
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {invitations.length === 0
                ? '還沒有邀請記錄'
                : '沒有符合條件的邀請'}
            </CardContent>
          </Card>
        ) : (
          filtered.map(invitation => (
            <InvitationCard
              key={invitation.id}
              invitation={invitation}
              onRevoke={onRevoke}
              onResend={onResend}
              loading={loading}
            />
          ))
        )}
      </div>
    </div>
  );
};
