import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createRecipient,
  extractFromUrl,
  getRecipient,
  updateRecipient,
} from "../api";
import type { Recipient } from "../types";
import Field, { Button, Input } from "../components/Field";

const empty: Partial<Recipient> = {
  recipient_name: "",
  chinese_name: "",
  birth_date: "",
  birth_yymmdd: "",
  address: "",
  region: "",
  occupation: "",
  organization_name: "",
  recipient_position_title: "",
  external_title: "",
  merit_category: "",
  merit_period: "",
  recommendation_rank: "1순위",
};

export default function RecipientEditPage() {
  const { caseId, recipientId } = useParams();
  const navigate = useNavigate();
  const isCreate = !recipientId;

  const [form, setForm] = useState<Partial<Recipient>>(empty);
  const [url, setUrl] = useState("");
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    if (recipientId) getRecipient(recipientId).then(setForm);
  }, [recipientId]);

  const setField = (k: keyof Recipient) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.recipient_name) { alert("성명은 필수입니다."); return; }
    const payload = {
      ...form,
      birth_date: form.birth_date || undefined,
    };
    if (isCreate) {
      const r = await createRecipient(caseId!, payload);
      navigate(`/recipients/${r.id}/merit`);
    } else {
      await updateRecipient(recipientId!, payload);
      alert("저장되었습니다.");
    }
  };

  const onExtract = async () => {
    if (!url) return;
    setExtracting(true);
    try {
      const res = await extractFromUrl(url);
      setForm(prev => ({
        ...prev,
        recipient_name: res.recipient_name || prev.recipient_name,
        organization_name: res.organization_name || prev.organization_name,
        recipient_position_title: res.position || prev.recipient_position_title,
      }));
      alert(`추출 완료. 키워드: ${res.merit_keywords.join(", ") || "(없음)"}`);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {isCreate ? "대상자 추가" : `${form.recipient_name || "대상자"} 기본정보 수정`}
      </h1>

      {isCreate && (
        <div className="bg-amber-50 border border-amber-200 rounded p-4 mb-6">
          <div className="text-sm font-semibold mb-2">URL에서 정보 추출 (선택)</div>
          <div className="flex gap-2">
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
            <Button type="button" variant="secondary" disabled={extracting} onClick={onExtract}>
              {extracting ? "추출 중..." : "정보 추출"}
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="bg-white shadow rounded p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="성명" required>
            <Input value={form.recipient_name || ""} onChange={setField("recipient_name")} />
          </Field>
          <Field label="한자">
            <Input value={form.chinese_name || ""} onChange={setField("chinese_name")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="생년월일">
            <Input type="date" value={form.birth_date || ""} onChange={setField("birth_date")} />
          </Field>
          <Field label="생년월일(6자리)" hint="예: 810209">
            <Input value={form.birth_yymmdd || ""} maxLength={6} onChange={setField("birth_yymmdd")} />
          </Field>
        </div>
        <Field label="주소">
          <Input value={form.address || ""} onChange={setField("address")} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="지역"><Input value={form.region || ""} onChange={setField("region")} /></Field>
          <Field label="직업"><Input value={form.occupation || ""} onChange={setField("occupation")} /></Field>
          <Field label="소속(기관/단체)"><Input value={form.organization_name || ""} onChange={setField("organization_name")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="직위/직명"><Input value={form.recipient_position_title || ""} onChange={setField("recipient_position_title")} /></Field>
          <Field label="대외직명"><Input value={form.external_title || ""} onChange={setField("external_title")} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="공적분야"><Input value={form.merit_category || ""} onChange={setField("merit_category")} /></Field>
          <Field label="공적기간" hint="예: 8년, 0년0개월"><Input value={form.merit_period || ""} onChange={setField("merit_period")} /></Field>
          <Field label="추천순위"><Input value={form.recommendation_rank || "1순위"} onChange={setField("recommendation_rank")} /></Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>취소</Button>
          <Button type="submit">{isCreate ? "추가하고 공적입력" : "저장"}</Button>
        </div>
      </form>
    </div>
  );
}
