import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChecklistSubmit,
  getRecipient,
  submitChecklist,
} from "../api";
import type { Recipient } from "../types";
import { CHECKLIST_ITEMS } from "../data/checklistItems";
import { Button, Input, TextArea } from "../components/Field";

type Status = "ok" | "issue";

export default function ChecklistPage() {
  const { recipientId = "" } = useParams();
  const navigate = useNavigate();
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, Status | "">>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [confirmName, setConfirmName] = useState("");
  const [confirmBirth, setConfirmBirth] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    getRecipient(recipientId)
      .then(r => {
        setRecipient(r);
        // 시스템 내부 흐름이라 등록된 정보를 미리 채워둠
        setConfirmName(r.recipient_name || "");
        setConfirmBirth(r.birth_date || "");
      })
      .catch(e => {
        setLoadError(
          e?.response?.data?.detail ||
            "대상자 정보를 불러오지 못했습니다."
        );
      });
  }, [recipientId]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // 모든 항목 선택 검증
    const missing = CHECKLIST_ITEMS.filter(it => !statuses[it.key]).map(
      it => it.label
    );
    if (missing.length > 0) {
      setSubmitError(`다음 항목에 응답해 주세요: ${missing.join(", ")}`);
      return;
    }
    if (!confirmName.trim() || !confirmBirth.trim()) {
      setSubmitError("본인 확인을 위해 이름과 생년월일을 입력해 주세요.");
      return;
    }

    const payload: ChecklistSubmit = {
      item_service_period: statuses.service_period!,
      item_service_period_note: notes.service_period,
      item_prior_award: statuses.prior_award!,
      item_prior_award_note: notes.prior_award,
      item_discipline: statuses.discipline!,
      item_discipline_note: notes.discipline,
      item_investigation: statuses.investigation!,
      item_investigation_note: notes.investigation,
      item_criminal: statuses.criminal!,
      item_criminal_note: notes.criminal,
      item_arrears: statuses.arrears!,
      item_arrears_note: notes.arrears,
      item_misconduct: statuses.misconduct!,
      item_misconduct_note: notes.misconduct,
      item_award_revoked: statuses.award_revoked!,
      item_award_revoked_note: notes.award_revoked,
      self_confirm_name: confirmName.trim(),
      self_confirm_birth: confirmBirth.trim(),
    };

    setSubmitting(true);
    try {
      await submitChecklist(recipientId, payload);
      navigate(`/recipients/${recipientId}/merit`);
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.detail ||
          err?.message ||
          "제출에 실패했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-lg border border-danger-500/40 bg-danger-50 px-4 py-6 text-center text-danger-700">
          {loadError}
        </div>
      </div>
    );
  }

  if (!recipient) {
    return <div className="text-ink-500">불러오는 중...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="krds-page-header">
        <div>
          <h1 className="krds-page-title">
            {recipient.recipient_name} · 부적격 체크리스트
          </h1>
          <p className="krds-page-sub">
            추천대상자 본인이 작성하는 자가 체크리스트입니다. 8개 항목에 모두
            응답해 주세요. <strong className="text-danger-600">허위 응답 시 표창이 취소될 수 있습니다.</strong>
          </p>
        </div>
      </div>

      <div className="krds-card krds-card-pad mb-5 bg-brand-50/40 border-brand-500/20">
        <div className="text-sm text-ink-700 space-y-1">
          <div>
            <span className="text-ink-500">대상자:</span>{" "}
            <strong>{recipient.recipient_name}</strong>
          </div>
          {recipient.organization_name && (
            <div>
              <span className="text-ink-500">소속:</span>{" "}
              {recipient.organization_name}
            </div>
          )}
          {recipient.merit_category && (
            <div>
              <span className="text-ink-500">공적분야:</span>{" "}
              {recipient.merit_category}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 sm:space-y-5">
        {CHECKLIST_ITEMS.map(item => {
          const cur = statuses[item.key] || "";
          return (
            <div key={item.key} className="krds-card krds-card-pad">
              <div className="flex items-start gap-2 mb-3">
                <span className="krds-badge krds-badge-brand shrink-0">
                  {item.label}
                </span>
              </div>
              <p className="text-sm text-ink-800 mb-3 leading-relaxed">
                {item.question}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <label
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                    cur === "ok"
                      ? "border-success-500 bg-success-50 text-success-700"
                      : "border-ink-300 hover:border-ink-400"
                  }`}
                >
                  <input
                    type="radio"
                    name={`status_${item.key}`}
                    checked={cur === "ok"}
                    onChange={() =>
                      setStatuses({ ...statuses, [item.key]: "ok" })
                    }
                  />
                  <span className="text-sm">{item.okLabel}</span>
                </label>
                <label
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                    cur === "issue"
                      ? "border-danger-500 bg-danger-50 text-danger-700"
                      : "border-ink-300 hover:border-ink-400"
                  }`}
                >
                  <input
                    type="radio"
                    name={`status_${item.key}`}
                    checked={cur === "issue"}
                    onChange={() =>
                      setStatuses({ ...statuses, [item.key]: "issue" })
                    }
                  />
                  <span className="text-sm">{item.issueLabel}</span>
                </label>
              </div>
              {cur === "issue" && (
                <TextArea
                  rows={2}
                  placeholder="해당 내역을 자세히 적어주세요. (사유, 기간, 처분 내용 등)"
                  value={notes[item.key] || ""}
                  onChange={e =>
                    setNotes({ ...notes, [item.key]: e.target.value })
                  }
                />
              )}
            </div>
          );
        })}

        <div className="krds-card krds-card-pad bg-warn-50/40 border-warn-500/20">
          <h2 className="text-sm font-bold text-ink-800 mb-3">본인 확인</h2>
          <p className="text-xs text-ink-600 mb-3">
            본인 명의로 응답하는지 확인합니다. 등록된 정보와 일치해야 제출이
            완료됩니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-semibold text-ink-800">
                성명 <span className="text-danger-500">*</span>
              </span>
              <Input
                className="mt-1.5"
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                placeholder="등록된 이름과 동일하게"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-ink-800">
                생년월일 <span className="text-danger-500">*</span>
              </span>
              <Input
                className="mt-1.5"
                type="date"
                value={confirmBirth}
                onChange={e => setConfirmBirth(e.target.value)}
              />
            </label>
          </div>
        </div>

        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/40 bg-danger-50 px-3 py-2 text-sm text-danger-700"
          >
            {submitError}
          </div>
        )}

        <div className="pt-2">
          <Button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto"
            size="lg"
          >
            {submitting ? "제출 중..." : "체크리스트 제출"}
          </Button>
        </div>
      </form>
    </div>
  );
}
