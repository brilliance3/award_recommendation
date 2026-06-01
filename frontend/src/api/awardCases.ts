import { api } from "./client";
import type { AwardCase, AwardCaseDetail, AwardCasePreview, GenerateDocumentResponse, GeneratedFileInfo } from "../types";

export const listCases = () => api.get<AwardCase[]>("/api/award-cases").then(r => r.data);

export const createCase = (payload: Partial<AwardCase>) =>
  api.post<AwardCase>("/api/award-cases", payload).then(r => r.data);

export const getCase = (id: string) =>
  api.get<AwardCaseDetail>(`/api/award-cases/${id}`).then(r => r.data);

export const getCasePreviewData = (id: string) =>
  api.get<AwardCasePreview>(`/api/award-cases/${id}/preview-data`).then(r => r.data);

export const updateCase = (id: string, payload: Partial<AwardCase>) =>
  api.patch<AwardCase>(`/api/award-cases/${id}`, payload).then(r => r.data);

export const deleteCase = (id: string) =>
  api.delete(`/api/award-cases/${id}`).then(r => r.data);

// --- 휴지통 ---
export const listTrash = () =>
  api.get<AwardCase[]>("/api/award-cases/trash").then(r => r.data);

export const restoreCase = (id: string) =>
  api.post(`/api/award-cases/${id}/restore`).then(r => r.data);

export const permanentDeleteCase = (id: string) =>
  api.delete(`/api/award-cases/${id}/permanent`).then(r => r.data);

export const trashAllCases = () =>
  api.post("/api/award-cases/trash-all").then(r => r.data);

export const restoreAllCases = () =>
  api.post("/api/award-cases/restore-all").then(r => r.data);

export const emptyTrash = () =>
  api.delete("/api/award-cases/trash/empty").then(r => r.data);

export const generateXlsx = (id: string) =>
  api.post<GenerateDocumentResponse>(`/api/award-cases/${id}/generate-xlsx`).then(r => r.data);

export const generateRecipientListXlsx = (id: string) =>
  api
    .post<GenerateDocumentResponse>(`/api/award-cases/${id}/generate-recipient-list-xlsx`)
    .then(r => r.data);

export const generateOverviewHwpx = (id: string) =>
  api
    .post<GenerateDocumentResponse>(`/api/award-cases/${id}/generate-overview-hwpx`)
    .then(r => r.data);

export const generateReportHwpx = (id: string) =>
  api
    .post<GenerateDocumentResponse>(`/api/award-cases/${id}/generate-report-hwpx`)
    .then(r => r.data);

export const generateReportPdf = (id: string) =>
  api
    .post<GenerateDocumentResponse>(`/api/award-cases/${id}/generate-report-pdf`)
    .then(r => r.data);

export const generateChecklistHwpx = (id: string) =>
  api
    .post<GenerateDocumentResponse>(`/api/award-cases/${id}/generate-checklist-hwpx`)
    .then(r => r.data);

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

// 한컴에서 직접 export 한 02 공적조서 PDF를 업로드 → 추천관·조사자 도장을 찍어 반환
export const stampUploadedPdf = (id: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post<GenerateDocumentResponse>(`/api/award-cases/${id}/stamp-uploaded-pdf`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then(r => r.data);
};
