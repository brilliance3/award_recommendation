import { api } from "./client";

export interface OverviewStats {
  total_cases: number;
  total_recipients: number;
  total_council_members: number;
  by_recipient_status: Record<string, number>;
  by_award_grade: Record<string, number>;
}

export interface CommitteeStat {
  committee: string;
  cases: number;
  recipients: number;
}

export interface MemberStat {
  name: string;
  party?: string;
  committee?: string;
  district?: string;
  cases: number;
  recipients: number;
}

export interface CategoryStat {
  category: string;
  count: number;
}

export const statsApi = {
  overview: () => api.get<OverviewStats>("/api/stats/overview").then(r => r.data),
  byCommittee: () => api.get<CommitteeStat[]>("/api/stats/by-committee").then(r => r.data),
  byMember: () => api.get<MemberStat[]>("/api/stats/by-member").then(r => r.data),
  byMeritCategory: () => api.get<CategoryStat[]>("/api/stats/by-merit-category").then(r => r.data),
};

export const bulkApi = {
  aiMerit: (caseId: string, payload: { keywords: string[]; overwrite?: boolean }) =>
    api.post<{
      total: number;
      success: number;
      skipped: number;
      failed: number;
      items: Array<{ recipient_id: string; recipient_name: string; ok: boolean; skipped?: boolean; error?: string }>;
    }>(`/api/award-cases/${caseId}/bulk-ai-merit`, payload).then(r => r.data),

  hwpx: (caseId: string) =>
    api.post<{
      total: number;
      success: number;
      failed: number;
      items: Array<{ recipient_id: string; recipient_name: string; ok: boolean; file_name?: string; download_url?: string; error?: string }>;
    }>(`/api/award-cases/${caseId}/bulk-hwpx`).then(r => r.data),
};
