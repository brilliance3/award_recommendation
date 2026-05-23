import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addCareer,
  addPreviousAward,
  aiApi,
  deleteCareer,
  deletePreviousAward,
  generateHwpx,
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

  const load = () =>
    getRecipient(recipientId).then(r => {
      setR(r);
      setMc(r.merit_content || {});
    });
  useEffect(() => {
    load();
  }, [recipientId]);

  if (!r) return <div className="text-ink-500">불러오는 중...</div>;

  const onSave = async () => {
    await upsertMerit(recipientId, mc);
    alert("저장되었습니다.");
  };

  const onGenerate = async () => {
    setBusy(true);
    try {
      const k = keywords
        .split(/[,，、]/)
        .map(s => s.trim())
        .filter(Boolean);
      const next = await generateMerit(recipientId, {
        keywords: k,
        activity_summary: activitySummary,
      });
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

  const onGenerateHwpx = async () => {
    await upsertMerit(recipientId, mc);
    try {
      const res = await generateHwpx(recipientId);
      if (res.files[0])
        window.open(absoluteUrl(res.files[0].download_url), "_blank");
    } catch (e: any) {
      alert(`HWPX 생성 실패: ${e?.response?.data?.detail || e?.message || e}`);
    }
  };

  const polishField = async (
    fieldKey: "merit_short_summary" | "recommendation_reason" | "full_merit_text"
  ) => {
    const current = (mc as any)[fieldKey] || "";
    if (!current.trim()) {
      alert("다듬을 내용이 비어 있습니다.");
      return;
    }
    setBusy(true);
    try {
      const r = await aiApi.polish(current);
      if (!r.ok) {
        alert(`AI 다듬기 실패: ${r.error || "알 수 없는 오류"}`);
        return;
      }
      setMc((prev) => ({ ...prev, [fieldKey]: r.text }));
    } finally {
      setBusy(false);
    }
  };

  const summarizeToShort = async () => {
    const src = (mc.full_merit_text || mc.recommendation_reason || "").trim();
    if (!src) {
      alert("요약할 공적사항/추천사유가 비어 있습니다.");
      return;
    }
    setBusy(true);
    try {
      const r = await aiApi.summarize(src, 50);
      if (!r.ok) {
        alert(`AI 요약 실패: ${r.error || "알 수 없는 오류"}`);
        return;
      }
      setMc((prev) => ({ ...prev, merit_short_summary: r.text }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6">
      <div className="krds-page-header">
        <div className="min-w-0">
          <h1 className="krds-page-title break-keep">
            {r.recipient_name} 공적내용
          </h1>
          <p className="krds-page-sub">
            {r.organization_name || "-"} · {r.recipient_position_title || "-"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate(`/recipients/${recipientId}`)}
          >
            기본정보 수정
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(`/recipients/${recipientId}/preview`)}
          >
            미리보기
          </Button>
          <Button variant="accent" onClick={onGeneratePdf}>
            저장 + PDF 생성
          </Button>
          <Button variant="secondary" onClick={onGenerateHwpx}>
            📄 HWPX 다운로드
          </Button>
        </div>
      </div>

      {/* AI 자동작성 */}
      <section className="krds-card krds-card-pad space-y-4">
        <h2 className="krds-section-title">AI 자동작성 보조</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <Field label="키워드 (콤마 구분)">
            <Input
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
            />
          </Field>
          <Field label="주요 활동 요약 (선택)">
            <Input
              value={activitySummary}
              onChange={e => setActivitySummary(e.target.value)}
            />
          </Field>
        </div>
        <div>
          <Button variant="secondary" disabled={busy} onClick={onGenerate}>
            {busy ? "생성 중..." : "AI 초안 생성 (공적요지·공적사항·추천사유)"}
          </Button>
        </div>
        <p className="text-xs text-ink-500 leading-relaxed">
          ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 가 백엔드에 설정된 경우 LLM 호출,
          그렇지 않으면 규칙 기반 템플릿이 사용됩니다.{" "}
          <strong className="text-ink-700">
            모든 결과는 사람이 반드시 검토해야 합니다.
          </strong>
        </p>
      </section>

      {/* 공적내용 본문 */}
      <section className="krds-card krds-card-pad space-y-5">
        <h2 className="krds-section-title">공적 내용</h2>

        <Field label="공적요지 (50자 내외)">
          <TextArea
            rows={3}
            value={mc.merit_short_summary || ""}
            onChange={e =>
              setMc({ ...mc, merit_short_summary: e.target.value })
            }
          />
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              className="text-xs text-blue-700 underline"
              onClick={() => polishField("merit_short_summary")}
              disabled={busy}
            >
              ✨ AI 다듬기
            </button>
            <button
              type="button"
              className="text-xs text-blue-700 underline"
              onClick={summarizeToShort}
              disabled={busy}
            >
              📝 공적사항에서 50자 요약 생성
            </button>
          </div>
        </Field>

        <Field label="추천사유">
          <TextArea
            rows={4}
            value={mc.recommendation_reason || ""}
            onChange={e =>
              setMc({ ...mc, recommendation_reason: e.target.value })
            }
          />
          <div className="mt-1">
            <button
              type="button"
              className="text-xs text-blue-700 underline"
              onClick={() => polishField("recommendation_reason")}
              disabled={busy}
            >
              ✨ AI 다듬기
            </button>
          </div>
        </Field>

        <div>
          <h3 className="text-sm font-bold text-ink-800 mb-2">
            공적개요 (1~4번 요약)
          </h3>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <Field key={i} label={`공적개요 ${i}`}>
                <TextArea
                  rows={2}
                  value={(mc as any)[`merit_overview_${i}`] || ""}
                  onChange={e =>
                    setMc({ ...mc, [`merit_overview_${i}`]: e.target.value })
                  }
                />
              </Field>
            ))}
          </div>
        </div>

        <Field label="공적사항 (본문)">
          <TextArea
            rows={14}
            value={mc.full_merit_text || ""}
            onChange={e => setMc({ ...mc, full_merit_text: e.target.value })}
          />
          <div className="mt-1">
            <button
              type="button"
              className="text-xs text-blue-700 underline"
              onClick={() => polishField("full_merit_text")}
              disabled={busy}
            >
              ✨ AI 다듬기 (행정문서 문체로)
            </button>
          </div>
        </Field>

        <div>
          <h3 className="text-sm font-bold text-ink-800 mb-3">현지조사</h3>
          <div className="space-y-3">
            <Field label="성품">
              <TextArea
                rows={2}
                value={mc.character_assessment || ""}
                onChange={e =>
                  setMc({ ...mc, character_assessment: e.target.value })
                }
              />
            </Field>
            <Field label="지역여론">
              <TextArea
                rows={2}
                value={mc.local_reputation || ""}
                onChange={e =>
                  setMc({ ...mc, local_reputation: e.target.value })
                }
              />
            </Field>
            <Field label="공적사항 일치여부">
              <Input
                value={mc.merit_consistency || "공적내용과 일치함"}
                onChange={e =>
                  setMc({ ...mc, merit_consistency: e.target.value })
                }
              />
            </Field>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-ink-100">
          <Button
            variant="secondary"
            onClick={onSave}
            className="sm:w-auto w-full"
          >
            임시 저장
          </Button>
          <Button
            variant="accent"
            onClick={onGeneratePdf}
            className="sm:w-auto w-full"
          >
            저장 + PDF 생성
          </Button>
        </div>
      </section>

      {/* 경력 */}
      <section className="krds-card krds-card-pad">
        <h2 className="krds-section-title mb-3">주요 경력</h2>
        <CareerEditor
          recipientId={recipientId}
          records={r.career_records}
          onChanged={load}
        />
      </section>

      {/* 표창 */}
      <section className="krds-card krds-card-pad">
        <h2 className="krds-section-title mb-3">과거 표창기록</h2>
        <PreviousAwardEditor
          recipientId={recipientId}
          records={r.previous_awards}
          onChanged={load}
        />
      </section>
    </div>
  );
}

