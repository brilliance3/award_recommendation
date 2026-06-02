import { api } from "./client";
import type { ChecklistSubmit } from "./checklist";

export interface ApplicationMeritContent {
  merit_short_summary?: string;
  recommendation_reason?: string;
  merit_overview_1?: string;
  merit_overview_2?: string;
  merit_overview_3?: string;
  merit_overview_4?: string;
  full_merit_text?: string;
}

export interface ApplicationCareerRecord {
  record_date?: string;
  description?: string;
}

export interface ApplicationPreviousAward {
  award_date?: string;
  description?: string;
}

export interface ApplicationRecipient {
  recipient_name: string;
  chinese_name?: string;
  birth_date: string;
  gender?: string;
  address?: string;
  region?: string;
  occupation?: string;
  organization_name: string;
  recipient_position_title?: string;
  rank_grade?: string;
  external_title?: string;
  merit_category: string;
  merit_period: string;
  checklist: ChecklistSubmit;
  merit_content: ApplicationMeritContent;
  careers?: ApplicationCareerRecord[];
  previous_awards?: ApplicationPreviousAward[];
}

export interface ApplicationSubmit {
  applicant_role: "individual" | "organization";
  applicant_name: string;
  applicant_organization?: string;
  applicant_contact?: string;
  applicant_delivery_address?: string;
  recommender_name: string;
  award_date?: string;
  recipients: ApplicationRecipient[];
}

export interface ApplicationSubmitResponse {
  award_case_id: string;
  recipient_ids: string[];
  share_token?: string; // 기관 대표 신청이면 대상자 자가추가용 공유 토큰
  manage_token?: string; // 기관 대표 전용 검토·최종제출 관리 토큰
  message: string;
}

export const submitApplication = (payload: ApplicationSubmit) =>
  api
    .post<ApplicationSubmitResponse>("/api/applications/submit", payload)
    .then(r => r.data);

// 기관 대표 신청 공유 링크 — 외부 피추천자가 토큰으로 보는 신청 요약(PII 최소)
export interface ShareCaseInfo {
  organization?: string;
  recommender_name?: string;
  award_grade?: string;
  award_date?: string;
  recipient_count: number;
}

export interface ShareRecipientAddResponse {
  recipient_id: string;
  recipient_count: number;
  message: string;
}

export const getShareCaseInfo = (token: string) =>
  api
    .get<ShareCaseInfo>(`/api/applications/by-token/${token}`)
    .then(r => r.data);

export const addRecipientByToken = (
  token: string,
  payload: ApplicationRecipient
) =>
  api
    .post<ShareRecipientAddResponse>(
      `/api/applications/by-token/${token}/recipients`,
      payload
    )
    .then(r => r.data);

// 기관 대표 전용 검토·최종제출 관리
export interface ManageRecipientItem {
  recipient_name?: string;
  organization_name?: string;
  recipient_position_title?: string;
  merit_category?: string;
}

export interface ManageCaseInfo {
  organization?: string;
  recommender_name?: string;
  award_grade?: string;
  award_date?: string;
  share_token?: string;
  submitted: boolean;
  recipient_count: number;
  recipients: ManageRecipientItem[];
}

export interface ManageSubmitResponse {
  submitted: boolean;
  recipient_count: number;
  message: string;
}

export const getManageInfo = (manageToken: string) =>
  api
    .get<ManageCaseInfo>(`/api/applications/manage/${manageToken}`)
    .then(r => r.data);

export const submitManageApplication = (manageToken: string) =>
  api
    .post<ManageSubmitResponse>(
      `/api/applications/manage/${manageToken}/submit`
    )
    .then(r => r.data);
