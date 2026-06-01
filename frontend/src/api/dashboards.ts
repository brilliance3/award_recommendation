import { api } from "./client";

export interface QuotaRow {
  legislator_name: string;
  party: string;
  staff?: string;
  is_chair: boolean;
  max_quota: number | null;
  used: number;
  remaining: number | null;
  case_count: number;
  seal_filename?: string;
  governor_max: number;
  governor_used: number;
  governor_remaining: number;
}

export interface QuotaResponse {
  term_start: string;
  term_end: string;
  calendar_start: string;
  calendar_end: string;
  rows: QuotaRow[];
}

export interface CaseRow {
  id: string;
  title: string;
  recommender_name?: string;
  recommendation_date?: string; // 공적제출일
  award_date?: string; // 표창일
  target_issue_date?: string; // 발급목표일 (영업일 D-3)
  recipient_count: number;
  recipient_names: string[];
  applicant_name?: string;
  applicant_contact?: string;
  status?: string;
}

export const CASE_STATUSES = [
  "대기",
  "예정",
  "진행",
  "보관",
  "완료",
  "취소",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_LABELS: Record<string, string> = {
  대기: "표창 요청 받은 후 공적조서 받기 전",
  예정: "공적조서 수신 후 검토 전",
  진행: "공적조서 상신 완료 후",
  보관: "표창 수령 후 보관중",
  완료: "표창 수령 후 발송 완료",
  취소: "표창 요청이 취소된 경우",
};

export interface CasesResponse {
  term_start: string;
  term_end: string;
  rows: CaseRow[];
}

export const getQuotaStatus = () =>
  api.get<QuotaResponse>("/api/dashboards/quota").then(r => r.data);

export const getAllCases = (legislator?: string) =>
  api
    .get<CasesResponse>("/api/dashboards/cases", {
      params: legislator ? { legislator } : undefined,
    })
    .then(r => r.data);
