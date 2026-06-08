import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { submitApplication } from "../api";
import { listLegislators, type Legislator } from "../api/settings";
import type {
  ApplicationRecipient,
  ApplicationSubmit,
} from "../api/applications";
import { MERIT_CATEGORIES } from "../data/meritCategories";
import { CHECKLIST_ITEMS } from "../data/checklistItems";
import Field, { Button, Input, TextArea } from "../components/Field";
import DateInput from "../components/DateInput";
import SignaturePad from "../components/SignaturePad";
import AwardSheetPreview from "../components/AwardSheetPreview";
import PublicLayout from "../components/PublicLayout";

// 신청 폼 임시저장 키 (브라우저 localStorage)
const DRAFT_KEY = "apply_draft_v1";

// 오늘 날짜(YYYY-MM-DD, 로컬 기준) — 희망 표창일 최소값
function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

type Status = "ok" | "issue";

interface CareerRow {
  record_date: string;
  description: string;
}

interface PreviousAwardRow {
  award_date: string;
  description: string;
}

export interface RecipientFormData {
  recipient_name: string;
  chinese_name: string;
  birth_date: string;
  gender: string;
  address: string;
  region: string;
  occupation: string;
  organization_name: string;
  recipient_position_title: string;
  rank_grade: string;
  external_title: string;
  merit_category: string;
  merit_period: string;
  // "기타" 분야 자유 입력 표창 문구 (미리보기에만 표시, 백엔드 전송 안 함)
  custom_example: string;
  // checklist
  cl_status: Record<string, Status | "">;
  cl_note: Record<string, string>;
  cl_confirm_name: string;
  cl_confirm_birth: string;
  // merit content
  merit_short_summary: string;
  recommendation_reason: string;
  merit_overview_1: string;
  merit_overview_2: string;
  merit_overview_3: string;
  merit_overview_4: string;
  full_merit_text: string;
  // 주요 경력 / 표창수여 현황
  careers: CareerRow[];
  previous_awards: PreviousAwardRow[];
  // 개인정보 동의(필수) — 작성 전 체크 (수집·이용 / 제3자 제공·활용)
  consent_collect: boolean;
  consent_provide: boolean;
  // 표창 취소·회수 동의(필수, 조례 제17조) + 자필 서명(PNG data URL)
  consent_revocation: boolean;
  signature: string;
}

export function emptyRecipient(): RecipientFormData {
  return {
    recipient_name: "",
    chinese_name: "",
    birth_date: "",
    gender: "",
    address: "",
    region: "",
    occupation: "",
    organization_name: "",
    recipient_position_title: "",
    rank_grade: "",
    external_title: "",
    merit_category: "",
    merit_period: "",
    custom_example: "",
    cl_status: {},
    cl_note: {},
    cl_confirm_name: "",
    cl_confirm_birth: "",
    merit_short_summary: "",
    recommendation_reason: "",
    merit_overview_1: "",
    merit_overview_2: "",
    merit_overview_3: "",
    merit_overview_4: "",
    full_merit_text: "",
    careers: [{ record_date: "", description: "" }],
    previous_awards: [{ award_date: "", description: "" }],
    consent_collect: false,
    consent_provide: false,
    consent_revocation: false,
    signature: "",
  };
}

export function isMeritPeriodAtLeast2Years(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  const y = v.match(/(\d+)\s*년/);
  const m = v.match(/(\d+)\s*개?월/);
  const years = y ? parseInt(y[1], 10) : 0;
  const months = m ? parseInt(m[1], 10) : 0;
  if (!y && !m) return false;
  return years * 12 + months >= 24;
}

// 단일 대상자 유효성 검증 (신청 폼 모달·공유 URL 자가추가 공용)
export function validateRecipient(r: RecipientFormData): string | null {
  const missing: string[] = [];
  if (!r.organization_name.trim()) missing.push("단체명");
  if (!r.recipient_name.trim()) missing.push("성명");
  if (!r.birth_date) missing.push("생년월일");
  if (!r.gender) missing.push("성별");
  if (!r.address.trim()) missing.push("주소");
  if (!r.merit_category) missing.push("공적분야");
  if (!r.merit_period.trim()) missing.push("공적기간");
  if (!r.recommendation_reason.trim()) missing.push("추천사유");
  if (!r.merit_short_summary.trim()) missing.push("공적요지");
  if (!r.full_merit_text.trim()) missing.push("공적사항 본문");
  if (missing.length) return `필수 항목 누락: ${missing.join(", ")}`;
  if (!isMeritPeriodAtLeast2Years(r.merit_period))
    return "공적기간은 2년 이상이어야 합니다.";
  const unanswered = CHECKLIST_ITEMS.filter(it => !r.cl_status[it.key]);
  if (unanswered.length)
    return `체크리스트 미응답: ${unanswered.map(it => it.label).join(", ")}`;
  if (!r.cl_confirm_name.trim() || !r.cl_confirm_birth)
    return "체크리스트 본인 확인(성명·생년월일)이 비어 있습니다.";
  if (r.cl_confirm_name.trim() !== r.recipient_name.trim())
    return "체크리스트 본인 확인 이름이 기본정보의 성명과 일치하지 않습니다.";
  if (r.cl_confirm_birth !== r.birth_date)
    return "체크리스트 본인 확인 생년월일이 기본정보와 일치하지 않습니다.";
  if (!r.consent_collect || !r.consent_provide)
    return "개인정보 수집·이용 및 제3자 제공·활용 동의(필수)에 모두 체크해 주세요.";
  if (!r.consent_revocation)
    return "허위 작성 시 표창 취소·회수 동의(필수, 조례 제17조)에 체크해 주세요.";
  if (!r.signature)
    return "본인 자필 서명을 입력해 주세요.";
  return null;
}

