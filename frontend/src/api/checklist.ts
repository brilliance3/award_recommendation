import { api } from "./client";

export interface ChecklistPublicInfo {
  recipient_id: string;
  recipient_name_masked: string;
  organization_name?: string;
  merit_category?: string;
  already_submitted: boolean;
}

export interface ChecklistSubmit {
  item_service_period: string;
  item_service_period_note?: string;
  item_prior_award: string;
  item_prior_award_note?: string;
  item_discipline: string;
  item_discipline_note?: string;
  item_investigation: string;
  item_investigation_note?: string;
  item_criminal: string;
  item_criminal_note?: string;
  item_arrears: string;
  item_arrears_note?: string;
  item_misconduct: string;
  item_misconduct_note?: string;
  item_award_revoked: string;
  item_award_revoked_note?: string;
  self_confirm_name: string;
  self_confirm_birth: string;
}

export interface ChecklistRead extends ChecklistSubmit {
  id: string;
  recipient_id: string;
  submitted_at?: string;
  admin_election_law_general?: string;
  admin_election_law_general_note?: string;
  admin_election_law_basis?: string;
  admin_election_law_basis_note?: string;
  admin_election_law_art112?: string;
  admin_election_law_art112_note?: string;
  admin_reviewer_name?: string;
  admin_reviewed_at?: string;
}

export interface AdminReviewSubmit {
  admin_election_law_general: string;
  admin_election_law_general_note?: string;
  admin_election_law_basis: string;
  admin_election_law_basis_note?: string;
  admin_election_law_art112: string;
  admin_election_law_art112_note?: string;
  admin_reviewer_name: string;
}

export const getChecklistPublicInfo = (recipientId: string) =>
  api
    .get<ChecklistPublicInfo>(`/api/checklist/${recipientId}/public-info`)
    .then(r => r.data);

export const submitChecklist = (recipientId: string, payload: ChecklistSubmit) =>
  api
    .post<ChecklistRead>(`/api/checklist/${recipientId}/submit`, payload)
    .then(r => r.data);

export const submitAdminReview = (recipientId: string, payload: AdminReviewSubmit) =>
  api
    .patch<ChecklistRead>(
      `/api/recipients/${recipientId}/checklist/admin-review`,
      payload
    )
    .then(r => r.data);

// 관리자 검토 완료 표시를 해제(미검토로 되돌리기)
export const cancelAdminReview = (recipientId: string) =>
  api
    .delete<ChecklistRead>(`/api/recipients/${recipientId}/checklist/admin-review`)
    .then(r => r.data);
