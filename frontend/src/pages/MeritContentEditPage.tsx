import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addCareer,
  addPreviousAward,
  deleteCareer,
  deletePreviousAward,
  generateMerit,
  generatePdf,
  getRecipient,
  upsertMerit,
} from "../api";
import { absoluteUrl } from "../api/client";
import type { MeritContent, RecipientDetail } from "../types";
import Field, { Button, Input, TextArea } from "../components/Field";

export default function MeritContentEditPage() {
  const { recipientId = "" } = useParams();
  const navigate = useNavigate();
  const [r, setR] = useState<RecipientDetail | null>(null);
  const [mc, setMc] = useState<Partial<MeritContent>>({});
  const [keywords, setKeywords] = useState("봉사, 청렴, 지역사회 화합, 취약계층 지원");
  const [activitySummary, setActivitySummary] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => getRecipient(recipientId).then(r => { setR(r); setMc(r.merit_content || {}); });
  useEffect(() => { load(); }, [recipientId]);

  if (!r) return <div className="text-slate-500">불러오는 중...</div>;

  const onSave = async () => {
    await upsertMerit(recipientId, mc);
    alert("저장되었습니다.");
  };

  const onGenerate = async () => {
    setBusy(true);
    try {
      const k = keywords.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
      const next = await generateMerit(recipientId, { keywords: k, activity_summary: activitySummary });
      setMc(next);
      alert("AI 초안이 생성되었습니다. 검토 후 저장해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const onGeneratePdf = async () => {
    await upsertMerit(recipientId, mc);
    const res = await generatePdf(recipientId);
    if (res.files[0]) window.open(absoluteUrl(res.files[0].download_url), "_blank");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{r.recipient_name} 공적내용</h1>
          <div className="text-sm text-slate-500">{r.organization_name} · {r.recipient_position_title}</div>
        </div>
        <div className="space-x-2">
          <Button variant="secondary" onClick={() => navigate(`/recipients/${recipientId}`)}>기본정보 수정</Button>
          <Button variant="secondary" onClick={() => navigate(`/recipients/${recipientId}/preview`)}>미리보기</Button>
          <Button onClick={onGeneratePdf}>저장 + PDF 생성</Button>
        </div>
      </div>

      <section className="bg-white shadow rounded p-6 space-y-4">
        <h2 className="font-bold">AI 자동작성 보조</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="키워드 (콤마 구분)">
            <Input value={keywords} onChange={e => setKeywords(e.target.value)} />
          </Field>
          <Field label="주요 활동 요약 (선택)">
            <Input value={activitySummary} onChange={e => setActivitySummary(e.target.value)} />
          </Field>
        </div>
        <Button variant="secondary" disabled={busy} onClick={onGenerate}>
          {busy ? "생성 중..." : "AI 초안 생성 (공적요지·공적사항·추천사유)"}
        </Button>
        <p className="text-xs text-slate-500">
          ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 가 백엔드에 설정된 경우 LLM 호출,
          그렇지 않으면 규칙 기반 템플릿이 사용됩니다. 모든 결과는 사람이 반드시 검토해야 합니다.
        </p>
      </section>

      <section className="bg-white shadow rounded p-6 space-y-4">
        <h2 className="font-bold">공적요지 (50자 내외)</h2>
        <TextArea rows={3} value={mc.merit_short_summary || ""} onChange={e => setMc({ ...mc, merit_short_summary: e.target.value })} />

        <h2 className="font-bold pt-2">추천사유</h2>
        <TextArea rows={4} value={mc.recommendation_reason || ""} onChange={e => setMc({ ...mc, recommendation_reason: e.target.value })} />

        <h2 className="font-bold pt-2">공적개요 (1~4번 요약)</h2>
        {[1, 2, 3, 4].map(i => (
          <Field key={i} label={`공적개요 ${i}`}>
            <TextArea rows={2}
              value={(mc as any)[`merit_overview_${i}`] || ""}
              onChange={e => setMc({ ...mc, [`merit_overview_${i}`]: e.target.value })}
            />
          </Field>
        ))}

        <h2 className="font-bold pt-2">공적사항 (본문)</h2>
        <TextArea rows={14} value={mc.full_merit_text || ""} onChange={e => setMc({ ...mc, full_merit_text: e.target.value })} />

        <h2 className="font-bold pt-2">현지조사</h2>
        <Field label="성품"><TextArea rows={2} value={mc.character_assessment || ""} onChange={e => setMc({ ...mc, character_assessment: e.target.value })} /></Field>
        <Field label="지역여론"><TextArea rows={2} value={mc.local_reputation || ""} onChange={e => setMc({ ...mc, local_reputation: e.target.value })} /></Field>
        <Field label="공적사항 일치여부"><Input value={mc.merit_consistency || "공적내용과 일치함"} onChange={e => setMc({ ...mc, merit_consistency: e.target.value })} /></Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onSave}>임시 저장</Button>
          <Button onClick={onGeneratePdf}>저장 + PDF 생성</Button>
        </div>
      </section>

      <section className="bg-white shadow rounded p-6">
        <h2 className="font-bold mb-3">주요 경력</h2>
        <CareerEditor recipientId={recipientId} records={r.career_records} onChanged={load} />
      </section>

      <section className="bg-white shadow rounded p-6">
        <h2 className="font-bold mb-3">과거 표창기록</h2>
        <PreviousAwardEditor recipientId={recipientId} records={r.previous_awards} onChanged={load} />
      </section>
    </div>
  );
}

function CareerEditor({ recipientId, records, onChanged }: { recipientId: string; records: any[]; onChanged: () => void }) {
  const [date, setDate] = useState("");
  const [desc, setDesc] = useState("");
  const add = async () => {
    if (!desc) return;
    await addCareer(recipientId, { record_date: date, description: desc, sort_order: records.length });
    setDate(""); setDesc(""); onChanged();
  };
  return (
    <>
      <table className="w-full text-sm mb-3">
        <thead className="bg-slate-50"><tr><th className="px-2 py-1 text-left w-40">년 월 일</th><th className="px-2 py-1 text-left">이력</th><th></th></tr></thead>
        <tbody>
          {records.length === 0 ? (<tr><td colSpan={3} className="text-center text-slate-400 py-3">기록 없음</td></tr>) :
            records.map(rec => (
              <tr key={rec.id} className="border-t">
                <td className="px-2 py-1">{rec.record_date}</td>
                <td className="px-2 py-1">{rec.description}</td>
                <td className="px-2 py-1 text-right"><Button variant="ghost" onClick={async () => { await deleteCareer(rec.id); onChanged(); }}>삭제</Button></td>
              </tr>
            ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <Input className="w-40" placeholder="2020-01-01" value={date} onChange={e => setDate(e.target.value)} />
        <Input placeholder="이력" value={desc} onChange={e => setDesc(e.target.value)} />
        <Button variant="secondary" onClick={add}>추가</Button>
      </div>
    </>
  );
}

function PreviousAwardEditor({ recipientId, records, onChanged }: { recipientId: string; records: any[]; onChanged: () => void }) {
  const [date, setDate] = useState("");
  const [desc, setDesc] = useState("");
  const add = async () => {
    if (!desc) return;
    await addPreviousAward(recipientId, { award_date: date, description: desc, sort_order: records.length });
    setDate(""); setDesc(""); onChanged();
  };
  return (
    <>
      <table className="w-full text-sm mb-3">
        <thead className="bg-slate-50"><tr><th className="px-2 py-1 text-left w-40">년 월 일</th><th className="px-2 py-1 text-left">내용</th><th></th></tr></thead>
        <tbody>
          {records.length === 0 ? (<tr><td colSpan={3} className="text-center text-slate-400 py-3">기록 없음</td></tr>) :
            records.map(rec => (
              <tr key={rec.id} className="border-t">
                <td className="px-2 py-1">{rec.award_date}</td>
                <td className="px-2 py-1">{rec.description}</td>
                <td className="px-2 py-1 text-right"><Button variant="ghost" onClick={async () => { await deletePreviousAward(rec.id); onChanged(); }}>삭제</Button></td>
              </tr>
            ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <Input className="w-40" placeholder="2020-01-01" value={date} onChange={e => setDate(e.target.value)} />
        <Input placeholder="표창 내용" value={desc} onChange={e => setDesc(e.target.value)} />
        <Button variant="secondary" onClick={add}>추가</Button>
      </div>
    </>
  );
}