// RecipientFormData → 서버 제출 페이로드(ApplicationRecipient) 변환 (공용)
export function toApplicationRecipient(r: RecipientFormData): ApplicationRecipient {
  return {
    recipient_name: r.recipient_name.trim(),
    chinese_name: r.chinese_name.trim() || undefined,
    birth_date: r.birth_date,
    gender: r.gender || undefined,
    address: r.address.trim() || undefined,
    region: r.region.trim() || undefined,
    occupation: r.occupation.trim() || undefined,
    organization_name: r.organization_name.trim(),
    recipient_position_title: r.recipient_position_title.trim() || undefined,
    rank_grade: r.rank_grade.trim() || undefined,
    external_title: r.external_title.trim() || undefined,
    merit_category: r.merit_category,
    merit_period: r.merit_period.trim(),
    checklist: {
      item_service_period: r.cl_status.service_period!,
      item_service_period_note: r.cl_note.service_period,
      item_prior_award: r.cl_status.prior_award!,
      item_prior_award_note: r.cl_note.prior_award,
      item_discipline: r.cl_status.discipline!,
      item_discipline_note: r.cl_note.discipline,
      item_investigation: r.cl_status.investigation!,
      item_investigation_note: r.cl_note.investigation,
      item_criminal: r.cl_status.criminal!,
      item_criminal_note: r.cl_note.criminal,
      item_arrears: r.cl_status.arrears!,
      item_arrears_note: r.cl_note.arrears,
      item_misconduct: r.cl_status.misconduct!,
      item_misconduct_note: r.cl_note.misconduct,
      item_award_revoked: r.cl_status.award_revoked!,
      item_award_revoked_note: r.cl_note.award_revoked,
      self_confirm_name: r.cl_confirm_name.trim(),
      self_confirm_birth: r.cl_confirm_birth,
    },
    merit_content: {
      merit_short_summary: r.merit_short_summary.trim() || undefined,
      recommendation_reason: r.recommendation_reason.trim() || undefined,
      merit_overview_1: r.merit_overview_1.trim() || undefined,
      merit_overview_2: r.merit_overview_2.trim() || undefined,
      merit_overview_3: r.merit_overview_3.trim() || undefined,
      merit_overview_4: r.merit_overview_4.trim() || undefined,
      full_merit_text: r.full_merit_text.trim() || undefined,
    },
    careers: (r.careers || [])
      .map(c => ({
        record_date: c.record_date.trim(),
        description: c.description.trim(),
      }))
      .filter(c => c.record_date || c.description),
    previous_awards: (r.previous_awards || [])
      .map(p => ({
        award_date: p.award_date.trim(),
        description: p.description.trim(),
      }))
      .filter(p => p.award_date || p.description),
    consent: !!(r.consent_collect && r.consent_provide),
    revocation_consent: !!r.consent_revocation,
    signature: r.signature || undefined,
  };
}

