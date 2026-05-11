import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInvitations } from '@/hooks/useInvitations';
import { CoachInvitationModal } from '@/components/CoachInvitationModal';
import { InvitationList } from '@/components/InvitationList';
import { InvitationCard } from '@/components/InvitationCard';
import { InvitationStats } from '@/components/InvitationStats';
import { InvitationTemplateManager } from '@/components/InvitationTemplateManager';
import { request, normalizeApiError } from '@/lib/api-client';

interface Client {
  id: string;
  clientId: string;
  coachId: string;
  username?: string;
  email: string;
  status?: 'active' | 'paused' | 'completed';
  startDate?: string;
  notes?: string | null;
  created_at?: string;
}

interface InviteModalState {
  isOpen: boolean;
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [inviteModal, setInviteModal] = useState<InviteModalState>({ isOpen: false });
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  
  // 新的邀請系統
  const {
    invitations,
    loading: invitationsLoading,
    error: invitationsError,
    stats: invitationStats,
    sendInvitation,
    revokeInvitation,
    resendInvitation,
  } = useInvitations();
  
  const [sendLoading, setSendLoading] = useState(false);

  // 🔵 獲取客戶列表
  const { data: clients = [], isLoading, refetch } = useQuery<Client[]>({
    queryKey: ['coach-clients'],
    queryFn: async () => {
      console.log('🟡 [CoachDashboard] 開始請求客戶列表');

      const data = await request.get<Client[]>('/api/coaches/clients');
      console.log('✅ [CoachDashboard] 客戶列表加載成功:', data);
      return Array.isArray(data) ? data : [];
    },
  });

  const handleRemoveClient = async (clientId: string) => {
    try {
      await request.post('/api/coaches/remove-client', { clientId });

      toast({
        title: '成功',
        description: '客戶已移除',
      });

      refetch();
    } catch (err) {
      const normalized = normalizeApiError(err);
      console.error('❌ [CoachDashboard] handleRemoveClient 錯誤:', err);
      toast({
        title: '錯誤',
        description: normalized.message || '移除客戶失敗',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Coach Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome, {user?.email || user?.firstName || 'Coach'}!</p>
        </div>

        {/* 統計卡片 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600">{clients.length}</div>
                <p className="text-gray-600 mt-2">Total Clients</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600">0</div>
                <p className="text-gray-600 mt-2">Active Plans</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600">{invitationStats.pending}</div>
                <p className="text-gray-600 mt-2">Pending Invites</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 標籤頁：客戶列表和邀請管理 */}
        <Tabs defaultValue="clients" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="clients">客戶列表</TabsTrigger>
            <TabsTrigger value="invitations">邀請管理</TabsTrigger>
          </TabsList>

          {/* 客戶列表標籤 */}
          <TabsContent value="clients" className="space-y-4">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">客戶列表</h2>
                <Button 
                  onClick={() => setInviteModal({ isOpen: true })}
                  className="bg-green-600 hover:bg-green-700"
                >
                  邀請客戶
                </Button>
              </div>

              {/* 客戶列表內容 */}
              <div className="divide-y divide-gray-200">
                {isLoading ? (
                  <div className="p-6 text-center text-gray-500">
                    載入中...
                  </div>
                ) : clients.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <p>還沒有添加任何客戶</p>
                    <p className="text-sm mt-2">點擊「邀請客戶」按鈕開始邀請</p>
                  </div>
                ) : (
                  clients.map((client: Client) => (
                    <div key={client.id} className="p-6 flex justify-between items-center hover:bg-gray-50">
                      <div>
                        <p className="font-medium text-gray-900">{client.username || client.email || 'N/A'}</p>
                        <p className="text-sm text-gray-600">{client.email}</p>
                        {client.startDate && (
                          <p className="text-xs text-gray-500 mt-1">
                            加入於: {new Date(client.startDate).toLocaleDateString('zh-HK')}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">查看進度</Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleRemoveClient(client.clientId)}
                        >
                          移除
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* 邀請管理標籤 */}
          <TabsContent value="invitations" className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">邀請管理</h2>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setTemplateManagerOpen(true)}
                    variant="outline"
                    className="bg-white hover:bg-gray-50"
                  >
                    📝 管理模板
                  </Button>
                  <Button 
                    onClick={() => setInviteModal({ isOpen: true })}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    + 邀請客戶
                  </Button>
                </div>
              </div>

              {/* 全局錯誤提示 */}
              {invitationsError && (
                <div className="p-4 mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
                  {invitationsError}
                </div>
              )}

              {/* 邀請統計 */}
              <InvitationStats invitations={invitations} />

              {/* 邀請列表 */}
              <InvitationList
                invitations={invitations}
                onRevoke={async (id: string) => {
                  await revokeInvitation(id);
                }}
                onResend={async (id: string) => {
                  await resendInvitation(id);
                }}
                loading={invitationsLoading}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 新的邀請模態窗 */}
      <CoachInvitationModal
        isOpen={inviteModal.isOpen}
        onClose={() => setInviteModal({ isOpen: false })}
        onSubmit={async (email: string, clientName?: string, message?: string) => {
          setSendLoading(true);
          try {
            await sendInvitation(email, clientName, message);
            // 成功後刷新客戶列表（如果客戶已註冊）
            refetch();
          } finally {
            setSendLoading(false);
          }
        }}
        loading={sendLoading}
      />

      {/* 模板管理 */}
      <InvitationTemplateManager
        isOpen={templateManagerOpen}
        onClose={() => setTemplateManagerOpen(false)}
      />
    </div>
  );
}

