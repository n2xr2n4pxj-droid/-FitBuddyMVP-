/**
 * Invitation-related types for the client application
 * 
 * These types define the structure for coach-client invitation requests,
 * responses, and status tracking.
 */

/**
 * Request payload for sending an invitation to a client
 */
export interface InvitationRequest {
  client_email: string;
  client_name?: string;
  notes?: string;
}

/**
 * Response from creating or fetching an invitation
 */
export interface InvitationResponse {
  id: string;
  invitation_code: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
  expires_at: string;
  client_email: string;
  client_name: string;
}

/**
 * Request payload for accepting an invitation
 */
export interface AcceptInvitationRequest {
  password: string;
  phone?: string;
  agree_terms: boolean;
}

/**
 * Status information for an invitation
 */
export interface InvitationStatus {
  id: string;
  status: string;
  client_email: string;
  client_name: string;
  coach_id: string;
}

