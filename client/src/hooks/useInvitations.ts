import { useState, useCallback, useEffect } from 'react';
import { Invitation, InvitationStats } from '@/types/invitations';
import { invitationService } from '@/services/invitationService';
import { normalizeApiError } from '@/lib/api-client';
import { createAppApiError, type AppApiError } from '@/lib/api-error';

export const useInvitations = () => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppApiError | null>(null);
  const [stats, setStats] = useState<InvitationStats>({
    pending: 0,
    accepted: 0,
    rejected: 0,
    expired: 0
  });

  // 刷新邀請列表
  const refreshInvitations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invitationService.getInvitationList();
      setInvitations(data);

      // 計算統計
      const newStats: InvitationStats = {
        pending: 0,
        accepted: 0,
        rejected: 0,
        expired: 0
      };

      data.forEach(inv => {
        if (inv.status === 'PENDING') newStats.pending++;
        else if (inv.status === 'ACCEPTED') newStats.accepted++;
        else if (inv.status === 'REJECTED') newStats.rejected++;
        else if (inv.status === 'EXPIRED') newStats.expired++;
      });

      setStats(newStats);
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // 發送邀請
  const sendInvitation = useCallback(
    async (
      email: string,
      clientName?: string,
      message?: string
    ) => {
      try {
        setError(null);
        const result = await invitationService.sendInvitation(email, clientName, message);
        await refreshInvitations(); // 重新載入列表
        return result;
      } catch (err) {
        const normalized = normalizeApiError(err);
        setError(normalized);
        throw normalized;
      }
    },
    [refreshInvitations]
  );

  // 撤銷邀請
  const revokeInvitation = useCallback(
    async (invitationId: string) => {
      try {
        setError(null);
        const result = await invitationService.revokeInvitation(invitationId);
        await refreshInvitations(); // 重新載入列表
        return result;
      } catch (err) {
        const normalized = normalizeApiError(err);
        setError(normalized);
        throw normalized;
      }
    },
    [refreshInvitations]
  );

  // 重新發送邀請
  const resendInvitation = useCallback(
    async (invitationId: string) => {
      try {
        setError(null);
        const result = await invitationService.resendInvitation(invitationId);
        await refreshInvitations(); // 重新載入列表
        return result;
      } catch (err) {
        const normalized = normalizeApiError(err);
        setError(normalized);
        throw normalized;
      }
    },
    [refreshInvitations]
  );

  // 驗證邀請（檢查邀請狀態）
  const verifyInvitation = useCallback(
    async (code: string) => {
      try {
        setError(null);
        setLoading(true);
        const invitation = await invitationService.checkInvitationStatus(code);
        return invitation;
      } catch (err) {
        const normalized = normalizeApiError(err);
        setError(normalized);
        throw normalized;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // 接受邀請（需要密碼等參數）
  const acceptInvitation = useCallback(
    async (code: string, password: string, phone?: string, agreeTerms: boolean = true) => {
      try {
        setError(null);
        setLoading(true);
        const result = await invitationService.acceptInvitation(code, password, phone, agreeTerms);
        return result;
      } catch (err) {
        const normalized = normalizeApiError(err);
        setError(normalized);
        throw normalized;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // 拒絕邀請（目前後端不支持，暫時不實現或返回錯誤）
  const rejectInvitation = useCallback(
    async (code: string) => {
      try {
        setError(null);
        setLoading(true);
        // 注意：後端目前沒有拒絕邀請的端點
        // 這裡可以實現為更新邀請狀態為 REJECTED，或者拋出錯誤
        const errorObj = createAppApiError({ message: '拒絕邀請功能尚未實現' });
        setError(errorObj);
        throw errorObj;
      } catch (err) {
        const normalized = normalizeApiError(err);
        setError(normalized);
        throw normalized;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // 初始化時載入
  useEffect(() => {
    refreshInvitations();
  }, [refreshInvitations]);

  return {
    invitations,
    loading,
    error: error?.message ?? null,
    stats,
    refreshInvitations,
    sendInvitation,
    revokeInvitation,
    resendInvitation,
    verifyInvitation,
    acceptInvitation,
    rejectInvitation
  };
};
