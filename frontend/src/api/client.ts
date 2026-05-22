import axios from "axios";

/**
 * 운영(Vercel): VITE_API_BASE_URL = https://award-recommendation.fly.dev
 * 로컬 개발: 빈 문자열 → vite.config.ts 의 /api 프록시로 라우팅
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || "";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

/** 백엔드 download_url(`/api/files/...`)을 브라우저에서 직접 열 수 있는 절대 URL로 */
export function absoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${API_BASE_URL}${pathOrUrl}`;
}

// 모든 API 호출 실패를 콘솔에 자세히 출력 (디버깅용)
api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    const cfg = err?.config || {};
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail || err?.response?.data || err?.message;
    // eslint-disable-next-line no-console
    console.error(
      `[API 오류] ${cfg.method?.toUpperCase()} ${cfg.url}`,
      status ? `HTTP ${status}` : "(응답 없음)",
      detail
    );
    return Promise.reject(err);
  }
);
