import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRecipient, submitAdminReview } from "../api";
import type { AdminReviewSubmit } from "../api/checklist";
import type { RecipientDetail } from "../types";
import { CHECKLIST_ITEMS } from "../data/checklistItems";
import Field, { Button, Input, TextArea } from "../components/Field";

type LawStatus = "lawful" | "violation" | "";

const ELECTION_LAW_ITEMS = [
  {
    key: "general",
    label: "공직선거법 검토 여부",
  },
  {
    key: "basis",
    label: "사업 및 표창수여 법적근거 확인 여부",
  },
  {
    key: "art112",
    label: "공직선거법 제112조 위반여부 확인 여부",
  },
] as const;

export default function AdminReviewPage() {
  const { recipientId = "" } = useParams();
  const navigate = useNavigate();
  const [r, setR] = useState<RecipientDetail | null>(null);
  const [statuses, setStatuses] = useState<Record<string, LawStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reviewerName, setReviewerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [doneModal, setDoneModal] = useState(false);

  useEffect(() => {
    getRecipient(recipientId).then(d => {
      setR(d);
      const cl = d.checklist;
      if (cl) {
        setStatuses({
          general: (cl.admin_election_law_general as LawStatus) || "",
          basis: (cl.admin_election_law_basis as LawStatus) || "",
          art112: (cl.admin_election_law_art112 as LawStatus) || "",
        });
        setNotes({
          general: cl.admin_election_law_general_note || "",
          basis: cl.admin_election_law_basis_note || "",
          art112: cl.admin_election_law_art112_note || "",
        });
        setReviewerName(cl.admin_reviewer_name || "");
      }
    });
  }, [recipientId]);

  if (!r) return <div className="text-ink-500">불러오는 중...</div>;

  // 자가 체크리스트가 없는 대상자(수동/XLSX 추가)도 담당자가 공직선거법 검토를
  // 진행할 수 있다. (검토 저장 시 서버가 체크리스트를 생성해 결과를 붙인다.)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const missing = ELECTION_LAW_ITEMS.filter(it => !statuses[it.key]).map(
      it => it.label
    );
    if (missing.length) {
      alert(`다음 항목을 검토해 주세요:\n- ${missing.join("\n- ")}`);
      return;
    }
    if (!reviewerName.trim()) {
      alert("검토자 이름을 입력해 주세요.");
      return;
    }

    const payload: AdminReviewSubmit = {
      admin_election_law_general: statuses.general,
      admin_election_law_general_note: notes.general || undefined,
      admin_election_law_basis: statuses.basis,
      admin_election_law_basis_note: notes.basis || undefined,
      admin_election_law_art112: statuses.art112,
      admin_election_law_art112_note: notes.art112 || undefined,
      admin_reviewer_name: reviewerName.trim(),
    };

    setSubmitting(true);
    try {
      await submitAdminReview(recipientId, payload);
      setDoneModal(true);
    } catch (err: any) {
      alert(
        "검토 제출에 실패했습니다.\n" +
          (err?.response?.data?.detail || err?.message || "")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cl = r.checklist;

  return (
    <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6">
      <div className="krds-page-header">
        <div>
          <h1 className="krds-page-title">
            {r.recipient_name} · 관리자 검토 (공직선거법)
          </h1>
          <p className="krds-page-sub">
            {r.organization_name || "-"} · {r.merit_category || "-"} · 본인 자가
            체크리스트 제출일{" "}
            {cl?.submitted_at
              ? new Date(cl.submitted_at).toLocaleString("ko-KR")
              : "미제출"}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          ← 돌아가기
        </Button>
      </div>

      {/* 자가 체크리스트 결과 (읽기 전용) — 없으면 미제출 안내 */}
      <section className="krds-card krds-card-pad">
        <h2 className="krds-section-title mb-3">
          1. 추천대상자 자가 체크리스트 결과
        </h2>
        {!cl || !cl.submitted_at ? (
          <p className="text-sm text-ink-500">
            자가 체크리스트가 제출되지 않은 대상자입니다(수동·일괄 추가 등). 아래
            공직선거법 검토만 진행하셔도 됩니다.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {CHECKLIST_ITEMS.map(item => {
              const status = (cl as any)[`item_${item.key}`] as string;
              const note = (cl as any)[`item_${item.key}_note`] as string;
              const isOk = status === "ok";
              return (
                <li key={item.key} className="py-2.5 flex items-start gap-3">
                  <span className="krds-badge krds-badge-ink shrink-0 mt-0.5">
                    {item.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`text-sm font-semibold ${
                        isOk ? "text-success-700" : "text-danger-600"
                      }`}
                    >
                      {isOk ? "해당 없음" : "해당 있음"}
                    </span>
                    {note && (
                      <p className="text-xs text-ink-600 mt-1 leading-relaxed">
                        {note}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 공직선거법 검토 입력 */}
      <form onSubmit={onSubmit} className="space-y-4 sm:space-y-5">
        <section className="krds-card krds-card-pad space-y-4">
          <h2 className="krds-section-title">
            2. 공직선거법 검토 (관리자 입력)
          </h2>
          <p className="text-xs text-ink-600">
            민간인·기관·단체 표창 시 작성. 검토 결과는 서식8 체크리스트 HWPX에
            반영됩니다.
          </p>
          {ELECTION_LAW_ITEMS.map(item => {
            const cur = statuses[item.key] || "";
            return (
              <div key={item.key} className="rounded-lg border border-ink-200 p-3">
                <div className="text-sm font-semibold text-ink-800 mb-2">
                  {item.label}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <label
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded border cursor-pointer text-sm ${
                      cur === "lawful"
                        ? "border-success-500 bg-success-50 text-success-700"
                        : "border-ink-300"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={cur === "lawful"}
                      onChange={() =>
                        setStatuses({ ...statuses, [item.key]: "lawful" })
                      }
                    />
                    적법
                  </label>
                  <label
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded border cursor-pointer text-sm ${
                      cur === "violation"
                        ? "border-danger-500 bg-danger-50 text-danger-700"
                        : "border-ink-300"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={cur === "violation"}
                      onChange={() =>
                        setStatuses({ ...statuses, [item.key]: "violation" })
                      }
                    />
                    위반
                  </label>
                </div>
                <TextArea
                  rows={2}
                  placeholder="검토 사유·근거 등 (선택)"
                  value={notes[item.key] || ""}
                  onChange={e =>
                    setNotes({ ...notes, [item.key]: e.target.value })
                  }
                />
              </div>
            );
          })}
          <Field label="검토자 이름" required>
            <Input
              value={reviewerName}
              onChange={e => setReviewerName(e.target.value)}
              placeholder="전문위원실 검토자 성명"
            />
          </Field>
          {cl?.admin_reviewed_at && (
            <p className="text-xs text-ink-500">
              최근 검토일:{" "}
              {new Date(cl.admin_reviewed_at).toLocaleString("ko-KR")} ·{" "}
              {cl.admin_reviewer_name || "-"}
            </p>
          )}
        </section>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={submitting} size="lg">
            {submitting ? "저장 중..." : "검토 결과 저장"}
          </Button>
        </div>
      </form>

      {/* 저장 완료 모달 */}
      {doneModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 sm:p-7">
            <div className="text-center">
              <div className="mx-auto mb-3 inline-flex items-center justify-center w-12 h-12 rounded-full bg-success-50 text-success-600 text-2xl">
                ✓
              </div>
              <h3 className="text-lg font-bold text-ink-900 mb-2">
                공직선거법 검토 결과가 저장되었습니다
              </h3>
              <p className="text-sm text-ink-700 leading-relaxed">
                서식8 체크리스트 HWPX 다운로드 시 검토 결과가 자동으로
                반영됩니다.
              </p>
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                onClick={() => {
                  setDoneModal(false);
                  navigate(-1);
                }}
              >
                확인
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
