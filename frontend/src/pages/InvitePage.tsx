import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { inviteApi, type PublicRecipient } from "../api/invite";
import PostcodeInput from "../components/PostcodeInput";
import GacSymbol from "../components/GacSymbol";

/**
 * 표창 추천 대상자가 본인 정보를 직접 입력하는 공개 페이지.
 * URL: /invite/{token}
 * 인증 없음 — 토큰을 가진 사람만 접근 가능.
 */
export default function InvitePage() {
  const { token = "" } = useParams();
  const [data, setData] = useState<PublicRecipient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    inviteApi
      .getByToken(token)
      .then((d) => setData(d))
      .catch((e) => setError(e?.response?.data?.detail || "링크가 유효하지 않습니다."))
      .finally(() => setLoading(false));
  }, [token]);

  const set = <K extends keyof PublicRecipient>(k: K, v: PublicRecipient[K]) =>
    setData((prev) => (prev ? { ...prev, [k]: v } : prev));

  const onSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const updated = await inviteApi.saveByToken(token, {
        recipient_name: data.recipient_name,
        chinese_name: data.chinese_name,
        birth_date: data.birth_date,
        phone_number: data.phone_number,
        address_zipcode: data.address_zipcode,
        address: data.address,
        registered_address: data.registered_address,
        nationality: data.nationality,
        occupation: data.occupation,
        organization_name: data.organization_name,
        recipient_position_title: data.recipient_position_title,
        external_title: data.external_title,
      });
      setData(updated);
      setSavedAt(new Date());
    } catch (e: any) {
      alert("저장 실패: " + (e?.response?.data?.detail || e?.message));
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async () => {
    if (!data) return;
    if (!data.recipient_name || !data.phone_number) {
      alert("성명과 핸드폰 번호는 필수입니다.");
      return;
    }
    if (!confirm("제출 후에는 수정 요청을 사무처에 별도로 알려야 합니다. 계속할까요?"))
      return;
    setSubmitting(true);
    try {
      // 마지막 저장 후 제출
      await onSave();
      const updated = await inviteApi.submitByToken(token);
      setData(updated);
    } catch (e: any) {
      alert("제출 실패: " + (e?.response?.data?.detail || e?.message));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-500">
        불러오는 중...
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="krds-card krds-card-pad max-w-md text-center">
          <div className="text-danger-600 text-2xl mb-2">⚠️</div>
          <h1 className="text-lg font-bold mb-2">접속 불가</h1>
          <p className="text-sm text-ink-600">
            {error || "유효하지 않은 링크입니다. 사무처로 문의해 주세요."}
          </p>
        </div>
      </div>
    );
  }

  const submitted = data.status === "submitted_by_recipient";

  return (
    <div className="min-h-screen bg-ink-50">
      {/* 상단 슬림 바 */}
      <div className="bg-brand-700 text-white text-xs">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-7 flex items-center justify-between">
          <span className="font-semibold tracking-wide">
            경기도의회 · GAC
          </span>
          <span className="hidden sm:inline opacity-80 italic">
            사람중심 · 민생중심 · 의회다운 의회
          </span>
        </div>
      </div>
      {/* CI 헤더 */}
      <header className="bg-gradient-to-r from-brand-600 to-accent-600 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-6 flex items-center gap-4">
          <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-white flex-shrink-0">
            <GacSymbol size={36} color="#3C5D93" />
          </span>
          <div>
            <p className="text-xs opacity-90 font-semibold tracking-wide">
              경기도의회 공적조서 자동작성 시스템
            </p>
            <h1 className="text-lg sm:text-xl font-extrabold mt-0.5">
              표창 추천 대상자 정보 입력
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        {/* 표창 안내 */}
        <section className="krds-card krds-card-pad">
          <h2 className="krds-section-title mb-3">표창 추천 안내</h2>
          <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
            <dt className="text-ink-500">표창 건명</dt>
            <dd className="col-span-2 font-semibold text-ink-900">
              {data.award_case_title || "-"}
            </dd>
            <dt className="text-ink-500">훈격</dt>
            <dd className="col-span-2">
              <span className="krds-badge krds-badge-brand">
                {data.award_grade || "-"}
              </span>
            </dd>
            <dt className="text-ink-500">추천인</dt>
            <dd className="col-span-2 text-ink-800">
              {data.recommender_name || "-"}
            </dd>
            <dt className="text-ink-500">처리 상태</dt>
            <dd className="col-span-2">
              {submitted ? (
                <span className="krds-status krds-status-submitted">
                  ✓ 제출 완료
                </span>
              ) : data.status === "invited" ? (
                <span className="krds-status krds-status-invited">
                  📝 작성 중
                </span>
              ) : (
                <span className="krds-status krds-status-draft">초안</span>
              )}
            </dd>
          </dl>
        </section>

        {submitted && (
          <div className="krds-alert krds-alert-success">
            <span>✅</span>
            <div>
              <p className="font-bold">제출이 완료되었습니다.</p>
              <p className="text-xs mt-0.5">
                사무처 직원의 검토 후 진행 상황을 핸드폰 번호({data.phone_number})로 안내드립니다.
              </p>
            </div>
          </div>
        )}

        {!submitted && (
          <div className="krds-alert krds-alert-info">
            <span>ℹ️</span>
            <div>
              <p className="font-bold">개인정보 처리 안내</p>
              <p className="text-xs mt-0.5">
                입력하신 정보는 표창 추천 업무에만 사용되며, 표창 결정 후 안전하게 보관·폐기됩니다.
                <strong className="mx-1">중간에 저장</strong>할 수 있으며, 모두 입력 후
                <strong className="mx-1">최종 제출</strong> 버튼을 눌러주세요.
              </p>
            </div>
          </div>
        )}

        {/* 인적사항 입력 폼 */}
        <section className="krds-card krds-card-pad space-y-4">
          <h2 className="krds-section-title">인적사항</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="krds-label krds-label-required">성명</label>
              <input
                className="krds-input"
                value={data.recipient_name || ""}
                onChange={(e) => set("recipient_name", e.target.value)}
                disabled={submitted}
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="krds-label">한자</label>
              <input
                className="krds-input"
                value={data.chinese_name || ""}
                onChange={(e) => set("chinese_name", e.target.value)}
                disabled={submitted}
                placeholder="洪吉童"
              />
            </div>
            <div>
              <label className="krds-label">생년월일</label>
              <input
                type="date"
                className="krds-input"
                value={data.birth_date || ""}
                onChange={(e) => set("birth_date", e.target.value)}
                disabled={submitted}
              />
            </div>
            <div>
              <label className="krds-label krds-label-required">
                핸드폰 번호
              </label>
              <input
                className="krds-input"
                value={data.phone_number || ""}
                onChange={(e) => set("phone_number", e.target.value)}
                disabled={submitted}
                placeholder="010-1234-5678"
                inputMode="tel"
              />
              <p className="krds-hint">처리 현황 안내 SMS 발송에 사용됩니다.</p>
            </div>
          </div>

          <div>
            <label className="krds-label">현주소</label>
            <PostcodeInput
              zipcode={data.address_zipcode || ""}
              address={data.address || ""}
              onChange={(v) => {
                set("address_zipcode", v.zipcode);
                set("address", v.address);
              }}
            />
          </div>

          <div>
            <label className="krds-label">등록기준지 (선택)</label>
            <input
              className="krds-input"
              value={data.registered_address || ""}
              onChange={(e) => set("registered_address", e.target.value)}
              disabled={submitted}
              placeholder="가족관계등록부상의 등록기준지"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="krds-label">국적</label>
              <input
                className="krds-input"
                value={data.nationality || "대한민국"}
                onChange={(e) => set("nationality", e.target.value)}
                disabled={submitted}
              />
            </div>
            <div>
              <label className="krds-label">직업</label>
              <input
                className="krds-input"
                value={data.occupation || ""}
                onChange={(e) => set("occupation", e.target.value)}
                disabled={submitted}
                placeholder="자영업, 회사원, 공무원 등"
              />
            </div>
            <div>
              <label className="krds-label">소속 (기관/단체)</label>
              <input
                className="krds-input"
                value={data.organization_name || ""}
                onChange={(e) => set("organization_name", e.target.value)}
                disabled={submitted}
                placeholder="○○협회, ○○회"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="krds-label">직위 / 직명</label>
              <input
                className="krds-input"
                value={data.recipient_position_title || ""}
                onChange={(e) => set("recipient_position_title", e.target.value)}
                disabled={submitted}
                placeholder="회장, 위원장, 사무국장"
              />
            </div>
            <div>
              <label className="krds-label">대외직명 (선택)</label>
              <input
                className="krds-input"
                value={data.external_title || ""}
                onChange={(e) => set("external_title", e.target.value)}
                disabled={submitted}
                placeholder="외부에 알려진 다른 직책"
              />
            </div>
          </div>

          {savedAt && !submitted && (
            <p className="text-xs text-success-600">
              ✓ {savedAt.toLocaleTimeString()} 자동 저장됨
            </p>
          )}
        </section>

        {/* 하단 버튼 */}
        {!submitted && (
          <div className="krds-card krds-card-pad flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sticky bottom-2">
            <button
              type="button"
              className="krds-btn krds-btn-md krds-btn-secondary"
              onClick={onSave}
              disabled={saving || submitting}
            >
              {saving ? "저장 중..." : "💾 저장"}
            </button>
            <button
              type="button"
              className="krds-btn krds-btn-md krds-btn-primary"
              onClick={onSubmit}
              disabled={saving || submitting}
            >
              {submitting ? "제출 중..." : "📤 최종 제출"}
            </button>
          </div>
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-ink-500">
        © 2026 경기도의회 공적조서 자동작성 시스템 · 문의: 사무처
      </footer>
    </div>
  );
}
