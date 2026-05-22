import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

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
