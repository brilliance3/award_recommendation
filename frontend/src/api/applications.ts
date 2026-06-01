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
  recipient_position_title: string;
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
  message: string;
}

export const submitApplication = (payload: ApplicationSubmit) =>
  api
    .post<ApplicationSubmitResponse>("/api/applications/submit", payload)
    .then(r => r.data);