function CareerEditor({
  recipientId,
  records,
  onChanged,
}: {
  recipientId: string;
  records: any[];
  onChanged: () => void;
}) {
  const [date, setDate] = useState("");
  const [desc, setDesc] = useState("");
  const add = async () => {
    if (!desc) return;
    await addCareer(recipientId, {
      record_date: date,
      description: desc,
      sort_order: records.length,
    });
    setDate("");
    setDesc("");
    onChanged();
  };
  return (
    <>
      <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg sm:border sm:border-ink-200">
        <table className="krds-table">
          <thead>
            <tr>
              <th className="w-40">년 월 일</th>
              <th>이력</th>
              <th className="w-20 text-right">조치</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-ink-400 py-4">
                  기록 없음
                </td>
              </tr>
            ) : (
              records.map(rec => (
                <tr key={rec.id}>
                  <td>{rec.record_date}</td>
                  <td>{rec.description}</td>
                  <td className="text-right">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        await deleteCareer(rec.id);
                        onChanged();
                      }}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <Input
          className="sm:w-44"
          placeholder="2020-01-01"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        <Input
          placeholder="이력"
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />
        <Button variant="secondary" onClick={add} className="sm:w-auto w-full">
          추가
        </Button>
      </div>
    </>
  );
}

function PreviousAwardEditor({
  recipientId,
  records,
  onChanged,
}: {
  recipientId: string;
  records: any[];
  onChanged: () => void;
}) {
  const [date, setDate] = useState("");
  const [desc, setDesc] = useState("");
  const add = async () => {
    if (!desc) return;
    await addPreviousAward(recipientId, {
      award_date: date,
      description: desc,
      sort_order: records.length,
    });
    setDate("");
    setDesc("");
    onChanged();
  };
  return (
    <>
      <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg sm:border sm:border-ink-200">
        <table className="krds-table">
          <thead>
            <tr>
              <th className="w-40">년 월 일</th>
              <th>내용</th>
              <th className="w-20 text-right">조치</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-ink-400 py-4">
                  기록 없음
                </td>
              </tr>
            ) : (
              records.map(rec => (
                <tr key={rec.id}>
                  <td>{rec.award_date}</td>
                  <td>{rec.description}</td>
                  <td className="text-right">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        await deletePreviousAward(rec.id);
                        onChanged();
                      }}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <Input
          className="sm:w-44"
          placeholder="2020-01-01"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        <Input
          placeholder="표창 내용"
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />
        <Button variant="secondary" onClick={add} className="sm:w-auto w-full">
          추가
        </Button>
      </div>
    </>
  );
}
