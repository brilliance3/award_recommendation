import axios from "axios";

/**
 * 운영: 빈 문자열 → 같은 도메인(fly.dev)에서 상대경로 /api 호출 (deploy.sh가 그렇게 빌드).
 * 로컬 개발: 빈 문자열 → vite.config.ts 의 /api 프록시로 라우팅.
 * 필요 시 VITE_API_BASE_URL 로 별도 API 도메인을 지정할 수 있다.
 */
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || "";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // 세션 쿠키 전송
});

/** 백엔드 download_url(`/api/files/...`)을 브라우저에서 직접 열 수 있는 절대 URL로 */
export function absoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${API_BASE_URL}${pathOrUrl}`;
}

/**
 * FastAPI/Pydantic 422의 detail은 문자열이 아니라 객체 배열([{loc,msg,type}])일 수 있다.
 * JSX에 그대로 렌더하면 "Objects are not valid as a React child"로 흰 화면이 된다.
 * 항상 문자열로 정규화해 기존 코드의 data?.detail 읽기가 안전하게 동작하도록 한다.
 */
function normalizeDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => (e && typeof e === "object" ? (e as Record<string, unknown>).msg as string || JSON.stringify(e) : String(e)))
      .join(", ");
  }
  if (detail && typeof detail === "object") {
    const rec = detail as Record<string, unknown>;
    return (rec.msg as string) || JSON.stringify(detail);
  }
  return "";
}

// 모든 API 호출 실패를 콘솔에 자세히 출력 (디버깅용)
api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    const cfg = err?.config || {};
    const status = err?.response?.status;
    // detail을 항상 문자열로 정규화 — 422 배열 detail이 JSX에서 흰 화면 유발하는 것 방지
    if (err?.response?.data && "detail" in err.response.data) {
      err.response.data.detail = normalizeDetail(err.response.data.detail);
    }
    const detail = err?.response?.data?.detail || err?.response?.data || err?.message;
    // 세션 만료/미인증 — 로그인 화면으로 전환 (auth API 자체 호출은 제외)
    if (status === 401 && !String(cfg.url || "").includes("/api/auth/")) {
      window.dispatchEvent(new Event("auth-expired"));
    }
    // 개발 중에만 상세 로그. 운영에서는 응답 본문(개인정보 포함 가능)을 콘솔에 남기지 않는다.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error(
        `[API 오류] ${cfg.method?.toUpperCase()} ${cfg.url}`,
        status ? `HTTP ${status}` : "(응답 없음)",
        detail
      );
    }
    return Promise.reject(err);
  }
);
