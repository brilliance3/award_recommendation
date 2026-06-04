import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getShareCaseInfo,
  addRecipientByToken,
  type ShareCaseInfo,
} from "../api/applications";
import {
  RecipientCard,
  emptyRecipient,
  validateRecipient,
  toApplicationRecipient,
  type RecipientFormData,
} from "./ApplicationFormPage";
import { Button } from "../components/Field";
import PublicLayout from "../components/PublicLayout";

/** 기관 신청자가 발급한 공유 링크(/apply/add/:token) — 피추천자 본인이 자기 정보를 1명 추가.
 *  - 마지막 단계(부적격 체크리스트)에서만 제출 활성화
 *  - 토큰별 임시저장(localStorage)으로 작성 중 내용 보존·복원 */
export default function AddRecipientPage() {
  const { token = "" } = useParams();
  const DRAFT_KEY = `apply_add_draft_${token}`;

  const [info, setInfo] = useState<ShareCaseInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 임시저장 복원: 첫 렌더 전에 localStorage에서 1회 읽음
  const [draft, setDraft] = useState<RecipientFormData>(() => {
    try {
      const raw = token ? localStorage.getItem(`apply_add_draft_${token}`) : null;
      if (raw) return JSON.parse(raw);
    } catch {
      /* 무시 */
    }
    return emptyRecipient();
  });
  const [atLast, setAtLast] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    getShareCaseInfo(token)
      .then(setInfo)
      .catch(err =>
        setLoadError(
          err?.response?.data?.detail ||
            "유효하지 않거나 만료된 링크입니다. 신청 기관에 문의해 주세요."
        )
      );
  }, [token]);

  // 자동 임시저장 (첫 렌더는 건너뜀 — 복원값 그대로 보존)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (done) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
    } catch {
      /* 무시 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const saveDraftNow = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
    } catch {
      /* 무시 */
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = validateRecipient(draft);
    if (err) {
      setError(err);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSubmitting(true);
    try {
      await addRecipientByToken(token, toApplicationRecipient(draft));
      try {
        localStorage.removeItem(DRAFT_KEY); // 제출 완료 → 임시저장 삭제
      } catch {
        /* 무시 */
      }
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e2: any) {
      setError(
        e2?.response?.data?.detail ||
          e2?.message ||
          "추가에 실패했습니다. 잠시 후 다시 시도해 주세요."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
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
              링크를 열 수 없습니다
            </h1>
            <p className="text-sm text-ink-700">{loadError}</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (done) {
    return (
      <PublicLayout>
        <div className="max-w-2xl mx-auto">
          <div className="krds-card krds-card-pad border-success-500/40 bg-success-50 text-center py-10">
            <div className="text-3xl mb-3">✅</div>
            <h1 className="text-xl font-bold text-success-600 mb-2">
              제출되었습니다
            </h1>
            <p className="text-sm text-ink-700 leading-relaxed">
              입력하신 정보가 신청 명단에 추가되었습니다. 전문위원실 검토 후 표창
              추천 절차에 반영됩니다.
            </p>
            <p className="text-sm text-ink-700 leading-relaxed mt-3">
              문의사항이 있으시면 신청하신 기관
              {info?.organization ? `(${info.organization})` : ""}의 신청자에게
              문의해 주세요.
            </p>
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
      <div className="max-w-4xl mx-auto">
        <div className="krds-page-header">
          <div>
            <h1 className="krds-page-title">표창 추천 대상자 정보 입력</h1>
            <p className="krds-page-sub leading-relaxed">
              <strong>{info.organization || "기관"}</strong>의 표창 추천 신청에
              본인 정보를 추가합니다. (추천의원 {info.recommender_name || "-"} ·{" "}
              {info.award_grade || "-"}
              {info.award_date ? ` · 희망 표창일 ${info.award_date}` : ""})
              <br />
              <strong className="text-danger-600">
                허위 입력 시 표창이 취소될 수 있습니다.
              </strong>
            </p>
          </div>
        </div>

        {error && (
          <div className="krds-card krds-card-pad bg-danger-50 border-danger-300 mb-4">
            <p className="text-sm text-danger-700">{error}</p>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-5 sm:space-y-6">
          <RecipientCard
            data={draft}
            onChange={patch => setDraft(prev => ({ ...prev, ...patch }))}
            onStepChange={s => setAtLast(s.isLast)}
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            {savedAt && (
              <span className="text-sm text-success-600 sm:mr-1 text-center">
                ✓ {savedAt}에 임시저장됨
              </span>
            )}
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={saveDraftNow}
              disabled={submitting}
            >
              임시저장
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={submitting || !atLast}
              title={
                atLast ? "" : "마지막 단계(부적격 체크리스트)까지 입력하면 제출할 수 있습니다."
              }
            >
              {submitting ? "제출 중..." : "제출"}
            </Button>
          </div>
          {!atLast && (
            <p className="text-xs text-ink-500 text-right">
              마지막 단계(부적격 체크리스트)까지 입력하면 제출할 수 있습니다.
            </p>
          )}
        </form>
      </div>
    </PublicLayout>
  );
}
