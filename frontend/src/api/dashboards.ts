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
  governor_used: boolean; // 경기도지사 표창 사용 여부(담당자 수동 체크, 역년/임기 1건)
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
  award_grade?: string; // 훈격(의장/도지사 표창)
  recommender_name?: string;
  chair_sign?: boolean; // 위원장 명의로 제출(문서만 위원장 명의, 통계는 원래 의원)
  recommendation_date?: string; // 공적제출일
  award_date?: string; // 표창일(대상자별 대표값=최솟값)
  award_date_count?: number; // 서로 다른 표창일 개수(>1이면 복수)
  target_issue_date?: string; // 발급목표일 (영업일 D-3)
  recipient_count: number;
  recipient_names: string[];
  applicant_name?: string;
  applicant_contact?: string;
  applicant_role?: "individual" | "organization" | string; // 외부신청 식별(없으면 내부 수기)
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

/** 경기도지사 표창 사용 여부 체크/해제(의원당 역년·반기 1건, 위원장 포함). */
export const setGovernorMark = (legislatorName: string, used: boolean) =>
  api
    .post<{ legislator_name: string; used: boolean; period_start: string }>(
      "/api/dashboards/quota/governor",
      { legislator_name: legislatorName, used }
    )
    .then(r => r.data);

export const getAllCases = (legislator?: string) =>
  api
    .get<CasesResponse>("/api/dashboards/cases", {
      params: legislator ? { legislator } : undefined,
    })
    .then(r => r.data);
