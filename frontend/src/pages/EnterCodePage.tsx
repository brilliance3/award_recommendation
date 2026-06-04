import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resolveShareCode } from "../api/applications";
import Field, { Button, Input } from "../components/Field";
import PublicLayout from "../components/PublicLayout";

/** 작성자용 짧은 코드 입력 (/apply/add, 토큰 없이 진입) — 코드 → 대상자 추가 화면으로 이동. */
export default function EnterCodePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const c = code.trim().toUpperCase();
    if (!c) {
      setError("코드를 입력해 주세요.");
      return;
    }
    setChecking(true);
    try {
      const { share_token } = await resolveShareCode(c);
      navigate(`/apply/add/${share_token}`);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "유효하지 않은 코드입니다. 기관 신청자에게 코드를 확인해 주세요."
      );
      setChecking(false);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto">
        <div className="krds-page-header">
          <div>
            <h1 className="krds-page-title">표창 추천 대상자 정보 입력</h1>
            <p className="krds-page-sub leading-relaxed">
              신청 기관에서 받은 <strong>코드</strong>를 입력하면 본인 정보 입력
              화면으로 이동합니다. (링크를 직접 받으셨다면 그 링크로 바로 들어가셔도
              됩니다.)
            </p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="krds-card krds-card-pad space-y-4">
          <Field label="코드" hint="영문 대문자·숫자 7자리">
            <Input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              autoFocus
              maxLength={12}
              placeholder="예: K7P2QHM"
              className="font-mono text-lg tracking-widest"
            />
          </Field>
          {error && (
            <p className="text-sm text-danger-700 bg-danger-50 border border-danger-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          <Button type="submit" disabled={checking} block>
            {checking ? "확인 중..." : "다음"}
          </Button>
        </form>
      </div>
    </PublicLayout>
  );
}
