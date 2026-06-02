import { api } from "./client";

export interface AppSetting {
  agency_name?: string;
  committee_name?: string;
  department_name?: string;
  award_grade?: string;
  recommender_position?: string;
  quota_per_legislator?: number;
  investigator_department?: string;
  investigator_position?: string;
  investigator_rank?: string;
  investigator_name?: string;
  investigator_seal_filename?: string | null;
}

export interface Legislator {
  id: string;
  name: string;
  party?: string;
  is_chair: boolean;
  staff?: string | null;
  seal_filename?: string | null;
  sort_order: number;
}

export const getSettings = () =>
  api.get<AppSetting>("/api/settings").then(r => r.data);

export const resetAllSettings = () =>
  api.post("/api/settings/reset").then(r => r.data);

export const updateSettings = (payload: Partial<AppSetting>) =>
  api.patch<AppSetting>("/api/settings", payload).then(r => r.data);

export const uploadInvestigatorSeal = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post<AppSetting>("/api/settings/investigator-seal", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then(r => r.data);
};

export const listLegislators = () =>
  api.get<Legislator[]>("/api/legislators").then(r => r.data);

export const createLegislator = (payload: Partial<Legislator>) =>
  api.post<Legislator>("/api/legislators", payload).then(r => r.data);

export const updateLegislator = (id: string, payload: Partial<Legislator>) =>
  api.patch<Legislator>(`/api/legislators/${id}`, payload).then(r => r.data);

export const deleteLegislator = (id: string) =>
  api.delete(`/api/legislators/${id}`).then(r => r.data);

export const uploadLegislatorSeal = (id: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post<Legislator>(`/api/legislators/${id}/seal`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then(r => r.data);
};

/** 도장 이미지 표시용 URL (백엔드 서빙). 캐시 무력화 위해 buster 옵션 */
export function sealUrl(filename?: string | null, buster?: number | string): string | null {
  if (!filename) return null;
  const q = buster != null ? `?t=${buster}` : "";
  return `/api/seals/${encodeURIComponent(filename)}${q}`;
}