export default function ApplicationFormPage() {
  const navigate = useNavigate();
  const [applicantRole, setApplicantRole] = useState<"individual" | "organization">("individual");
  const [applicantName, setApplicantName] = useState("");
  const [applicantOrg, setApplicantOrg] = useState("");
  const [applicantContact, setApplicantContact] = useState("");
  const [applicantDeliveryAddress, setApplicantDeliveryAddress] = useState("");
  const [recommenderName, setRecommenderName] = useState("");
  const [awardDate, setAwardDate] = useState("");
  const [recipients, setRecipients] = useState<RecipientFormData[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 모달 상태: null=닫힘, -1=새 추가, 0+=기존 인덱스 편집
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingDraft, setEditingDraft] = useState<RecipientFormData | null>(null);
  // 모달 위저드 마지막 단계 도달 여부 — '완료'는 그때만 활성화
  const [modalAtLast, setModalAtLast] = useState(false);

  // 추천의원 목록 (드롭다운 선택용)
  const [legislators, setLegislators] = useState<Legislator[]>([]);
  // 임시저장 복원 알림
  const [draftRestored, setDraftRestored] = useState(false);
  // 임시저장 버튼 피드백 ("저장됨" 잠깐 표시)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  // 모달 임시저장 피드백
  const [modalSavedAt, setModalSavedAt] = useState<string | null>(null);

  // 의원 목록 로드
  useEffect(() => {
    listLegislators()
      .then(setLegislators)
      .catch(() => setLegislators([]));
  }, []);

  // 임시저장 복원 (최초 1회) — 작성 중 닫았다가 다시 와도 이어서 작성
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.applicantRole) setApplicantRole(d.applicantRole);
      if (d.applicantName) setApplicantName(d.applicantName);
      if (d.applicantOrg) setApplicantOrg(d.applicantOrg);
      if (d.applicantContact) setApplicantContact(d.applicantContact);
      if (d.applicantDeliveryAddress)
        setApplicantDeliveryAddress(d.applicantDeliveryAddress);
      if (d.recommenderName) setRecommenderName(d.recommenderName);
      if (d.awardDate) setAwardDate(d.awardDate);
      if (Array.isArray(d.recipients)) setRecipients(d.recipients);
      if (
        d.applicantName ||
        d.recommenderName ||
        (Array.isArray(d.recipients) && d.recipients.length)
      )
        setDraftRestored(true);
    } catch {
      /* 손상된 임시저장은 무시 */
    }
  }, []);

  // 임시저장 자동 저장 (입력이 바뀔 때마다)
  useEffect(() => {
    if (submitted) return; // 제출 완료 후엔 저장 안 함
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          applicantRole,
          applicantName,
          applicantOrg,
          applicantContact,
          applicantDeliveryAddress,
          recommenderName,
          awardDate,
          recipients,
        })
      );
    } catch {
      /* 용량 초과 등은 무시 */
    }
  }, [
    applicantRole,
    applicantName,
    applicantOrg,
    applicantContact,
    applicantDeliveryAddress,
    recommenderName,
    awardDate,
    recipients,
    submitted,
  ]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* noop */
    }
  };

  // 임시저장 버튼 — 자동저장이 이미 동작하지만, 사용자가 직접 눌러 저장을 확정·확인.
  const saveDraftNow = () => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          applicantRole,
          applicantName,
          applicantOrg,
          applicantContact,
          applicantDeliveryAddress,
          recommenderName,
          awardDate,
          recipients,
        })
      );
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      setDraftSavedAt(`${hh}:${mm}`);
      setDraftRestored(false); // 복원 배너 닫기(이미 사용자가 인지)
    } catch {
      alert("임시저장에 실패했습니다. 브라우저 저장공간이 가득 찼을 수 있습니다.");
    }
  };

  const openAddModal = () => {
    setEditingIndex(-1);
    setEditingDraft(emptyRecipient());
    setModalSavedAt(null);
  };

  const openEditModal = (idx: number) => {
    setEditingIndex(idx);
    setEditingDraft({ ...recipients[idx] });
    setModalSavedAt(null);
  };

  const closeModal = () => {
    setEditingIndex(null);
    setEditingDraft(null);
    setModalSavedAt(null);
  };

  const saveModal = () => {
    if (editingDraft === null) return;
    if (editingIndex === -1) {
      setRecipients(prev => [...prev, editingDraft]);
    } else if (editingIndex !== null) {
      setRecipients(prev =>
        prev.map((r, i) => (i === editingIndex ? editingDraft : r))
      );
    }
    closeModal();
  };

  // 모달 임시저장 — 검증 없이 현재 작성 중인 대상자를 목록(+localStorage)에 반영하고
  // 모달은 닫지 않는다. 작성이 길어 중간에 닫혔다 와도 이어서 쓸 수 있게.
  const saveModalDraft = () => {
    if (editingDraft === null) return;
    let nextRecipients: RecipientFormData[];
    if (editingIndex === -1) {
      // 새 추가 중이면 목록 끝에 넣고, 이후부터는 그 항목을 편집하는 모드로 전환
      nextRecipients = [...recipients, editingDraft];
      setRecipients(nextRecipients);
      setEditingIndex(nextRecipients.length - 1);
    } else if (editingIndex !== null) {
      nextRecipients = recipients.map((r, i) =>
        i === editingIndex ? editingDraft : r
      );
      setRecipients(nextRecipients);
    } else {
      return;
    }
    // recipients 변경은 비동기 반영되므로, 즉시 localStorage에 직접 저장
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          applicantRole,
          applicantName,
          applicantOrg,
          applicantContact,
          applicantDeliveryAddress,
          recommenderName,
          awardDate,
          recipients: nextRecipients,
        })
      );
      const now = new Date();
      setModalSavedAt(
        `${String(now.getHours()).padStart(2, "0")}:${String(
          now.getMinutes()
        ).padStart(2, "0")}`
      );
    } catch {
      alert("임시저장에 실패했습니다.");
    }
  };

  const removeRecipient = (idx: number) => {
    if (!confirm("이 대상자를 목록에서 삭제할까요?")) return;
    setRecipients(prev => prev.filter((_, i) => i !== idx));
  };


  const validate = (): string | null => {
    if (!applicantName.trim()) return "신청자 이름을 입력해 주세요.";
    if (applicantRole === "organization" && !applicantOrg.trim())
      return "기관 신청은 단체명이 필요합니다.";
    // 기관 신청자는 연락처 필수
    if (applicantRole === "organization" && !applicantContact.trim())
      return "기관 신청자는 연락처(이메일 또는 전화번호)가 필요합니다.";
    // 희망 등기수령 주소는 개인·기관 공통 필수
    if (!applicantDeliveryAddress.trim())
      return "희망 등기수령 주소를 입력해 주세요.";
    if (!recommenderName.trim())
      return "추천의원 성명을 입력해 주세요.";
    if (!awardDate)
      return "희망 표창일을 입력해 주세요.";
    if (awardDate < todayIso())
      return "희망 표창일은 오늘 이후의 날짜여야 합니다.";
    // 개인 신청은 본인 1명 이상 필수. 기관 신청자는 0명도 허용(공유 URL로 대상자가 직접 추가).
    if (applicantRole === "individual" && recipients.length === 0)
      return "추천대상자를 1명 이상 추가해 주세요.";
    for (let i = 0; i < recipients.length; i++) {
      const err = validateRecipient(recipients[i]);
      if (err) return `대상자 ${i + 1} — ${err}`;
    }
    return null;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const err = validate();
    if (err) {
      setSubmitError(err);
      return;
    }

    const payload: ApplicationSubmit = {
      applicant_role: applicantRole,
      applicant_name: applicantName.trim(),
      applicant_organization: applicantOrg.trim() || undefined,
      applicant_contact: applicantContact.trim() || undefined,
      applicant_delivery_address: applicantDeliveryAddress.trim() || undefined,
      recommender_name: recommenderName.trim(),
      award_date: awardDate || undefined,
      recipients: recipients.map(toApplicationRecipient),
    };

    setSubmitting(true);
    try {
      const res = await submitApplication(payload);
      clearDraft(); // 제출 완료 → 임시저장 삭제
      // 기관 신청: 제출 직후 검토·제출 화면으로 바로 진입(관리 비밀번호는 관리자가 이후 설정)
      if (payload.applicant_role === "organization" && res.manage_token) {
        navigate(`/apply/manage/${res.manage_token}`);
        return;
      }
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.detail ||
          err?.message ||
          "신청 제출에 실패했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <PublicLayout>
        <div className="max-w-2xl mx-auto">
          <div className="krds-card krds-card-pad border-success-500/40 bg-success-50 text-center py-10">
            <div className="text-3xl mb-3">✅</div>
            <h1 className="text-xl font-bold text-success-600 mb-2">
              신청이 접수되었습니다
            </h1>
            <p className="text-sm text-ink-700 leading-relaxed">
              제출하신 내용은 경기도의회 보건복지위원회 전문위원실에서 검토 후
              표창 추천 절차에 반영됩니다. 추가 확인이 필요한 경우 신청자
              연락처로 연락드릴 수 있습니다.
            </p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto">
        <div className="krds-page-header">
          <div>
            <h1 className="krds-page-title">
              경기도의회 의장 표창 추천 신청
            </h1>
            <p className="krds-page-sub leading-relaxed">
              본 양식은 추천대상자(또는 기관 신청자)가 직접 작성합니다. 입력하신
              정보는 전문위원실에서 검토 후 공적심사에 제출됩니다.{" "}
              <strong className="text-danger-600">
                허위 입력 시 표창이 취소될 수 있습니다.
              </strong>
            </p>
          </div>
        </div>

      <form onSubmit={onSubmit} className="space-y-5 sm:space-y-6">
        {draftRestored && (
          <div className="krds-card krds-card-pad bg-amber-50 border-amber-300 flex items-center justify-between gap-3">
            <p className="text-sm text-amber-800">
              💾 이전에 작성하던 내용을 불러왔습니다. 이어서 작성하세요.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!confirm("작성 중이던 임시저장 내용을 모두 지우고 새로 시작할까요?"))
                  return;
                clearDraft();
                setApplicantRole("individual");
                setApplicantName("");
                setApplicantOrg("");
                setApplicantContact("");
                setApplicantDeliveryAddress("");
                setRecommenderName("");
                setAwardDate("");
                setRecipients([]);
                setDraftRestored(false);
              }}
            >
              새로 작성
            </Button>
          </div>
        )}
        {/* 신청자 정보 */}
        <section className="krds-card krds-card-pad space-y-4">
          <h2 className="krds-section-title">1. 신청자 정보</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <label
              className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${
                applicantRole === "individual"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-ink-300"
              }`}
            >
              <input
                type="radio"
                checked={applicantRole === "individual"}
                onChange={() => setApplicantRole("individual")}
              />
              <span className="text-sm">개인 신청 (본인이 직접)</span>
            </label>
            <label
              className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${
                applicantRole === "organization"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-ink-300"
              }`}
            >
              <input
                type="radio"
                checked={applicantRole === "organization"}
                onChange={() => setApplicantRole("organization")}
              />
              <span className="text-sm">
                기관 신청자 (단체에서 여러 명 추천)
              </span>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="신청자 이름" required>
              <Input
                value={applicantName}
                onChange={e => setApplicantName(e.target.value)}
              />
            </Field>
            {applicantRole === "organization" && (
              <Field label="기관·단체명" required>
                <Input
                  value={applicantOrg}
                  onChange={e => setApplicantOrg(e.target.value)}
                />
              </Field>
            )}
            <Field
              label="연락처"
              required={applicantRole === "organization"}
              hint="이메일 또는 전화번호"
            >
              <Input
                value={applicantContact}
                onChange={e => setApplicantContact(e.target.value)}
              />
            </Field>
            <Field label="희망 표창일" required hint="숫자만 입력하면 자동 정렬됩니다. 신청일 이후의 날짜여야 합니다.">
              <DateInput
                value={awardDate}
                onChange={setAwardDate}
                placeholder="예: 2026.07.25"
                minDate={todayIso()}
                minHint="희망 표창일은 오늘 이후의 날짜여야 합니다."
              />
            </Field>
          </div>
          <Field
            label="희망 등기수령 주소"
            required
            hint="표창장·관련 서류를 받으실 주소"
          >
            <Input
              value={applicantDeliveryAddress}
              onChange={e => setApplicantDeliveryAddress(e.target.value)}
              placeholder="예: 경기도 수원시 영통구 도청로 32"
            />
          </Field>

        </section>

        {/* 추천의원 정보 */}
        <section className="krds-card krds-card-pad space-y-4">
          <h2 className="krds-section-title">2. 추천의원 정보</h2>
          <p className="text-xs text-ink-600">
            추천을 받기로 한 의원을 목록에서 선택해 주세요.
          </p>
          <Field label="추천의원" required>
            {legislators.length > 0 ? (
              <select
                className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 hover:border-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                value={recommenderName}
                onChange={e => setRecommenderName(e.target.value)}
              >
                <option value="">— 의원을 선택하세요 —</option>
                {legislators.map(l => (
                  <option key={l.id} value={l.name}>
                    {l.name}
                    {l.party ? ` (${l.party})` : ""}
                    {l.is_chair ? " · 위원장" : ""}
                  </option>
                ))}
              </select>
            ) : (
              // 목록을 못 불러온 경우 자유 입력으로 폴백 (서비스 중단 방지)
              <Input
                value={recommenderName}
                onChange={e => setRecommenderName(e.target.value)}
                placeholder="예: 이선구"
              />
            )}
          </Field>
        </section>

        {/* 대상자 — 개인 신청은 직접 입력, 기관 신청자는 공유 링크로 대상자가 각자 추가 */}
        {applicantRole === "individual" ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink-900">
              3. 추천대상자 ({recipients.length}명)
            </h2>
            <Button
              type="button"
              onClick={openAddModal}
              size="sm"
            >
              ＋ 대상자 추가
            </Button>
          </div>
          {recipients.length === 0 ? (
            <div className="krds-card krds-card-pad text-center py-10 text-ink-500">
              아직 추가된 대상자가 없습니다.
              <br />
              <span className="text-sm">
                위 [＋ 대상자 추가] 버튼을 눌러 시작하세요.
              </span>
            </div>
          ) : (
            <ul className="space-y-2">
              {recipients.map((r, idx) => (
                <li
                  key={idx}
                  className="krds-card krds-card-pad flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="krds-badge krds-badge-ink shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-ink-900">
                        {r.recipient_name || "(이름 미입력)"}
                      </span>
                      {r.merit_category && (
                        <span className="krds-badge krds-badge-brand">
                          {r.merit_category}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-600">
                      {[r.organization_name, r.recipient_position_title]
                        .filter(Boolean)
                        .join(" · ") || "(소속/직위 미입력)"}
                      {r.merit_period && ` · 공적기간 ${r.merit_period}`}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditModal(idx)}
                    >
                      편집
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => removeRecipient(idx)}
                    >
                      삭제
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        ) : (
          <section className="krds-card krds-card-pad">
            <h2 className="text-base font-bold text-ink-900 mb-1">
              3. 추천대상자
            </h2>
            <p className="text-sm text-ink-700 leading-relaxed">
              기관 신청자는 대상자 정보를 직접 입력하지 않습니다. 아래{" "}
              <strong>[공유 링크 발급]</strong>을 누르면 추천대상자용 링크가
              생성됩니다. 그 링크를 각 추천대상자에게 보내면, 대상자가 본인 정보를
              직접 입력해 이 신청 명단에 추가됩니다.
            </p>
          </section>
        )}

        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/40 bg-danger-50 px-3 py-2 text-sm text-danger-700"
          >
            {submitError}
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end">
          {draftSavedAt && (
            <span className="text-sm text-success-600 sm:mr-1 order-last sm:order-none text-center">
              ✓ {draftSavedAt}에 임시저장됨
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
          <Button type="submit" disabled={submitting} size="lg">
            {submitting
              ? "처리 중..."
              : applicantRole === "organization"
              ? "공유 링크 발급"
              : "신청 제출"}
          </Button>
        </div>
        <p className="text-xs text-ink-500 text-center sm:text-right">
          작성 중인 내용은 자동으로 저장되며, 창을 닫았다 다시 열어도 이어서 작성할 수 있습니다.
        </p>
      </form>

      {/* 대상자 입력 모달 */}
      {editingIndex !== null && editingDraft !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="min-h-screen flex items-start justify-center p-4 sm:p-6">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl">
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-ink-100 bg-white rounded-t-xl">
                <h2 className="text-base font-bold text-ink-900">
                  {editingIndex === -1
                    ? "새 추천대상자"
                    : `대상자 #${editingIndex + 1} 편집`}
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={closeModal}
                >
                  ✕
                </Button>
              </div>
              <div className="px-5 sm:px-6 py-5">
                <RecipientCard
                  data={editingDraft}
                  onChange={patch =>
                    setEditingDraft(d => (d ? { ...d, ...patch } : d))
                  }
                  onStepChange={s => setModalAtLast(s.isLast)}
                />
              </div>
              <div className="sticky bottom-0 z-10 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 px-5 sm:px-6 py-4 border-t border-ink-100 bg-white rounded-b-xl">
                {modalSavedAt && (
                  <span className="text-sm text-success-600 sm:mr-auto text-center">
                    ✓ {modalSavedAt}에 임시저장됨
                  </span>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeModal}
                  className="sm:w-auto w-full"
                >
                  닫기
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={saveModalDraft}
                  className="sm:w-auto w-full"
                >
                  임시저장
                </Button>
                <Button
                  type="button"
                  disabled={!modalAtLast}
                  title={
                    modalAtLast
                      ? ""
                      : "마지막 단계(부적격 체크리스트)까지 입력하면 완료할 수 있습니다."
                  }
                  onClick={() => {
                    const err = validateRecipient(editingDraft);
                    if (err) {
                      alert(err);
                      return;
                    }
                    saveModal();
                  }}
                  className="sm:w-auto w-full"
                >
                  완료
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </PublicLayout>
  );
}

/** 개인정보 수집·이용/제공 동의 박스 — 홈페이지 가입식(전체동의 + 항목별 필수 체크). 작성 전 노출. */
function ConsentBox({
  data,
  onChange,
}: {
  data: RecipientFormData;
  onChange: (patch: Partial<RecipientFormData>) => void;
}) {
  const all = data.consent_collect && data.consent_provide;
  return (
    <div className="rounded-lg border-2 border-brand-300 bg-brand-50/60 p-3 space-y-2">
      <h4 className="text-sm font-bold text-ink-900">
        개인정보 수집·이용 및 제공 동의 <span className="text-danger-600">(필수)</span>
      </h4>
      <div className="max-h-32 overflow-y-auto rounded border border-ink-200 bg-white p-2 text-xs text-ink-600 leading-relaxed space-y-1">
        <p><strong>① 수집·이용</strong> — 경기도의회(보건복지전문위원실)가 의장 표창 추천 적격 심사·공적조서 작성·표창장 발급·발송·명단 관리를 위해 <strong>성명·생년월일·주소·연락처·소속·직위·공적사항</strong>을 수집·이용합니다. 주민등록번호 등 고유식별정보·민감정보는 수집하지 않습니다. 미선정 시 처리 종료 후 지체 없이 파기, 선정 시 보존연한 동안 보관.</p>
        <p><strong>② 제3자 제공·활용</strong> — 추천자료 보완·결과 안내·표창 전달을 위해 추천기관·신청기관에, 표창장 등기 발송을 위해 우정사업본부에 필요한 범위에서 제공합니다.</p>
        <p>동의를 거부할 권리가 있으나, 거부 시 표창 추천·심사·발급 절차가 제한됩니다. 대리 작성의 경우 대상자(또는 법정대리인)에게 위 내용을 고지하고 동의받았음을 확약합니다.</p>
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-brand-800 border-b border-ink-200 pb-2">
        <input
          type="checkbox"
          checked={all}
          onChange={e =>
            onChange({ consent_collect: e.target.checked, consent_provide: e.target.checked })
          }
        />
        전체 동의
      </label>
      <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-800">
        <input
          type="checkbox"
          checked={data.consent_collect}
          onChange={e => onChange({ consent_collect: e.target.checked })}
        />
        <span><span className="text-danger-600">[필수]</span> 개인정보 수집·이용 동의</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-800">
        <input
          type="checkbox"
          checked={data.consent_provide}
          onChange={e => onChange({ consent_provide: e.target.checked })}
        />
        <span><span className="text-danger-600">[필수]</span> 제3자 제공·활용 동의</span>
      </label>
      <div className="rounded border border-danger-200 bg-danger-50/60 p-2 text-xs text-ink-700 leading-relaxed">
        본인은 공적조서 등 제출 서류를 <strong>허위로 작성하거나 허위로 답변</strong>한 사실이 확인될 경우,
        수여된 표창이 <strong>취소되며 표창장(부상 포함)이 회수될 수 있음</strong>에 동의합니다.
        <span className="text-ink-500">(근거: 「경기도의회 표창 등에 관한 조례」 제17조 표창취소)</span>
      </div>
      <label className="flex items-start gap-2 cursor-pointer text-sm text-ink-800">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={data.consent_revocation}
          onChange={e => onChange({ consent_revocation: e.target.checked })}
        />
        <span><span className="text-danger-600">[필수]</span> 허위 작성·답변 시 표창 취소 및 회수에 동의합니다.</span>
      </label>
    </div>
  );
}

export function RecipientCard({
  data,
  onChange,
  onStepChange,
}: {
  data: RecipientFormData;
  onChange: (patch: Partial<RecipientFormData>) => void;
  // 현재 단계 변화를 부모에 알림(부모가 마지막 단계에서만 제출 버튼 활성화하도록)
  onStepChange?: (s: { step: number; isLast: boolean }) => void;
}) {
  // 다단계 위저드: 0 기본정보 → 1 공적사항 → 2 부적격 체크리스트. 상단에 진행 단계 표시.
  const STEPS = ["기본정보", "공적사항", "부적격 체크리스트"];
  const [step, setStep] = useState(0);
  const [stepMsg, setStepMsg] = useState<string | null>(null);
  const clAnswered = CHECKLIST_ITEMS.filter(it => data.cl_status[it.key]).length;
  const clTotal = CHECKLIST_ITEMS.length;

  // 단계별 유효성(다음 버튼). 미충족이면 해당 단계에 머무르고 안내.
  const stepError = (s: number): string | null => {
    if (s === 0) {
      if (!data.consent_collect || !data.consent_provide)
        return "개인정보 수집·이용 및 제3자 제공·활용 동의(필수)에 모두 체크해 주세요.";
      if (!data.consent_revocation)
        return "허위 작성 시 표창 취소·회수 동의(필수, 조례 제17조)에 체크해 주세요.";
      const m: string[] = [];
      if (!data.recipient_name.trim()) m.push("성명");
      if (!data.birth_date) m.push("생년월일");
      if (!data.gender) m.push("성별");
      if (!data.address.trim()) m.push("주소");
      if (!data.organization_name.trim()) m.push("단체명");
      if (!data.merit_category) m.push("공적분야");
      if (!data.merit_period.trim()) m.push("공적기간");
      if (m.length) return `필수 항목 누락: ${m.join(", ")}`;
      if (!isMeritPeriodAtLeast2Years(data.merit_period))
        return "공적기간은 2년 이상이어야 합니다.";
      return null;
    }
    if (s === 1) {
      const m: string[] = [];
      if (!data.recommendation_reason.trim()) m.push("추천사유");
      if (!data.merit_short_summary.trim()) m.push("공적요지");
      if (!data.full_merit_text.trim()) m.push("공적사항 본문");
      if (m.length) return `필수 항목 누락: ${m.join(", ")}`;
      return null;
    }
    return null;
  };
  const goNext = () => {
    const err = stepError(step);
    if (err) {
      setStepMsg(err);
      return;
    }
    setStepMsg(null);
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };
  const goPrev = () => {
    setStepMsg(null);
    setStep(s => Math.max(s - 1, 0));
  };

  // 부모(자가추가 페이지·모달)가 마지막 단계에서만 제출을 활성화하도록 단계 변화 통지
  useEffect(() => {
    onStepChange?.({ step, isLast: step === STEPS.length - 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const setCl = (key: string, status: Status) => {
    onChange({ cl_status: { ...data.cl_status, [key]: status } });
  };
  const setClNote = (key: string, text: string) => {
    onChange({ cl_note: { ...data.cl_note, [key]: text } });
  };

  // 기본정보 변경 시 체크리스트 본인 확인도 동일하게 자동 채움
  const onBaseChange = (patch: Partial<RecipientFormData>) => {
    const merged: Partial<RecipientFormData> = { ...patch };
    if (patch.recipient_name !== undefined)
      merged.cl_confirm_name = patch.recipient_name;
    if (patch.birth_date !== undefined)
      merged.cl_confirm_birth = patch.birth_date;
    onChange(merged);
  };

  return (
    <div className="space-y-5">
      {/* 진행 단계 — 큰 게이지바로 현재 위치/남은 단계 표시 */}
      <div className="space-y-2">
        <div className="flex items-end justify-between">
          <span className="text-base font-bold text-brand-700">
            단계 {step + 1} / {STEPS.length} · {STEPS[step]}
          </span>
          <span className="text-sm font-semibold text-ink-500">
            {Math.round(((step + 1) / STEPS.length) * 100)}%
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-ink-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={
                i === step
                  ? "font-bold text-brand-700"
                  : i < step
                  ? "font-semibold text-success-700"
                  : "text-ink-400"
              }
            >
              {i < step ? "✓ " : `${i + 1}. `}
              {label}
            </span>
          ))}
        </div>
      </div>

      {stepMsg && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/40 bg-danger-50 px-3 py-2 text-sm text-danger-700"
        >
          {stepMsg}
        </div>
      )}

      {/* STEP 1 — 기본정보 */}
      {step === 0 && (
      <div className="space-y-3">
        <ConsentBox data={data} onChange={onChange} />
        <h4 className="text-xs font-bold text-ink-600 uppercase tracking-wide">
          기본 정보
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="성명" required>
            <Input
              value={data.recipient_name}
              onChange={e => onBaseChange({ recipient_name: e.target.value })}
            />
          </Field>
          <Field label="한자">
            <Input
              value={data.chinese_name}
              onChange={e => onChange({ chinese_name: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="생년월일" required hint="숫자만 입력하면 자동 정렬됩니다. 예: 19900315 → 1990.03.15">
            <DateInput
              value={data.birth_date}
              onChange={v => onBaseChange({ birth_date: v })}
              placeholder="예: 1990.03.15"
            />
          </Field>
          <Field label="성별" required>
            <div className="flex gap-2">
              {["남", "여"].map(g => (
                <button
                  type="button"
                  key={g}
                  onClick={() => onChange({ gender: g })}
                  className={
                    "px-5 py-2 rounded-md border text-sm font-medium transition " +
                    (data.gender === g
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-ink-300 text-ink-600 hover:border-ink-400")
                  }
                >
                  {g}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <Field label="주소" required>
          <Input
            value={data.address}
            onChange={e => onChange({ address: e.target.value })}
            placeholder="예: 경기도 수원시 영통구 도청로 32"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="단체명" required hint="소속 단체가 없으면 '개인'이라고 적어 주세요.">
            <Input
              value={data.organization_name}
              onChange={e => onChange({ organization_name: e.target.value })}
              placeholder="소속이 없으면 '개인'"
            />
          </Field>
          <Field label="직업">
            <Input
              value={data.occupation}
              onChange={e => onChange({ occupation: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="직위/직명">
            <Input
              value={data.recipient_position_title}
              onChange={e =>
                onChange({ recipient_position_title: e.target.value })
              }
            />
          </Field>
          <Field label="직급" hint="공무원의 경우">
            <Input
              value={data.rank_grade}
              onChange={e => onChange({ rank_grade: e.target.value })}
            />
          </Field>
          <Field label="대외직명">
            <Input
              value={data.external_title}
              onChange={e => onChange({ external_title: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-3">
            <Field label="공적분야" required>
              <select
                value={data.merit_category}
                onChange={e => onChange({ merit_category: e.target.value })}
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
            <Field
              label="공적기간"
              required
              hint="2년 이상이어야 합니다. 예: 2년 6개월"
            >
              <Input
                value={data.merit_period}
                onChange={e => onChange({ merit_period: e.target.value })}
                placeholder="예: 2년 6개월"
              />
            </Field>
            {data.merit_category === "기타" && (
              <div>
                <span className="text-sm font-semibold text-ink-800">
                  표창 문구 (직접 입력)
                </span>
                <div className="mt-1.5">
                  <TextArea
                    rows={3}
                    placeholder="해당 분야의 표창 문구를 직접 입력하세요. 입력한 내용이 옆 표창장 미리보기에 반영됩니다."
                    value={data.custom_example}
                    onChange={e =>
                      onChange({ custom_example: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
          </div>
          <div>
            <span className="text-sm font-semibold text-ink-800">
              표창장 미리보기
            </span>
            <div className="mt-1.5">
              {!data.merit_category ? (
                <div className="rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-10 text-sm text-ink-400 text-center">
                  공적분야를 선택하면
                  <br />
                  표창장 미리보기가 표시됩니다.
                </div>
              ) : (
                <AwardSheetPreview
                  categoryValue={data.merit_category}
                  organizationName={data.organization_name}
                  recipientName={data.recipient_name}
                  customExample={data.custom_example}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* STEP 2 — 공적사항 + 경력 + 표창수여 */}
      {step === 1 && (
      <div className="space-y-5">
      {/* 공적사항 — 순서: 추천사유 → 공적요지 → 공적사항 본문 */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-ink-600 uppercase tracking-wide">
          공적 사항
        </h4>
        <Field label="추천사유" required>
          <TextArea
            rows={4}
            value={data.recommendation_reason}
            onChange={e => onChange({ recommendation_reason: e.target.value })}
            placeholder={"예시) 상기인은 매사 정직, 성실, 헌신하는 자로 어렵고 바쁜 중에도 마을의 어려운 이웃을 위해 봉사를 몸소 실천하며 봉사정신과 국가관이 강한 자로 그간의 맡은바 소임을 착실하게 수행하여 지역주민 화합에 기여한 공로를 인정하여 수상 후보자로 추천함."}
          />
        </Field>
        <Field label="공적요지 (50자 내외)" required>
          <TextArea
            rows={3}
            value={data.merit_short_summary}
            onChange={e => onChange({ merit_short_summary: e.target.value })}
            placeholder={"예시) 상기인은 현재 xxx협회에서 활동하면서 매사에 정직, 성실, 헌신하는 자로 온화한 성품으로 어렵고 바쁜 중에도 마을의 어려운 이웃을 위해 봉사를 몸소 실천하며 봉사정신과 국가관이 강한 자로 그간의 맡은바 소임을 착실하게 수행하여 지역주민 화합에 기여한 공로를 인정하여 수상 후보자로 추천함."}
          />
        </Field>
        <Field label="공적사항 본문" required>
          <TextArea
            rows={14}
            value={data.full_merit_text}
            onChange={e => onChange({ full_merit_text: e.target.value })}
            placeholder={
              "예시) 상기인은 xxx협회에서 활동하며 지역 체육 활성화와 더불어 따뜻한 공동체 형성을 위해 헌신적으로 봉사해 왔으며, 그 주요 공적은 다음과 같음.\n\n" +
              "1. 공적 행사 및 봉사활동에 솔선수범\n" +
              " 미양면에서 활동하며 각종 공적 행사에 빠짐없이 참여하고, 누구보다도 앞장서서 봉사에 임하였음. 매사에 적극적이고 책임감 있는 자세로 주민들과 함께하며 신뢰받는 지역 인물로 자리매김하였음.\n\n" +
              "2. 청렴결백하고 겸손한 자세 실천\n" +
              " 청렴결백한 품성과 예의 바른 언행으로 지역 사회에 귀감이 되고 있으며, 자신을 드러내기보다 뒤에서 묵묵히 맡은 바 소임을 다하는 자세로 주변의 존경을 받아왔음.\n\n" +
              "3. 어려운 이웃을 위한 선행 실천\n" +
              " 본인 또한 어려운 환경에 처해 있음에도 더 어려운 이웃을 돌아보고, 물심양면으로 지원하며 ‘당연한 일을 했을 뿐’이라 말하는 진정한 봉사의 정신을 보여주었음.\n\n" +
              "4. 지역사회 화합과 나눔 문화 확산 기여\n" +
              " 크고 작은 봉사와 선행을 통해 지역 주민들에게 나눔과 배려의 문화를 확산시켰으며, 따뜻한 사회를 만드는 모범적인 사례가 되고 있음.\n\n" +
              " 위와 같이 상기인은 성실과 봉사, 청렴과 책임감을 바탕으로 지역사회 발전과 이웃 사랑을 실천해 온 공로가 지대하므로, 표창 대상자로 추천함."
            }
          />
        </Field>
      </div>

      {/* 주요 경력 */}
      <div className="space-y-3 border-t border-ink-100 pt-4">
        <h4 className="text-xs font-bold text-ink-600 uppercase tracking-wide">
          주요 경력
        </h4>
        <p className="text-xs text-ink-500">
          주요 활동 경력을 시간 순으로 입력해 주세요. 비워두면 출력 양식에서
          제외됩니다.
        </p>
        <div className="space-y-2">
          {data.careers.map((c, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2"
            >
              <Input
                value={c.record_date}
                onChange={e => {
                  const next = [...data.careers];
                  next[idx] = { ...next[idx], record_date: e.target.value };
                  onChange({ careers: next });
                }}
                placeholder="예시) 2018.03 ~ 2020.02"
              />
              <Input
                value={c.description}
                onChange={e => {
                  const next = [...data.careers];
                  next[idx] = { ...next[idx], description: e.target.value };
                  onChange({ careers: next });
                }}
                placeholder="예시) OO협회 회장"
              />
              <button
                type="button"
                className="px-3 py-2 text-xs text-danger-600 hover:bg-danger-50 rounded"
                onClick={() => {
                  const next = data.careers.filter((_, i) => i !== idx);
                  onChange({
                    careers: next.length
                      ? next
                      : [{ record_date: "", description: "" }],
                  });
                }}
                aria-label={`경력 ${idx + 1}행 삭제`}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-brand-700 hover:text-brand-800"
          onClick={() =>
            onChange({
              careers: [
                ...data.careers,
                { record_date: "", description: "" },
              ],
            })
          }
        >
          + 경력 행 추가
        </button>
      </div>

      {/* 표창수여 현황 */}
      <div className="space-y-3 border-t border-ink-100 pt-4">
        <h4 className="text-xs font-bold text-ink-600 uppercase tracking-wide">
          표창수여 현황
        </h4>
        <p className="text-xs text-ink-500">
          과거 받은 표창·포상 내역을 입력해 주세요. 자가 체크리스트의 기포상
          답변과 일치해야 합니다.
        </p>
        <div className="space-y-2">
          {data.previous_awards.map((p, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2"
            >
              <Input
                value={p.award_date}
                onChange={e => {
                  const next = [...data.previous_awards];
                  next[idx] = { ...next[idx], award_date: e.target.value };
                  onChange({ previous_awards: next });
                }}
                placeholder="예시) 2022.05.15"
              />
              <Input
                value={p.description}
                onChange={e => {
                  const next = [...data.previous_awards];
                  next[idx] = { ...next[idx], description: e.target.value };
                  onChange({ previous_awards: next });
                }}
                placeholder="예시) OO장관 표창 (지역사회 공로)"
              />
              <button
                type="button"
                className="px-3 py-2 text-xs text-danger-600 hover:bg-danger-50 rounded"
                onClick={() => {
                  const next = data.previous_awards.filter(
                    (_, i) => i !== idx,
                  );
                  onChange({
                    previous_awards: next.length
                      ? next
                      : [{ award_date: "", description: "" }],
                  });
                }}
                aria-label={`표창 ${idx + 1}행 삭제`}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-brand-700 hover:text-brand-800"
          onClick={() =>
            onChange({
              previous_awards: [
                ...data.previous_awards,
                { award_date: "", description: "" },
              ],
            })
          }
        >
          + 표창 행 추가
        </button>
      </div>

      </div>
      )}

      {/* STEP 3 — 부적격 체크리스트 */}
      {step === 2 && (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-ink-600 uppercase tracking-wide">
            자가 부적격 체크리스트
          </h4>
          <span
            className={
              "rounded-full px-2 py-0.5 text-xs font-semibold " +
              (clAnswered === clTotal
                ? "bg-success-50 text-success-700"
                : "bg-amber-100 text-amber-700")
            }
          >
            {clAnswered === clTotal
              ? `✓ 모두 응답 (${clAnswered}/${clTotal})`
              : `응답 필요 (${clAnswered}/${clTotal})`}
          </span>
        </div>
        <p className="text-xs text-ink-500">
          본인의 사실관계를 정확히 응답해 주세요.
        </p>
        {CHECKLIST_ITEMS.map(item => {
          const cur = data.cl_status[item.key] || "";
          return (
            <div key={item.key} className="rounded-lg border border-ink-200 p-3">
              <div className="flex items-start gap-2 mb-2">
                <span className="krds-badge krds-badge-brand shrink-0">
                  {item.label}
                </span>
              </div>
              <p className="text-sm text-ink-800 mb-2 leading-relaxed">
                {item.question}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <label
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded border cursor-pointer text-sm ${
                    cur === "ok"
                      ? "border-success-500 bg-success-50 text-success-700"
                      : "border-ink-300"
                  }`}
                >
                  <input
                    type="radio"
                    checked={cur === "ok"}
                    onChange={() => setCl(item.key, "ok")}
                  />
                  {item.okLabel}
                </label>
                <label
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded border cursor-pointer text-sm ${
                    cur === "issue"
                      ? "border-danger-500 bg-danger-50 text-danger-700"
                      : "border-ink-300"
                  }`}
                >
                  <input
                    type="radio"
                    checked={cur === "issue"}
                    onChange={() => setCl(item.key, "issue")}
                  />
                  {item.issueLabel}
                </label>
              </div>
              {cur === "issue" && (
                <TextArea
                  rows={2}
                  placeholder="해당 내역을 자세히 적어주세요."
                  value={data.cl_note[item.key] || ""}
                  onChange={e => setClNote(item.key, e.target.value)}
                />
              )}
            </div>
          );
        })}
        <div className="rounded-lg border border-warn-500/40 bg-warn-50/40 p-3 space-y-2">
          <p className="text-xs font-bold text-ink-800">
            본인 확인 (기본 정보의 성명·생년월일과 일치해야 합니다)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              value={data.cl_confirm_name}
              onChange={e => onChange({ cl_confirm_name: e.target.value })}
              placeholder="성명"
            />
            <DateInput
              value={data.cl_confirm_birth}
              onChange={v => onChange({ cl_confirm_birth: v })}
              placeholder="생년월일 (숫자만)"
            />
          </div>
        </div>

        {/* 표창 취소·회수 확약(중복 노출) + 자필 서명 */}
        <div className="rounded-lg border-2 border-danger-300 bg-danger-50/50 p-3 space-y-2">
          <p className="text-xs font-bold text-danger-700">표창 취소·회수 확약 및 자필 서명 (필수)</p>
          <p className="text-xs text-ink-700 leading-relaxed">
            본인은 위 자가 부적격 체크리스트와 제출 공적조서의 내용이 사실임을 확인하며,
            <strong> 허위로 작성·답변한 사실이 확인될 경우 수여된 표창이 취소되고 표창장(부상 포함)이 회수될 수 있음</strong>에 동의합니다.
            <span className="text-ink-500"> (근거: 「경기도의회 표창 등에 관한 조례」 제17조 표창취소)</span>
          </p>
          <label className="flex items-start gap-2 cursor-pointer text-sm text-ink-800">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={data.consent_revocation}
              onChange={e => onChange({ consent_revocation: e.target.checked })}
            />
            <span><span className="text-danger-600">[필수]</span> 위 내용을 확인하였으며 표창 취소·회수에 동의합니다.</span>
          </label>
          <div>
            <p className="text-xs font-semibold text-ink-700 mb-1">
              대상자 자필 서명 <span className="text-danger-600">(필수)</span>
            </p>
            <SignaturePad
              value={data.signature}
              onChange={v => onChange({ signature: v })}
            />
          </div>
        </div>

      </div>
      )}

      {/* 단계 이동 */}
      <div className="flex justify-between gap-2 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={goPrev}
          disabled={step === 0}
        >
          ← 이전
        </Button>
        {step < STEPS.length - 1 && (
          <Button type="button" onClick={goNext}>
            다음 →
          </Button>
        )}
      </div>
    </div>
  );
}
