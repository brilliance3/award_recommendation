import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getManageInfo,
  submitManageApplication,
  setShareCredentialsByManage,
  type ManageCaseInfo,
} from "../api/applications";
import Field, { Button, Input } from "../components/Field";
import PublicLayout from "../components/PublicLayout";
import ShareLinkBox from "../components/ShareLinkBox";

/** 기관 대표 전용(/apply/manage/:token) — 모인 대상자 검토 + 대상자 추가 링크 배포 + 최종 제출. */
export default function ManageApplicationPage() {
  const { token = "" } = useParams();
  const [info, setInfo] = useState<ManageCaseInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 공유 링크 자격(아이디/비밀번호) 설정
  const [credUser, setCredUser] = useState("");
  const [credPw, setCredPw] = useState("");
  const [savingCred, setSavingCred] = useState(false);

  const load = () =>
    getManageInfo(token)
      .then(s => {
        setInfo(s);
        setCredUser(s.share_username || "");
      })
      .catch(err =>
        setLoadError(
          err?.response?.data?.detail || "유효하지 않은 관리 링크입니다."
        )
      );

  const onSaveCred = async () => {
    if (!credUser.trim()) {
      alert("아이디를 입력하세요.");
      return;
    }
    if (credPw.length < 4) {
      alert("비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    setSavingCred(true);
    try {
      await setShareCredentialsByManage(token, credUser.trim(), credPw);
      setCredPw("");
      await load();
      alert("공유 링크 자격을 설정했습니다. 이제 이 링크를 열려면 아이디·비밀번호가 필요합니다.");
    } catch (err: any) {
      alert("설정 실패: " + (err?.response?.data?.detail || err?.message || ""));
    } finally {
      setSavingCred(false);
    }
  };

  const onClearCred = async () => {
    if (!confirm("공유 링크 자격을 해제하면 누구나 링크로 대상자를 추가할 수 있습니다. 진행할까요?"))
      return;
    setSavingCred(true);
    try {
      await setShareCredentialsByManage(token, "", "");
      setCredPw("");
      await load();
      alert("자격을 해제했습니다. 이제 링크만으로 접근할 수 있습니다.");
    } catch (err: any) {
      alert("해제 실패: " + (err?.response?.data?.detail || err?.message || ""));
    } finally {
      setSavingCred(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onFinalSubmit = async () => {
    if (
      !confirm(
        "지금까지 추가된 추천대상자로 최종 제출합니다. 제출하면 표창 담당자에게 명단이 전달됩니다. 진행할까요?"
      )
    )
      return;
    setSubmitting(true);
    try {
      await submitManageApplication(token);
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      alert(
        "최종 제출 실패: " +
          (err?.response?.data?.detail || err?.message || "")
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <PublicLayout>
        <div className="max-w-2xl mx-auto">
          <div className="krds-card krds-card-pad text-center py-10">
            <div className="text-3xl mb-3">⚠️</div>
            <h1 className="text-lg font-bold text-ink-900 mb-2">
              관리 링크를 열 수 없습니다
            </h1>
            <p className="text-sm text-ink-700">{loadError}</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (!info) {
    return (
      <PublicLayout>
        <div className="max-w-2xl mx-auto text-ink-500">불러오는 중...</div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="krds-page-header">
          <div>
            <h1 className="krds-page-title">추천대상자 검토 · 최종 제출</h1>
            <p className="krds-page-sub leading-relaxed">
              <strong>{info.organization || "기관"}</strong> · 추천의원{" "}
              {info.recommender_name || "-"} · {info.award_grade || "-"}
              {info.award_date ? ` · 희망 표창일 ${info.award_date}` : ""}
            </p>
          </div>
        </div>

        {info.submitted ? (
          <div className="krds-card krds-card-pad border-success-500/40 bg-success-50">
            <h2 className="text-base font-bold text-success-700">
              ✅ 최종 제출 완료
            </h2>
            <p className="text-sm text-ink-700 mt-1 leading-relaxed">
              명단이 표창 담당자에게 전달되었습니다. 이후 아래 링크로 대상자가
              추가되면 담당자에게 바로 반영됩니다.
            </p>
          </div>
        ) : (
          <div className="krds-card krds-card-pad bg-amber-50 border-amber-300">
            <p className="text-sm text-amber-800 leading-relaxed">
              아직 <strong>최종 제출 전</strong>입니다. 최종 제출 전까지는 표창
              담당자에게 보이지 않습니다. 대상자가 모두 모이면 아래에서 최종
              제출하세요.
            </p>
          </div>
        )}

        {/* 대상자 추가 링크 — 대표가 각 대상자에게 배포 */}
        {info.share_token && (
          <div className="krds-card krds-card-pad">
            <h2 className="text-sm font-bold text-ink-800">
              대상자 추가 링크 (각 추천대상자에게 전달)
            </h2>
            <p className="text-xs text-ink-600 mt-0.5">
              이 링크를 받은 대상자가 본인 정보를 입력하면 아래 명단에 추가됩니다.
            </p>
            <ShareLinkBox token={info.share_token} basePath="/apply/add" />

            {/* 공유 링크 자격(아이디/비밀번호) 설정 — 선택 */}
            <div className="mt-4 pt-4 border-t border-ink-100">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-ink-800">
                  링크 보호 (아이디/비밀번호)
                </h3>
                <span
                  className={`text-xs font-semibold ${
                    info.share_protected ? "text-success-700" : "text-ink-500"
                  }`}
                >
                  {info.share_protected ? "설정됨" : "미설정(공개)"}
                </span>
              </div>
              <p className="text-xs text-ink-600 mt-0.5 leading-relaxed">
                설정하면 위 링크를 받은 사람도 아이디·비밀번호를 입력해야 정보를
                추가할 수 있습니다. 작성자가 자격을 잊으면 표창 담당 전문위원실에
                문의하면 확인·재설정해 드립니다.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <Field label="아이디">
                  <Input
                    value={credUser}
                    onChange={e => setCredUser(e.target.value)}
                    autoComplete="off"
                  />
                </Field>
                <Field label="비밀번호" hint="4자 이상. 변경 시 새로 입력">
                  <Input
                    type="password"
                    value={credPw}
                    onChange={e => setCredPw(e.target.value)}
                    autoComplete="new-password"
                    placeholder={info.share_protected ? "변경하려면 입력" : "설정할 비밀번호"}
                  />
                </Field>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={onSaveCred}
                  disabled={savingCred}
                >
                  {info.share_protected ? "자격 변경" : "자격 설정"}
                </Button>
                {info.share_protected && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={onClearCred}
                    disabled={savingCred}
                  >
                    자격 해제
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 모인 대상자 명단 */}
        <div className="krds-card krds-card-pad">
          <h2 className="text-sm font-bold text-ink-800 mb-2">
            추가된 추천대상자 ({info.recipient_count}명)
          </h2>
          {info.recipients.length === 0 ? (
            <p className="text-sm text-ink-500">
              아직 추가된 대상자가 없습니다. 위 링크를 대상자에게 보내 주세요.
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {info.recipients.map((r, i) => (
                <li key={i} className="py-2 flex items-center gap-2">
                  <span className="krds-badge krds-badge-ink shrink-0">
                    #{i + 1}
                  </span>
                  <span className="font-semibold text-ink-900">
                    {r.recipient_name || "(이름 미입력)"}
                  </span>
                  <span className="text-xs text-ink-600">
                    {[r.organization_name, r.recipient_position_title]
                      .filter(Boolean)
                      .join(" · ")}
                    {r.merit_category ? ` · ${r.merit_category}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!info.submitted && (
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={onFinalSubmit}
              disabled={submitting || info.recipient_count < 1}
            >
              {submitting ? "제출 중..." : "검토 완료 · 최종 제출"}
            </Button>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
