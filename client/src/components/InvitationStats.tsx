import { Invitation } from '@/types/invitations';

interface InvitationStatsProps {
  invitations: Invitation[];
}

export const InvitationStats: React.FC<InvitationStatsProps> = ({ invitations }) => {
  // 計算統計數據
  const stats = {
    total: invitations.length,
    pending: invitations.filter(inv => inv.status === 'PENDING').length,
    accepted: invitations.filter(inv => inv.status === 'ACCEPTED').length,
    rejected: invitations.filter(inv => inv.status === 'REJECTED').length,
    expired: invitations.filter(inv => inv.status === 'EXPIRED').length,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {/* 總邀請數 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">總邀請數</h3>
          <span className="text-xl">📊</span>
        </div>
        <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
      </div>

      {/* 待處理邀請 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">待處理</h3>
          <span className="text-xl">⏳</span>
        </div>
        <p className="text-3xl font-bold text-blue-600">{stats.pending}</p>
      </div>

      {/* 已接受邀請 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">已接受</h3>
          <span className="text-xl">✅</span>
        </div>
        <p className="text-3xl font-bold text-green-600">{stats.accepted}</p>
      </div>

      {/* 已拒絕邀請 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">已拒絕</h3>
          <span className="text-xl">❌</span>
        </div>
        <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
      </div>

      {/* 已過期邀請 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">已過期</h3>
          <span className="text-xl">⏰</span>
        </div>
        <p className="text-3xl font-bold text-orange-600">{stats.expired}</p>
      </div>
    </div>
  );
};
