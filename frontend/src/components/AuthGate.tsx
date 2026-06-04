import { ReactNode, useCallback, useEffect, useState } from "react";
import { getAuthState } from "../api";
import LoginPage from "../pages/LoginPage";

/** 인증 게이트 — 미인증 시 로그인 화면, 인증 시 앱을 렌더. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "in" | "out">("loading");

  const check = useCallback(async () => {
    try {
      const s = await getAuthState();
      setStatus(s.authenticated ? "in" : "out");
    } catch {
      // me 호출 자체가 실패(네트워크 등) → 로그인 화면 표시
      setStatus("out");
    }
  }, []);

  useEffect(() => {
    check();
    // 세션 만료(다른 API의 401)를 감지하면 로그인 화면으로 전환
    const onExpired = () => setStatus("out");
    window.addEventListener("auth-expired", onExpired);
    return () => window.removeEventListener("auth-expired", onExpired);
  }, [check]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-500">
        불러오는 중...
      </div>
    );
  }
  if (status === "out") {
    return <LoginPage onSuccess={() => setStatus("in")} />;
  }
  return <>{children}</>;
}
