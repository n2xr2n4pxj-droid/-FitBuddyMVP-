import { Invitation, InvitationResponse, InvitationTemplate } from '@/types/invitations';
import { tokenManager } from '@/lib/api-client';

const API_BASE = '/api/v1/invitations';

// ✅ 獲取認證 header 的輔助函數
const getAuthHeaders = () => {
  const token = tokenManager.getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const invitationService = {
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
      const response = await fetch(`${API_BASE}/send`, {
        method: 'POST',
        headers: getAuthHeaders(), // ✅ 使用認證 header
        credentials: 'include',
        body: JSON.stringify({
          client_email: clientEmail,
          client_name: clientName,
          notes: notes || ''
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // 增強錯誤信息，包含 logId 和 errorCode
        const error = new Error(data.error || '發送邀請失敗');
        (error as any).logId = data.logId;
        (error as any).errorCode = data.errorCode;
        throw error;
      }

      return {
        success: true,
        message: data.message || '邀請已發送成功',
        data: data,
        logId: data.logId // 返回 logId 用於追蹤
      };
    } catch (error: any) {
      // 保留 logId 和 errorCode 信息
      return {
        success: false,
        message: error.message || '發送邀請失敗',
        error: error.message,
        errorCode: error.errorCode,
        logId: error.logId // 傳遞 logId 用於錯誤追蹤
      };
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
      
      console.log('🟡 [invitationService] getInvitationList - URL:', url);
      console.log('🟡 [invitationService] getInvitationList - Headers:', getAuthHeaders());
      
      const response = await fetch(url, {
        headers: getAuthHeaders(), // ✅ 使用認證 header
        credentials: 'include'
      });

      console.log('🟡 [invitationService] getInvitationList - Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        console.error('❌ [invitationService] getInvitationList failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        
        throw new Error(errorData.error || errorData.message || `獲取邀請列表失敗: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ [invitationService] getInvitationList - Data received:', data);
      
      // 後端返回的數據格式需要轉換為 Invitation 類型
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
      
      console.log('✅ [invitationService] getInvitationList - Mapped invitations:', invitations);
      return invitations;
    } catch (error: any) {
      console.error('❌ [invitationService] getInvitationList error:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
      throw error;
    }
  },

  /**
   * 檢查邀請狀態
   * @param code 邀請碼
   */
  async checkInvitationStatus(code: string): Promise<Invitation> {
    try {
      const response = await fetch(`${API_BASE}/status/${code}`, {
        headers: getAuthHeaders(), // ✅ 使用認證 header
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '邀請碼無效或已過期');
      }

      const data = await response.json();
      // 後端直接返回邀請對象，格式為 { id, status, client_email, client_name, coach_id }
      // 需要轉換為 Invitation 格式
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
    } catch (error: any) {
      console.error('檢查邀請狀態失敗:', error);
      throw error;
    }
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
      const response = await fetch(`${API_BASE}/accept/${code}`, {
        method: 'POST',
        headers: getAuthHeaders(), // ✅ 使用認證 header
        credentials: 'include',
        body: JSON.stringify({
          password,
          phone: phone || null,
          agree_terms: agreeTerms
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // 增強錯誤信息，包含 logId 和 errorCode（如果有的話）
        const error = new Error(data.error || '接受邀請失敗');
        if (data.logId) (error as any).logId = data.logId;
        if (data.errorCode) (error as any).errorCode = data.errorCode;
        throw error;
      }

      return {
        success: true,
        message: data.message || '賬戶創建成功！',
        data: data,
        logId: data.logId // 返回 logId（如果有的話）
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || '接受邀請失敗',
        error: error.message,
        errorCode: error.errorCode,
        logId: error.logId // 傳遞 logId 用於錯誤追蹤
      };
    }
  },

  /**
   * 撤銷邀請
   * @param invitationId 邀請 ID
   */
  async revokeInvitation(invitationId: string): Promise<InvitationResponse> {
    try {
      const response = await fetch(`${API_BASE}/${invitationId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(), // ✅ 使用認證 header
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        // 增強錯誤信息，包含 logId 和 errorCode（如果有的話）
        const error = new Error(data.error || '撤銷邀請失敗');
        if (data.logId) (error as any).logId = data.logId;
        if (data.errorCode) (error as any).errorCode = data.errorCode;
        throw error;
      }

      return {
        success: true,
        message: data.message || '邀請已撤銷',
        data: data,
        logId: data.logId // 返回 logId（如果有的話）
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || '撤銷邀請失敗',
        error: error.message,
        errorCode: error.errorCode,
        logId: error.logId // 傳遞 logId 用於錯誤追蹤
      };
    }
  },

  /**
   * 重新發送邀請
   * @param invitationId 邀請 ID
   */
  async resendInvitation(invitationId: string): Promise<InvitationResponse> {
    try {
      const response = await fetch(`${API_BASE}/resend/${invitationId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(), // ✅ 使用認證 header
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        // 增強錯誤信息，包含 logId 和 errorCode（如果有的話）
        const error = new Error(data.error || '重新發送邀請失敗');
        if (data.logId) (error as any).logId = data.logId;
        if (data.errorCode) (error as any).errorCode = data.errorCode;
        throw error;
      }

      return {
        success: true,
        message: data.message || '邀請已重新發送',
        data: data,
        logId: data.logId // 返回 logId（如果有的話）
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || '重新發送邀請失敗',
        error: error.message,
        errorCode: error.errorCode,
        logId: error.logId // 傳遞 logId 用於錯誤追蹤
      };
    }
  },

  /**
   * 獲取邀請模板列表
   */
  async getInvitationTemplates(): Promise<InvitationTemplate[]> {
    try {
      const response = await fetch(`${API_BASE}/templates`, {
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '獲取模板列表失敗');
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      console.error('獲取模板列表失敗:', error);
      throw error;
    }
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
    try {
      const response = await fetch(`${API_BASE}/templates`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ name, message })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '創建模板失敗');
      }

      return data;
    } catch (error: any) {
      console.error('創建模板失敗:', error);
      throw error;
    }
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
    try {
      const response = await fetch(`${API_BASE}/templates/${templateId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '更新模板失敗');
      }

      return data;
    } catch (error: any) {
      console.error('更新模板失敗:', error);
      throw error;
    }
  },

  /**
   * 刪除邀請模板
   * @param templateId 模板 ID
   */
  async deleteInvitationTemplate(templateId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/templates/${templateId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '刪除模板失敗');
      }
    } catch (error: any) {
      console.error('刪除模板失敗:', error);
      throw error;
    }
  }
};
