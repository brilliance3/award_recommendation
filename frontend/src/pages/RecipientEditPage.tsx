import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createRecipient,
  extractFromUrl,
  getChecklistPublicInfo,
  getRecipient,
  updateRecipient,
} from "../api";
import type { Recipient, URLExtractResponse } from "../types";
import Field, { Button, Input } from "../components/Field";
import { MERIT_CATEGORIES } from "../data/meritCategories";

const empty: Partial<Recipient> = {
  recipient_name: "",
  chinese_name: "",
  birth_date: "",
  gender: "",
  address: "",
  region: "",
  occupation: "",
  organization_name: "",
  recipient_position_title: "",
  external_title: "",
  rank_grade: "",
  merit_category: "",
  merit_period: "",
  recommendation_rank: "1순위",
};

function isMeritPeriodAtLeast2Years(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  const yearMatch = v.match(/(\d+)\s*년/);
  const monthMatch = v.match(/(\d+)\s*개?월/);
  const years = yearMatch ? parseInt(yearMatch[1], 10) : 0;
  const months = monthMatch ? parseInt(monthMatch[1], 10) : 0;
  if (!yearMatch && !monthMatch) return false;
  return years * 12 + months >= 24;
}

export default function RecipientEditPage() {
  const { caseId, recipientId } = useParams();
  const navigate = useNavigate();
  const isCreate = !recipientId;

  const [form, setForm] = useState<Partial<Recipient>>(empty);
  const [url, setUrl] = useState("");
  const [checklistSubmitted, setChecklistSubmitted] = useState<boolean | null>(
    null
  );
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<URLExtractResponse | null>(
    null
  );
  const [extractError, setExtractError] = useState<string | null>(null);

  useEffect(() => {
    if (recipientId) getRecipient(recipientId).then(setForm);
  }, [recipientId]);

  useEffect(() => {
    if (!recipientId) return;
    getChecklistPublicInfo(recipientId)
      .then(d => setChecklistSubmitted(d.already_submitted))
      .catch(() => setChecklistSubmitted(null));
  }, [recipientId]);


  const setField =
    (k: keyof Recipient) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.organization_name?.trim()) missing.push("단체명");
    if (!form.recipient_name?.trim()) missing.push("성명");
    if (!form.birth_date) missing.push("생년월일");
    if (!form.merit_category?.trim()) missing.push("공적분야");
    if (!form.merit_period?.trim()) missing.push("공적기간");
    if (missing.length > 0) {
      alert(`필수 항목이 비어 있습니다: ${missing.join(", ")}`);
      return;
    }
    if (!isMeritPeriodAtLeast2Years(form.merit_period || "")) {
      alert(
        "공적기간은 2년 이상이어야 합니다.\n예: '2년', '2년 3개월', '3년 0개월'"
      );
      return;
    }
    const payload = {
      ...form,
      birth_date: form.birth_date || undefined,
      recommendation_rank: "1순위",
    };
    if (isCreate) {
      const r = await createRecipient(caseId!, payload);
      navigate(`/recipients/${r.id}/checklist`);
    } else {
      await updateRecipient(recipientId!, payload);
      navigate(`/recipients/${recipientId}/checklist`);
    }
  };

  const onExtract = async () => {
    if (!url) return;
    setExtracting(true);
    setExtractResult(null);
    setExtractError(null);
    try {
      const res = await extractFromUrl(url);
      setExtractResult(res);
      // 실패면 폼에 덮어쓰지 않음
      if (res.status === "ok") {
        setForm(prev => ({
          ...prev,
          recipient_name: res.recipient_name || prev.recipient_name,
          organization_name: res.organization_name || prev.organization_name,
          recipient_position_title:
            res.position || prev.recipient_position_title,
        }));
      }
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.statusText ||
        err?.message ||
        "알 수 없는 오류";
      const status = err?.response?.status
        ? `[HTTP ${err.response.status}] `
        : "";
      setExtractError(`${status}${detail}`);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="krds-page-header">
        <div>
          <h1 className="krds-page-title">
            {isCreate
              ? "대상자 추가"
              : `${form.recipient_name || "대상자"} 기본정보 수정`}
          </h1>
          <p className="krds-page-sub">
            추천 대상자의 인적사항·소속·직위 등을 입력합니다.
          </p>
        </div>
      </div>

      {isCreate && (
        <div className="krds-card krds-card-pad mb-5 sm:mb-6 bg-warn-50/60 border-warn-500/30">
          <div className="text-sm font-bold text-ink-900 mb-2 flex items-center gap-1.5">
            <span aria-hidden>🔍</span> URL에서 정보 추출 (선택)
          </div>
          <p className="text-xs text-ink-600 mb-3">
            지자체·협회 홈페이지 등의 URL을 넣으면 성명·소속·직위·활동 키워드를
            추정해 자동으로 채워 줍니다. 추출 결과는 반드시 사람이 검토해야
            합니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              inputMode="url"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={extracting}
              onClick={onExtract}
              className="sm:w-auto w-full"
            >
              {extracting ? "추출 중..." : "정보 추출"}
            </Button>
          </div>

          {/* 네트워크/서버 예외 */}
          {extractError && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-danger-500/40 bg-danger-50 px-3 py-2 text-sm text-danger-700"
            >
              <strong className="font-semibold">요청 실패:</strong> {extractError}
            </div>
          )}

          {/* 추출 결과 */}
          {extractResult &&
            (extractResult.status === "ok" ? (
              <div className="mt-3 rounded-lg border border-success-500/40 bg-success-50 px-3 py-2 text-sm">
                <div className="font-semibold text-success-600 mb-1">
                  ✓ 추출 완료 — 폼에 자동 적용했습니다. 검토 후 수정해 주세요.
                </div>
                <dl className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs text-ink-800">
                  {extractResult.page_title && (
                    <>
                      <dt className="text-ink-500">페이지 제목</dt>
                      <dd className="col-span-2 truncate">
                        {extractResult.page_title}
                      </dd>
                    </>
                  )}
                  <dt className="text-ink-500">성명</dt>
                  <dd className="col-span-2">
                    {extractResult.recipient_name || (
                      <span className="text-ink-400">(미추출)</span>
                    )}
                  </dd>
                  <dt className="text-ink-500">소속</dt>
                  <dd className="col-span-2">
                    {extractResult.organization_name || (
                      <span className="text-ink-400">(미추출)</span>
                    )}
                  </dd>
                  <dt className="text-ink-500">직위</dt>
                  <dd className="col-span-2">
                    {extractResult.position || (
                      <span className="text-ink-400">(미추출)</span>
                    )}
                  </dd>
                  {extractResult.merit_keywords?.length > 0 && (
                    <>
                      <dt className="text-ink-500">키워드</dt>
                      <dd className="col-span-2 flex flex-wrap gap-1">
                        {extractResult.merit_keywords.map(k => (
                          <span
                            key={k}
                            className="krds-badge krds-badge-accent"
                          >
                            {k}
                          </span>
                        ))}
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            ) : (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-warn-500/40 bg-warn-50 px-3 py-2 text-sm text-ink-700"
              >
                <div className="font-semibold text-warn-600 mb-1">
                  ⚠ 자동 추출 실패
                </div>
                <div className="text-xs leading-relaxed">
                  {extractResult.status_message ||
                    "추출된 정보가 없습니다. 수동으로 입력해 주세요."}
                </div>
                {extractResult.page_title && (
                  <div className="mt-1 text-xs text-ink-500 truncate">
                    페이지 제목: {extractResult.page_title}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="krds-card krds-card-pad space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field label="성명" required>
            <Input
              value={form.recipient_name || ""}
              onChange={setField("recipient_name")}
            />
          </Field>
          <Field label="한자">
            <Input
              value={form.chinese_name || ""}
              onChange={setField("chinese_name")}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field label="생년월일" required>
            <Input
              type="date"
              value={form.birth_date || ""}
              onChange={setField("birth_date")}
            />
          </Field>
          <Field label="성별">
            <select
              value={form.gender || ""}
              onChange={e => setForm({ ...form, gender: e.target.value })}
              className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 hover:border-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="">— 선택 —</option>
              <option value="남">남</option>
              <option value="여">여</option>
            </select>
          </Field>
        </div>
        <Field label="주소">
          <Input value={form.address || ""} onChange={setField("address")} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Field label="지역">
            <Input value={form.region || ""} onChange={setField("region")} />
          </Field>
          <Field label="직업">
            <Input
              value={form.occupation || ""}
              onChange={setField("occupation")}
            />
          </Field>
          <Field label="단체명" required>
            <Input
              value={form.organization_name || ""}
              onChange={setField("organization_name")}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Field label="직위/직명">
            <Input
              value={form.recipient_position_title || ""}
              onChange={setField("recipient_position_title")}
            />
          </Field>
          <Field label="직급" hint="공무원의 경우 (예: 지방서기관)">
            <Input
              value={form.rank_grade || ""}
              onChange={setField("rank_grade")}
            />
          </Field>
          <Field label="대외직명">
            <Input
              value={form.external_title || ""}
              onChange={setField("external_title")}
            />
          </Field>
        </div>
        <Field label="공적분야" required>
          <select
            value={form.merit_category || ""}
            onChange={e =>
              setForm({ ...form, merit_category: e.target.value })
            }
            className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 hover:border-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          >
            <option value="">— 선택 —</option>
            {MERIT_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="공적기간" required hint="2년 이상이어야 합니다. 예: 2년, 3년 6개월">
          <Input
            value={form.merit_period || ""}
            onChange={setField("merit_period")}
            placeholder="예: 2년 6개월"
          />
        </Field>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-ink-100">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
            className="sm:w-auto w-full"
          >
            취소
          </Button>
          <Button type="submit" className="sm:w-auto w-full">
            {isCreate ? "저장하고 체크리스트" : "저장하고 체크리스트로"}
          </Button>
        </div>
      </form>

      {!isCreate && recipientId && checklistSubmitted !== null && (
        <div className="mt-4 flex items-center gap-2 text-xs text-ink-600">
          <span>부적격 체크리스트:</span>
          {checklistSubmitted ? (
            <span className="krds-badge krds-badge-brand">작성 완료</span>
          ) : (
            <span className="krds-badge krds-badge-ink">미작성</span>
          )}
        </div>
      )}
    </div>
  );
}
