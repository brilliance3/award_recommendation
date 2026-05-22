import { api } from "./client";
import type { AwardCase, AwardCaseDetail, GenerateDocumentResponse, GeneratedFileInfo } from "../types";

export const listCases = () => api.get<AwardCase[]>("/api/award-cases").then(r => r.data);

export const createCase = (payload: Partial<AwardCase>) =>
  api.post<AwardCase>("/api/award-cases", payload).then(r => r.data);

export const getCase = (id: string) =>
  api.get<AwardCaseDetail>(`/api/award-cases/${id}`).then(r => r.data);

export const updateCase = (id: string, payload: Partial<AwardCase>) =>
  api.patch<AwardCase>(`/api/award-cases/${id}`, payload).then(r => r.data);

export const deleteCase = (id: string) =>
  api.delete(`/api/award-cases/${id}`).then(r => r.data);

export const generateXlsx = (id: string) =>
  api.post<GenerateDocumentResponse>(`/api/award-cases/${id}/generate-xlsx`).then(r => r.data);

export const generateAll = (id: string) =>
  api.post<GenerateDocumentResponse>(`/api/award-cases/${id}/generate-all`).then(r => r.data);

export const generateZip = (id: string) =>
  api.post<GeneratedFileInfo>(`/api/award-cases/${id}/generate-zip`).then(r => r.data);

export const importXlsx = (id: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post<AwardCaseDetail>(`/api/award-cases/${id}/import-xlsx`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then(r => r.data);
};
