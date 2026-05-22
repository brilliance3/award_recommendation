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
  created_at: string;
  updated_at: string;
  recipient_count: number;
}

export interface AwardCaseDetail extends AwardCase {
  recipients: Recipient[];
}

export interface Recipient {
  id: string;
  award_case_id: string;
  sequence_no: number;
  recipient_name: string;
  chinese_name?: string;
  birth_date?: string;
  birth_yymmdd?: string;
  address?: string;
  region?: string;
  occupation?: string;
  organization_name?: string;
  recipient_position_title?: string;
  external_title?: string;
  merit_category?: string;
  merit_period?: string;
  recommendation_rank?: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface RecipientDetail extends Recipient {
  merit_content?: MeritContent | null;
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
