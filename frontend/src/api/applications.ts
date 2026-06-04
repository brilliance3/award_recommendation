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
  // 기관 대표가 설정하는 관리 링크 보호 자격(선택)
  manage_username?: string;
  manage_password?: string;
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

// 작성자 자가추가 공유 링크 — 외부 피추천자가 토큰으로 보는 신청 요약(PII 최소). 자격 없이 개방.
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

export const addRecipientByToken = (token: string, payload: ApplicationRecipient) =>
  api
    .post<ShareRecipientAddResponse>(
      `/api/applications/by-token/${token}/recipients`,
      payload
    )
    .then(r => r.data);

// 기관 대표 전용 검토·최종제출 관리
/** 관리 링크 자격 헤더 — 보호된 관리 링크 접근 시 아이디/비밀번호 전달 */
export interface ManageCreds {
  id: string;
  pw: string;
}

const manageHeaders = (creds?: ManageCreds) =>
  creds ? { "X-Manage-Id": creds.id, "X-Manage-Pw": creds.pw } : undefined;

export interface ManageRecipientItem {
  id: string;
  recipient_name?: string;
  organization_name?: string;
  recipient_position_title?: string;
  merit_category?: string;
}

// 대표가 수정할 수 있는 대상자 공적사항(공적요지·추천사유 등)
export interface ManageRecipientMerit {
  merit_short_summary?: string;
  recommendation_reason?: string;
  merit_overview_1?: string;
  merit_overview_2?: string;
  merit_overview_3?: string;
  merit_overview_4?: string;
  full_merit_text?: string;
  character_assessment?: string;
  local_reputation?: string;
}

// 대표가 수정할 수 있는 대상자 기본정보
export interface ManageRecipientBasic {
  recipient_name?: string;
  chinese_name?: string;
  birth_date?: string;
  gender?: string;
  address?: string;
  region?: string;
  occupation?: string;
  organization_name?: string;
  recipient_position_title?: string;
  external_title?: string;
  rank_grade?: string;
  merit_category?: string;
  merit_period?: string;
  note?: string;
}

// 대표 검토용 대상자 전체 상세(기본 + 공적사항)
export interface ManageRecipientDetail extends ManageRecipientBasic {
  id: string;
  merit_content?: ManageRecipientMerit | null;
}

export const getManageRecipient = (
  manageToken: string,
  recipientId: string,
  creds?: ManageCreds
) =>
  api
    .get<ManageRecipientDetail>(
      `/api/applications/manage/${manageToken}/recipients/${recipientId}`,
      { headers: manageHeaders(creds) }
    )
    .then(r => r.data);

export const updateManageRecipient = (
  manageToken: string,
  recipientId: string,
  basic: ManageRecipientBasic,
  merit: ManageRecipientMerit,
  creds?: ManageCreds
) =>
  api
    .put<ManageRecipientDetail>(
      `/api/applications/manage/${manageToken}/recipients/${recipientId}`,
      { basic, merit },
      { headers: manageHeaders(creds) }
    )
    .then(r => r.data);

export const deleteManageRecipient = (
  manageToken: string,
  recipientId: string,
  creds?: ManageCreds
) =>
  api
    .delete(`/api/applications/manage/${manageToken}/recipients/${recipientId}`, {
      headers: manageHeaders(creds),
    })
    .then(r => r.data);

export interface ManageCaseInfo {
  organization?: string;
  recommender_name?: string;
  award_grade?: string;
  award_date?: string;
  share_token?: string;
  submitted: boolean;
  recipient_count: number;
  recipients: ManageRecipientItem[];
  protected: boolean; // 관리 링크 보호 여부
  authorized: boolean; // 보호 시 자격 일치로 열람 가능 여부
  manage_username: string;
}

export interface ManageSubmitResponse {
  submitted: boolean;
  recipient_count: number;
  message: string;
}

export const getManageInfo = (manageToken: string, creds?: ManageCreds) =>
  api
    .get<ManageCaseInfo>(`/api/applications/manage/${manageToken}`, {
      headers: manageHeaders(creds),
    })
    .then(r => r.data);

export const submitManageApplication = (manageToken: string, creds?: ManageCreds) =>
  api
    .post<ManageSubmitResponse>(
      `/api/applications/manage/${manageToken}/submit`,
      undefined,
      { headers: manageHeaders(creds) }
    )
    .then(r => r.data);

// 관리 링크 자격(아이디/비밀번호) — password 빈값이면 해제(공개)
export interface ManageCredentials {
  protected: boolean;
  username: string;
  password: string;
}

/** 기관 대표(관리 토큰, 인증된 상태)가 관리 비밀번호 변경/해제 */
export const changeManageCredentials = (
  manageToken: string,
  username: string,
  password: string,
  creds?: ManageCreds
) =>
  api
    .put<ManageCredentials>(
      `/api/applications/manage/${manageToken}/credentials`,
      { username, password },
      { headers: manageHeaders(creds) }
    )
    .then(r => r.data);

/** 담당자(관리자)가 case_id로 관리 링크 자격 조회(평문) */
export const getManageCredentials = (caseId: string) =>
  api
    .get<ManageCredentials>(`/api/award-cases/${caseId}/manage-credentials`)
    .then(r => r.data);

/** 담당자(관리자)가 case_id로 관리 링크 자격 재설정/해제 */
export const setManageCredentials = (
  caseId: string,
  username: string,
  password: string
) =>
  api
    .put<ManageCredentials>(`/api/award-cases/${caseId}/manage-credentials`, {
      username,
      password,
    })
    .then(r => r.data);
