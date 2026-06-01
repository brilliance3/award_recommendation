import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCase } from "../api";
import Field, { Button, Input } from "../components/Field";

export default function AwardCaseCreatePage() {
  const navigate = useNavigate();
  const AWARD_GRADE_FIXED = "경기도의회 의장 표창";
  const [form, setForm] = useState({
    title: "",
    award_grade: AWARD_GRADE_FIXED,
    recommender_department: "보건복지위원회",
    recommender_position: "의원",
    recommender_name: "",
    recommender_full_title: "경기도의회 보건복지위원회 의원",
    recommendation_date: "",
    award_date: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const setField = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.award_grade) {
      alert("표창 건명과 훈격은 필수입니다.");
      return;
    }
    setSubmitting(true);
    try {
      const c = await createCase({
        ...form,
        recommendation_date: form.recommendation_date || undefined,
        award_date: form.award_date || undefined,
      });
      navigate(`/cases/${c.id}`);
    } catch (err: any) {
      console.error("[표창 건 생성 실패]", err);
      const detail =
        err?.response?.data?.detail ||
        err?.response?.statusText ||
        err?.message ||
        "알 수 없는 오류";
      const status = err?.response?.status
        ? `[HTTP ${err.response.status}] `
        : "";
      alert(
        `표창 건 생성에 실패했습니다.\n${status}${detail}\n\n` +
          `백엔드 서버 연결 상태를 확인해 주세요.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="krds-page-header">
        <div>
          <h1 className="krds-page-title">새 표창 건</h1>
          <p className="krds-page-sub">
            표창 건의 기본 정보를 입력하고 대상자 등록 단계로 이동합니다.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="krds-card krds-card-pad space-y-5">
        <Field label="표창 건명" required>
          <Input
            value={form.title}
            onChange={setField("title")}
            placeholder="예: 2025년 의장 표창 추천"
          />
        </Field>
        <Field label="추천훈격" required hint="의장 표창으로 고정">
          <Input value={form.award_grade} readOnly disabled />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Field label="추천기관 부서">
            <Input
              value={form.recommender_department}
              onChange={setField("recommender_department")}
            />
          </Field>
          <Field label="추천자 직위">
            <Input
              value={form.recommender_position}
              onChange={setField("recommender_position")}
            />
          </Field>
          <Field label="추천자 성명">
            <Input
              value={form.recommender_name}
              onChange={setField("recommender_name")}
            />
          </Field>
        </div>

        <Field
          label="추천관 전체 명칭"
          hint="예: 경기도의회 보건복지위원회 의원"
        >
          <Input
            value={form.recommender_full_title}
            onChange={setField("recommender_full_title")}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field label="추천일">
            <Input
              type="date"
              value={form.recommendation_date}
              onChange={setField("recommendation_date")}
            />
          </Field>
          <Field label="표창일">
            <Input
              type="date"
              value={form.award_date}
              onChange={setField("award_date")}
            />
          </Field>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-ink-100">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
            className="sm:w-auto w-full"
          >
            취소
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="sm:w-auto w-full"
          >
            {submitting ? "저장 중..." : "표창 건 생성"}
          </Button>
        </div>
      </form>
    </div>
  );
}
