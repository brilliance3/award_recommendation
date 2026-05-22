import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCase } from "../api";
import Field, { Button, Input } from "../components/Field";

export default function AwardCaseCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    award_grade: "경기도의회 의장 표창",
    recommender_department: "보건복지위원회",
    recommender_position: "의원",
    recommender_name: "",
    recommender_full_title: "경기도의회 보건복지위원회 의원",
    recommendation_date: "",
    award_date: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const setField = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
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
      const status = err?.response?.status ? `[HTTP ${err.response.status}] ` : "";
      alert(
        `표창 건 생성에 실패했습니다.\n${status}${detail}\n\n` +
        `백엔드 서버(http://localhost:8000)가 실행 중인지 확인해 주세요.\n` +
        `자세한 내용은 브라우저 개발자도구(Console / Network) 참조.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">새 표창 건</h1>
      <form onSubmit={onSubmit} className="bg-white shadow rounded p-6 space-y-4">
        <Field label="표창 건명" required>
          <Input value={form.title} onChange={setField("title")} placeholder="예: 2025년 의장 표창 추천" />
        </Field>
        <Field label="훈격" required>
          <Input value={form.award_grade} onChange={setField("award_grade")} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="추천기관 부서">
            <Input value={form.recommender_department} onChange={setField("recommender_department")} />
          </Field>
          <Field label="추천자 직위">
            <Input value={form.recommender_position} onChange={setField("recommender_position")} />
          </Field>
          <Field label="추천자 성명">
            <Input value={form.recommender_name} onChange={setField("recommender_name")} />
          </Field>
        </div>
        <Field label="추천관 전체 명칭" hint="예: 경기도의회 보건복지위원회 의원">
          <Input value={form.recommender_full_title} onChange={setField("recommender_full_title")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="추천일">
            <Input type="date" value={form.recommendation_date} onChange={setField("recommendation_date")} />
          </Field>
          <Field label="표창일">
            <Input type="date" value={form.award_date} onChange={setField("award_date")} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>취소</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "저장 중..." : "표창 건 생성"}</Button>
        </div>
      </form>
    </div>
  );
}
