import { request } from '@/lib/api-client';
import type { AppApiError } from '@/lib/api-error';
import { Invitation, InvitationResponse, InvitationTemplate } from '@/types/invitations';

const API_BASE = '/api/v1/invitations';

function errorToInvitationResponse(error: unknown, fallbackMessage: string): InvitationResponse {
  const apiError = error as Partial<AppApiError>;
  return {
    success: false,
    message: apiError.message || fallbackMessage,
    error: apiError.message || fallbackMessage,
    errorCode: apiError.errorCode,
    logId: apiError.logId,
  };
}

export const invitationService = {
  async getCoachShareToken(): Promise<{ token: string; coachId?: string; expiresIn?: string }> {
    const data = await request.get<{ token: string; coachId?: string; expiresIn?: string }>(`${API_BASE}/share-token`);

    if (!data?.token || typeof data.token !== 'string') {
      throw new Error('邀請 token 格式無效');
    }

    return {
      token: data.token,
      coachId: data.coachId,
      expiresIn: data.expiresIn,
    };
  },

  /**
   * 發送邀請
   * @param clientEmail 客戶郵箱
   * @param clientName 客戶名稱（可選）
   * @param notes 備註（可選）
   */
  async sendInvitation(
    clientEmail: string,
    clientName?: string,
    notes?: string
  ): Promise<InvitationResponse> {
    try {
      const data = await request.post<{ message?: string; logId?: string }>(`${API_BASE}/send`, {
        client_email: clientEmail,
        client_name: clientName,
        notes: notes || ''
      });

      return {
        success: true,
        message: data.message || '邀請已發送成功',
        data: data,
        logId: data.logId
      };
    } catch (error) {
      return errorToInvitationResponse(error, '發送邀請失敗');
    }
  },

  /**
   * 獲取邀請列表
   * @param status 可選的狀態過濾（PENDING, ACCEPTED, REJECTED, EXPIRED）
   */
  async getInvitationList(status?: string): Promise<Invitation[]> {
    try {
      const url = status 
        ? `${API_BASE}/coach/list?status=${status}`
        : `${API_BASE}/coach/list`;
      const data = await request.get<unknown[]>(url);
      
      const invitations: Invitation[] = (Array.isArray(data) ? data : []).map((item: any) => ({
        id: item.id,
        senderId: item.senderId || '',
        senderName: item.senderName || '教練',
        receiverEmail: item.receiverEmail || item.client_email || '',
        receiverId: item.receiverId,
        clientName: item.client_name || item.receiverEmail,
        invitationType: 'COACH_TO_CLIENT' as const,
        status: item.status as any,
        token: item.token || '',
        message: item.message,
        expiresAt: item.expiresAt || item.expires_at,
        createdAt: item.createdAt || item.created_at,
        respondedAt: item.respondedAt || item.responded_at || undefined,
      }));
      return invitations;
    } catch (error) {
      throw error;
    }
  },

  /**
   * 檢查邀請狀態
   * @param code 邀請碼
   */
  async checkInvitationStatus(code: string): Promise<Invitation> {
    const data = await request.get<any>(`${API_BASE}/status/${code}`);
    return {
      id: data.id,
      senderId: data.coach_id,
      senderName: data.client_name || '',
      receiverEmail: data.client_email,
      invitationType: 'COACH_TO_CLIENT',
      status: data.status as any,
      token: code,
      expiresAt: '',
      createdAt: '',
      ...data
    };
  },

  /**
   * 接受邀請
   * @param code 邀請碼
   * @param password 密碼
   * @param phone 手機號（可選）
   * @param agreeTerms 是否同意條款
   */
  async acceptInvitation(
    code: string,
    password: string,
    phone?: string,
    agreeTerms: boolean = true
  ): Promise<InvitationResponse> {
    try {
      const data = await request.post<any>(`${API_BASE}/accept/${code}`, {
        password,
        phone: phone || null,
        agree_terms: agreeTerms
      });

      return {
        success: true,
        message: data.message || '賬戶創建成功！',
        data: data,
        logId: data.logId
      };
    } catch (error) {
      return errorToInvitationResponse(error, '接受邀請失敗');
    }
  },

  /**
   * 撤銷邀請
   * @param invitationId 邀請 ID
   */
  async revokeInvitation(invitationId: string): Promise<InvitationResponse> {
    try {
      const data = await request.delete<any>(`${API_BASE}/${invitationId}`);

      return {
        success: true,
        message: data.message || '邀請已撤銷',
        data: data,
        logId: data.logId
      };
    } catch (error) {
      return errorToInvitationResponse(error, '撤銷邀請失敗');
    }
  },

  /**
   * 重新發送邀請
   * @param invitationId 邀請 ID
   */
  async resendInvitation(invitationId: string): Promise<InvitationResponse> {
    try {
      const data = await request.patch<any>(`${API_BASE}/resend/${invitationId}`);

      return {
        success: true,
        message: data.message || '邀請已重新發送',
        data: data,
        logId: data.logId
      };
    } catch (error) {
      return errorToInvitationResponse(error, '重新發送邀請失敗');
    }
  },

  /**
   * 獲取邀請模板列表
   */
  async getInvitationTemplates(): Promise<InvitationTemplate[]> {
    const data = await request.get<InvitationTemplate[]>(`${API_BASE}/templates`);
    return Array.isArray(data) ? data : [];
  },

  /**
   * 創建邀請模板
   * @param name 模板名稱
   * @param message 模板內容
   */
  async createInvitationTemplate(
    name: string,
    message: string
  ): Promise<InvitationTemplate> {
    return request.post<InvitationTemplate>(`${API_BASE}/templates`, { name, message });
  },

  /**
   * 更新邀請模板
   * @param templateId 模板 ID
   * @param updates 更新內容
   */
  async updateInvitationTemplate(
    templateId: string,
    updates: { name?: string; message?: string }
  ): Promise<InvitationTemplate> {
    return request.patch<InvitationTemplate>(`${API_BASE}/templates/${templateId}`, updates);
  },

  /**
   * 刪除邀請模板
   * @param templateId 模板 ID
   */
  async deleteInvitationTemplate(templateId: string): Promise<void> {
    await request.delete<void>(`${API_BASE}/templates/${templateId}`);
  }
};
