import { FormEvent, useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import {
  getManageInfo,
  submitManageApplication,
  changeManageCredentials,
  getManageRecipient,
  updateManageRecipient,
  deleteManageRecipient,
  type ManageCaseInfo,
  type ManageCreds,
  type ManageRecipientBasic,
  type ManageRecipientMerit,
} from "../api/applications";
import Field, { Button, Input, TextArea } from "../components/Field";
import PublicLayout from "../components/PublicLayout";
import ShareLinkBox from "../components/ShareLinkBox";

/** 기관 대표 전용(/apply/manage/:token) — 보호되는 관리 링크.
 *  대표가 모인 대상자를 검토·수정·제외하고 최종 제출한다. 관리 비밀번호가 설정돼 있으면
 *  아이디/비밀번호로 인증해야 접근할 수 있다(작성 대상자 추가 링크는 별도로 개방). */
export default function ManageApplicationPage() {
  const { token = "" } = useParams();
  const location = useLocation();
  // 제출 직후 전달된 자격(있으면 재입력 없이 바로 인증)
  const initCreds = (location.state as { creds?: ManageCreds } | null)?.creds ?? null;
  const [info, setInfo] = useState<ManageCaseInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 관리 링크 자격 — 인증된 자격은 메모리에만 보관
  const [creds, setCreds] = useState<ManageCreds | null>(initCreds);
  const [authId, setAuthId] = useState("");
  const [authPw, setAuthPw] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(false);

  // 관리 비밀번호 변경/해제
  const [credUser, setCredUser] = useState("");
  const [credPw, setCredPw] = useState("");
  const [savingCred, setSavingCred] = useState(false);

  // 대상자 검토·수정
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = (c?: ManageCreds | null) =>
    getManageInfo(token, c ?? undefined)
      .then(s => {
        setInfo(s);
        setCredUser(s.manage_username || "");
      })
      .catch(err =>
        setLoadError(
          err?.response?.data?.detail || "유효하지 않은 관리 링크입니다."
        )
      );

  useEffect(() => {
    load(initCreds ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthChecking(true);
    try {
      const c: ManageCreds = { id: authId.trim(), pw: authPw };
      const s = await getManageInfo(token, c);
      if (s.authorized) {
        setCreds(c);
        setInfo(s);
        setCredUser(s.manage_username || "");
      } else {
        setAuthError("아이디 또는 비밀번호가 올바르지 않습니다.");
      }
    } catch {
      setAuthError("확인 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setAuthChecking(false);
    }
  };

  const onDeleteRecipient = async (rid: string, name?: string) => {
    if (!confirm(`'${name || "이 대상자"}'를 명단에서 제외할까요? 되돌릴 수 없습니다.`))
      return;
    setDeletingId(rid);
    try {
      await deleteManageRecipient(token, rid, creds ?? undefined);
      await load(creds);
    } catch (err: any) {
      alert("제외 실패: " + (err?.response?.data?.detail || err?.message || ""));
    } finally {
      setDeletingId(null);
    }
  };

  const onFinalSubmit = async () => {
    if (
      !confirm(
        "지금까지 추가된 추천대상자로 최종 제출합니다. 제출하면 표창 담당자에게 명단이 전달됩니다. 진행할까요?"
      )
    )
      return;
    setSubmitting(true);
    try {
      await submitManageApplication(token, creds ?? undefined);
      await load(creds);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      alert(
        "최종 제출 실패: " + (err?.response?.data?.detail || err?.message || "")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onChangeCred = async () => {
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
      await changeManageCredentials(
        token,
        credUser.trim(),
        credPw,
        creds ?? undefined
      );
      const next: ManageCreds = { id: credUser.trim(), pw: credPw };
      setCreds(next); // 새 자격으로 세션 유지
      setCredPw("");
      await load(next);
      alert("관리 비밀번호를 변경했습니다.");
    } catch (err: any) {
      alert("변경 실패: " + (err?.response?.data?.detail || err?.message || ""));
    } finally {
      setSavingCred(false);
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

  // 관리 비밀번호 보호 — 아직 인증 안 됨: 아이디/비밀번호 게이트
  if (info.protected && !info.authorized) {
    return (
      <PublicLayout>
        <div className="max-w-md mx-auto">
          <div className="krds-page-header">
            <div>
              <h1 className="krds-page-title">관리자 인증</h1>
              <p className="krds-page-sub leading-relaxed">
                기관 대표 관리 화면입니다. 신청 시 설정한 아이디와 비밀번호를
                입력해 주세요. 잊으신 경우 표창 담당 전문위원실에 문의하면
                확인·재설정해 드립니다.
              </p>
            </div>
          </div>
          <form onSubmit={onAuthSubmit} className="krds-card krds-card-pad space-y-4">
            <Field label="아이디">
              <Input
                value={authId}
                onChange={e => setAuthId(e.target.value)}
                autoFocus
                required
              />
            </Field>
            <Field label="비밀번호">
              <Input
                type="password"
                value={authPw}
                onChange={e => setAuthPw(e.target.value)}
                required
              />
            </Field>
            {authError && (
              <p className="text-sm text-danger-700 bg-danger-50 border border-danger-200 rounded-md px-3 py-2">
                {authError}
              </p>
            )}
            <Button type="submit" disabled={authChecking} block>
              {authChecking ? "확인 중..." : "확인"}
            </Button>
          </form>
        </div>
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

        {/* 작성자에게 줄 링크 — 대표가 각 대상자에게 배포(자격 없이 개방) */}
        {info.share_token && (
          <div className="krds-card krds-card-pad border-brand-200 bg-brand-50/40">
            <h2 className="text-sm font-bold text-ink-800">
              ✋ 작성자에게 줄 링크 (각 추천대상자에게 전달)
            </h2>
            <p className="text-xs text-ink-600 mt-0.5 leading-relaxed">
              이 링크를 받은 대상자가 본인 정보를 입력하면 아래 명단에 추가됩니다.
              <strong> 작성자는 아이디·비밀번호 없이</strong> 바로 입력할 수
              있습니다.
            </p>
            <ShareLinkBox token={info.share_token} basePath="/apply/add" />
          </div>
        )}

        {/* 관리 링크 주소 — 대표가 나중에 다시 들어올 때 필요 */}
        <div className="krds-card krds-card-pad">
          <h2 className="text-sm font-bold text-ink-800">
            이 관리 화면 주소 (대표 보관용)
          </h2>
          <p className="text-xs text-ink-600 mt-0.5 leading-relaxed">
            나중에 다시 검토·제출하러 들어올 때 필요합니다. 접속 시 설정한
            아이디·비밀번호를 입력합니다. <strong>외부에 공유하지 마세요.</strong>
          </p>
          <ShareLinkBox token={token} basePath="/apply/manage" />
        </div>

        {/* 관리 링크 비밀번호 — 이 관리 화면 보호 (변경/해제) */}
        <div className="krds-card krds-card-pad">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-ink-800">
              관리 화면 비밀번호
            </h2>
            <span
              className={`text-xs font-semibold ${
                info.protected ? "text-success-700" : "text-ink-500"
              }`}
            >
              {info.protected ? "보호 중" : "미설정(링크만으로 접근)"}
            </span>
          </div>
          <p className="text-xs text-ink-600 mt-0.5 leading-relaxed">
            이 관리 화면(검토·수정·최종제출)에 접근할 때 요구하는 아이디·비밀번호입니다.
            변경하면 다음 접속부터 새 자격이 필요합니다.
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
                placeholder={info.protected ? "변경하려면 입력" : "설정할 비밀번호"}
              />
            </Field>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              type="button"
              size="sm"
              onClick={onChangeCred}
              disabled={savingCred}
            >
              {info.protected ? "비밀번호 변경" : "비밀번호 설정"}
            </Button>
          </div>
        </div>

        {/* 모인 대상자 명단 */}
        <div className="krds-card krds-card-pad">
          <h2 className="text-sm font-bold text-ink-800 mb-2">
            추가된 추천대상자 ({info.recipient_count}명)
          </h2>
          {!info.submitted && info.recipient_count > 0 && (
            <p className="text-xs text-ink-500 mb-2">
              최종 제출 전까지 각 대상자의 정보를 검토·수정하거나 잘못 들어온
              대상자를 제외할 수 있습니다.
            </p>
          )}
          {info.recipients.length === 0 ? (
            <p className="text-sm text-ink-500">
              아직 추가된 대상자가 없습니다. 위 링크를 대상자에게 보내 주세요.
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {info.recipients.map((r, i) => (
                <li
                  key={r.id || i}
                  className="py-2 flex items-center gap-2 flex-wrap"
                >
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
                  {!info.submitted && (
                    <span className="ml-auto flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingId(r.id)}
                      >
                        수정
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={deletingId === r.id}
                        onClick={() => onDeleteRecipient(r.id, r.recipient_name)}
                      >
                        {deletingId === r.id ? "처리 중..." : "제외"}
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {editingId && (
          <RecipientEditModal
            manageToken={token}
            recipientId={editingId}
            creds={creds}
            onClose={() => setEditingId(null)}
            onSaved={async () => {
              setEditingId(null);
              await load(creds);
            }}
          />
        )}

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

/** 대표 검토용 대상자 수정 모달 — 기본정보 + 공적사항. */
function RecipientEditModal({
  manageToken,
  recipientId,
  creds,
  onClose,
  onSaved,
}: {
  manageToken: string;
  recipientId: string;
  creds: ManageCreds | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [basic, setBasic] = useState<ManageRecipientBasic | null>(null);
  const [merit, setMerit] = useState<ManageRecipientMerit>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getManageRecipient(manageToken, recipientId, creds ?? undefined)
      .then(d => {
        setBasic({
          recipient_name: d.recipient_name,
          chinese_name: d.chinese_name,
          birth_date: d.birth_date,
          gender: d.gender,
          address: d.address,
          region: d.region,
          occupation: d.occupation,
          organization_name: d.organization_name,
          recipient_position_title: d.recipient_position_title,
          external_title: d.external_title,
          rank_grade: d.rank_grade,
          merit_category: d.merit_category,
          merit_period: d.merit_period,
          note: d.note,
        });
        setMerit(d.merit_content ?? {});
      })
      .catch(err =>
        setError(err?.response?.data?.detail || "대상자 정보를 불러오지 못했습니다.")
      );
  }, [manageToken, recipientId, creds]);

  const setB = (k: keyof ManageRecipientBasic) => (v: string) =>
    setBasic(prev => (prev ? { ...prev, [k]: v } : prev));
  const setM = (k: keyof ManageRecipientMerit) => (v: string) =>
    setMerit(prev => ({ ...prev, [k]: v }));

  const onSave = async () => {
    if (!basic) return;
    if (!basic.recipient_name?.trim()) {
      setError("성명을 입력하세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateManageRecipient(
        manageToken,
        recipientId,
        basic,
        merit,
        creds ?? undefined
      );
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "저장에 실패했습니다.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-6">
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-200 sticky top-0 bg-white rounded-t-lg">
          <h3 className="text-base font-bold text-ink-900">대상자 정보 수정</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-500 hover:text-ink-800 text-xl leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {error && (
            <p className="text-sm text-danger-700 bg-danger-50 border border-danger-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          {!basic ? (
            <p className="text-sm text-ink-500">불러오는 중...</p>
          ) : (
            <>
              <div>
                <h4 className="text-sm font-bold text-ink-800 mb-2">기본정보</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="성명">
                    <Input value={basic.recipient_name || ""} onChange={e => setB("recipient_name")(e.target.value)} />
                  </Field>
                  <Field label="한자">
                    <Input value={basic.chinese_name || ""} onChange={e => setB("chinese_name")(e.target.value)} />
                  </Field>
                  <Field label="단체명">
                    <Input value={basic.organization_name || ""} onChange={e => setB("organization_name")(e.target.value)} />
                  </Field>
                  <Field label="직위">
                    <Input value={basic.recipient_position_title || ""} onChange={e => setB("recipient_position_title")(e.target.value)} />
                  </Field>
                  <Field label="공적분야">
                    <Input value={basic.merit_category || ""} onChange={e => setB("merit_category")(e.target.value)} />
                  </Field>
                  <Field label="공적기간">
                    <Input value={basic.merit_period || ""} onChange={e => setB("merit_period")(e.target.value)} />
                  </Field>
                  <Field label="직업">
                    <Input value={basic.occupation || ""} onChange={e => setB("occupation")(e.target.value)} />
                  </Field>
                  <Field label="직급(공무원 등)">
                    <Input value={basic.rank_grade || ""} onChange={e => setB("rank_grade")(e.target.value)} />
                  </Field>
                </div>
                <div className="mt-3">
                  <Field label="주소">
                    <Input value={basic.address || ""} onChange={e => setB("address")(e.target.value)} />
                  </Field>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-ink-800 mb-2">공적사항</h4>
                <div className="space-y-3">
                  <Field label="공적요지" hint="50자 내외">
                    <TextArea rows={2} value={merit.merit_short_summary || ""} onChange={e => setM("merit_short_summary")(e.target.value)} />
                  </Field>
                  <Field label="추천사유">
                    <TextArea rows={3} value={merit.recommendation_reason || ""} onChange={e => setM("recommendation_reason")(e.target.value)} />
                  </Field>
                  <Field label="공적사항(본문)">
                    <TextArea rows={5} value={merit.full_merit_text || ""} onChange={e => setM("full_merit_text")(e.target.value)} />
                  </Field>
                  <Field label="성품">
                    <TextArea rows={2} value={merit.character_assessment || ""} onChange={e => setM("character_assessment")(e.target.value)} />
                  </Field>
                  <Field label="지역여론">
                    <TextArea rows={2} value={merit.local_reputation || ""} onChange={e => setM("local_reputation")(e.target.value)} />
                  </Field>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-ink-200 sticky bottom-0 bg-white rounded-b-lg">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button type="button" onClick={onSave} disabled={saving || !basic}>
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}
