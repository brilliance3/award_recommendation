import { useState } from "react";
import { login } from "../api";
import Field, { Input, Button } from "../components/Field";

export default function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      onSuccess();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || "로그인에 실패했습니다. 다시 시도해 주세요."
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-ink-50">
      {/* 상단 정부 표기 바 */}
      <div className="bg-ink-900 text-ink-100 text-[11px] sm:text-xs">
        <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 h-7 flex items-center">
          <span className="tracking-wide">
            경기도의회 · GYEONGGI PROVINCIAL COUNCIL
          </span>
        </div>
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-6">
            <img
              src="/ci/assembly-logo-black.png"
              alt="경기도의회 Gyeonggido Assembly"
              className="h-12 w-auto select-none"
              draggable={false}
            />
            <h1 className="mt-4 text-lg font-bold text-ink-900">
              표창 관리 시스템
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              행정 업무용 내부 시스템입니다. 로그인 후 이용하세요.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="krds-card krds-card-pad space-y-4"
          >
            <Field label="아이디">
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </Field>
            <Field label="비밀번호">
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>

            {error && (
              <p className="text-sm text-danger-700 bg-danger-50 border border-danger-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" disabled={submitting} block>
              {submitting ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        </div>
      </main>

      <footer className="border-t border-ink-200 bg-white">
        <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 py-5 text-xs text-ink-500 text-center">
          © {new Date().getFullYear()} 경기도의회 표창 관리 시스템. 행정 업무용
          내부 시스템.
        </div>
      </footer>
    </div>
  );
}
