import { api } from "./client";
import type {
  CareerRecord,
  GenerateDocumentResponse,
  MeritContent,
  PreviousAward,
  Recipient,
  RecipientDetail,
  URLExtractResponse,
} from "../types";

export const createRecipient = (caseId: string, payload: Partial<Recipient>) =>
  api.post<RecipientDetail>(`/api/award-cases/${caseId}/recipients`, payload).then(r => r.data);

export const getRecipient = (id: string) =>
  api.get<RecipientDetail>(`/api/recipients/${id}`).then(r => r.data);

export const updateRecipient = (id: string, payload: Partial<Recipient>) =>
  api.patch<RecipientDetail>(`/api/recipients/${id}`, payload).then(r => r.data);

export const deleteRecipient = (id: string) =>
  api.delete(`/api/recipients/${id}`).then(r => r.data);

export const upsertMerit = (id: string, payload: Partial<MeritContent>) =>
  api.put<MeritContent>(`/api/recipients/${id}/merit-content`, payload).then(r => r.data);

export const generateMerit = (id: string, payload: { keywords: string[]; activity_summary?: string }) =>
  api.post<MeritContent>(`/api/recipients/${id}/generate-merit`, payload).then(r => r.data);

export const generatePdf = (id: string) =>
  api.post<GenerateDocumentResponse>(`/api/recipients/${id}/generate-pdf`).then(r => r.data);

export const addCareer = (id: string, payload: Partial<CareerRecord>) =>
  api.post<CareerRecord>(`/api/recipients/${id}/career-records`, payload).then(r => r.data);

export const deleteCareer = (recordId: string) =>
  api.delete(`/api/career-records/${recordId}`).then(r => r.data);

export const addPreviousAward = (id: string, payload: Partial<PreviousAward>) =>
  api.post<PreviousAward>(`/api/recipients/${id}/previous-awards`, payload).then(r => r.data);

export const deletePreviousAward = (recordId: string) =>
  api.delete(`/api/previous-awards/${recordId}`).then(r => r.data);

export const extractFromUrl = (url: string) =>
  api.post<URLExtractResponse>(`/api/extract-from-url`, { url }).then(r => r.data);
