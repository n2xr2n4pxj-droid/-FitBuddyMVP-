/**
 * Invitation-related types for the client application
 * 
 * 邀請系統的完整類型定義
 */

// 邀請狀態
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

// 邀請類型
export type InvitationType = 'COACH_TO_CLIENT' | 'CLIENT_TO_COACH';

// 邀請對象
export interface Invitation {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderPhone?: string;
  receiverEmail: string;
  receiverId?: string;
  clientName?: string;
  invitationType: InvitationType;
  status: InvitationStatus;
  token: string;
  message?: string;
  expiresAt: string;
  createdAt: string;
  respondedAt?: string;
}

// API 響應
export interface InvitationResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  errorCode?: string;
  logId?: string; // 用於追蹤日誌
}

// 邀請統計
export interface InvitationStats {
  pending: number;
  accepted: number;
  rejected: number;
  expired: number;
}

// 邀請模板
export interface InvitationTemplate {
  id: string;
  coachId: string;
  name: string;
  message: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
