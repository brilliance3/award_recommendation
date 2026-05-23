import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { councilApi, createCase } from "../api";
import Field, { Button, Input } from "../components/Field";
import CouncilMemberPicker from "../components/CouncilMemberPicker";
import type { CouncilMember } from "../types";

export default function AwardCaseCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    award_grade: "경기도의회 의장 표창",
    recommender_department: "",
    recommender_position: "의원",
    recommender_name: "",
    recommender_full_title: "경기도의회 의원",
    recommendation_date: "",
    award_date: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CouncilMember | null>(
    null
  );

  const setField =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const onPickMember = async (m: CouncilMember) => {
    setSelectedMember(m);
    setPickerOpen(false);
    try {
      const recommender = await councilApi.recommenderForMember(m.id);
      setForm((prev) => ({
        ...prev,
        recommender_name: recommender.recommender_name,
        recommender_full_title: recommender.recommender_full_title,
        recommender_department:
          recommender.recommender_department || prev.recommender_department,
        recommender_position:
          recommender.recommender_position || prev.recommender_position,
      }));
    } catch (e) {
      console.warn("recommender autofill failed", e);
    }
  };

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
        <Field label="훈격" required>
          <Input value={form.award_grade} onChange={setField("award_grade")} />
        </Field>

        {/* 의원 빠른 선택 */}
        <div className="border border-blue-200 rounded p-3 bg-blue-50/40">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-blue-900">
              경기도의회 의원 빠른 선택
            </span>
            <button
              type="button"
              onClick={() => setPickerOpen(!pickerOpen)}
              className="text-sm text-blue-700 underline"
            >
              {pickerOpen ? "닫기" : "의원 찾기"}
            </button>
          </div>
          {selectedMember && (
            <div className="text-sm text-ink-700 mb-2">
              ✅ <strong>{selectedMember.name}</strong> 의원 ·{" "}
              {selectedMember.party} · {selectedMember.district}
              {selectedMember.committee_name &&
                ` · ${selectedMember.committee_name}`}
            </div>
          )}
          {pickerOpen && (
            <CouncilMemberPicker
              onSelect={onPickMember}
              placeholder="이름 또는 지역구 검색"
            />
          )}
          {!pickerOpen && !selectedMember && (
            <p className="text-xs text-ink-500">
              위 "의원 찾기"를 눌러 의원을 선택하면 추천자 정보가 자동
              채워집니다.
            </p>
          )}
        </div>

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
          hint="예: 경기도의회 의원 / 보건복지위원회"
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
