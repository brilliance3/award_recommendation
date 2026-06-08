import type { ChecklistRead } from "../api/checklist";

export interface AwardCase {
  id: string;
  title: string;
  award_grade: string;
  recommender_department?: string;
  recommender_position?: string;
  recommender_name?: string;
  recommender_full_title?: string;
  recommendation_date?: string;
  award_date?: string;
  applicant_role?: "individual" | "organization" | string;
  applicant_name?: string;
  applicant_organization?: string;
  applicant_contact?: string;
  applicant_delivery_address?: string;
  status?: string;
  seal_applied?: boolean;
  chair_sign?: boolean;
  // 기관 신청자 공유 링크(대상자 자가추가) — 회수(enabled)·만료(expires_at)
  share_token?: string;
  share_code?: string;
  manage_token?: string;
  share_enabled?: boolean;
  share_expires_at?: string;
  created_at: string;
  updated_at: string;
  recipient_count: number;
  award_date_count?: number; // 대상자별 표창일 distinct 개수(>1이면 복수)
}

export interface AwardCaseDetail extends AwardCase {
  recipients: Recipient[];
  all_reviewed?: boolean; // 모든 대상자 검토 완료(문서 생성 가능 조건)
}

export interface Recipient {
  id: string;
  award_case_id: string;
  sequence_no: number;
  recipient_name: string;
  chinese_name?: string;
  birth_date?: string;
  birth_yymmdd?: string;
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
  recommendation_rank?: string;
  award_date?: string; // 표창일(대상자 개인 단위, YYYY-MM-DD)
  note?: string;
  admin_reviewed?: boolean; // 관리자 검토(공직선거법) 완료 여부
  signed_at?: string; // 자필 서명 입력 시각(있으면 동의서에 서명 합성됨)
  created_at: string;
  updated_at: string;
}

export interface RecipientDetail extends Recipient {
  merit_content?: MeritContent | null;
  checklist?: ChecklistRead | null;
  career_records: CareerRecord[];
  previous_awards: PreviousAward[];
}

export interface MeritContent {
  id: string;
  recipient_id: string;
  merit_short_summary?: string;
  recommendation_reason?: string;
  merit_overview_1?: string;
  merit_overview_2?: string;
  merit_overview_3?: string;
  merit_overview_4?: string;
  full_merit_text?: string;
  character_assessment?: string;
  local_reputation?: string;
  merit_consistency?: string;
  investigator_department?: string;
  investigator_position?: string;
  investigator_rank?: string;
  investigator_name?: string;
}

export interface CareerRecord {
  id: string;
  recipient_id: string;
  record_date?: string;
  description?: string;
  sort_order: number;
}

export interface PreviousAward {
  id: string;
  recipient_id: string;
  award_date?: string;
  description?: string;
  sort_order: number;
}

export interface GeneratedFileInfo {
  type: string;
  file_name: string;
  download_url: string;
}

export interface GenerateDocumentResponse {
  files: GeneratedFileInfo[];
}

export interface URLExtractResponse {
  recipient_name?: string;
  organization_name?: string;
  position?: string;
  merit_keywords: string[];
  raw_text?: string;
  status?: "ok" | "fetch_failed" | "parse_empty";
  status_message?: string;
  page_title?: string;
  text_length?: number;
}
