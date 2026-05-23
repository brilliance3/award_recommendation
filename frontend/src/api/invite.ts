import { api } from "./client";

export interface PublicRecipient {
  id: string;
  award_case_title?: string;
  award_grade?: string;
  recommender_name?: string;
  status?: string;
  submitted_at?: string;

  recipient_name?: string;
  chinese_name?: string;
  birth_date?: string;
  phone_number?: string;
  address_zipcode?: string;
  address?: string;
  registered_address?: string;
  nationality?: string;
  occupation?: string;
  organization_name?: string;
  recipient_position_title?: string;
  external_title?: string;
}

export interface BulkInviteLink {
  recipient_id: string;
  recipient_name: string;
  invitation_token: string;
  public_url: string;
  status: string;
}

export interface BulkInviteResponse {
  case_id: string;
  total: number;
  links: BulkInviteLink[];
}

export const inviteApi = {
  /** 사무처 측 — 표창건 단위 일괄 초대 발급 (모든 대상자 토큰 생성) */
  bulkIssue: (caseId: string) =>
    api
      .post<BulkInviteResponse>(`/api/award-cases/${caseId}/bulk-invite`)
      .then((r) => r.data),

  /** 사무처 측 — 토큰 발급/재발급 */
  issue: (recipientId: string) =>
    api
      .post<{
        recipient_id: string;
        invitation_token: string;
        public_url: string;
        issued_at: string;
      }>(`/api/recipients/${recipientId}/issue-invitation`)
      .then((r) => r.data),

  /** 사무처 측 — 토큰 폐기 */
  revoke: (recipientId: string) =>
    api
      .post<{ ok: boolean }>(`/api/recipients/${recipientId}/revoke-invitation`)
      .then((r) => r.data),

  /** 공개 — 대상자가 보는 정보 */
  getByToken: (token: string) =>
    api.get<PublicRecipient>(`/api/invite/${token}`).then((r) => r.data),

  /** 공개 — 대상자가 저장 */
  saveByToken: (token: string, payload: Partial<PublicRecipient>) =>
    api
      .patch<PublicRecipient>(`/api/invite/${token}`, payload)
      .then((r) => r.data),

  /** 공개 — 제출 (확정) */
  submitByToken: (token: string) =>
    api
      .post<PublicRecipient>(`/api/invite/${token}/submit`)
      .then((r) => r.data),
};
