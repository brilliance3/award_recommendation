import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addCareer,
  addPreviousAward,
  aiApi,
  deleteCareer,
  deletePreviousAward,
  generateMerit,
  getRecipient,
  upsertMerit,
} from "../api";
import type { MeritContent, RecipientDetail } from "../types";
import Field, { Button, Input, TextArea } from "../components/Field";
import KeywordChips from "../components/KeywordChips";

export default function MeritContentEditPage() {
  const { recipientId = "" } = useParams();
  const navigate = useNavigate();
  const [r, setR] = useState<RecipientDetail | null>(null);
  const [mc, setMc] = useState<Partial<MeritContent>>({});
  const [selectedKw, setSelectedKw] = useState<string[]>([
    "솔선수범", "지역사회 화합", "어려운 이웃 지원",
  ]);
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

  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const onSave = async () => {
    await upsertMerit(recipientId, mc);
    setSavedAt(new Date());
  };

  const onGenerate = async () => {
    if (selectedKw.length === 0) {
      alert("키워드를 1개 이상 선택해주세요.");
      return;
    }
    setBusy(true);
    try {
      const next = await generateMerit(recipientId, {
        keywords: selectedKw,
        activity_summary: activitySummary,
      });
      setMc(next);
      alert("AI 초안이 생성되었습니다. 검토 후 저장해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  // PDF/HWPX 생성은 다운로드 페이지(DownloadPage)에서만 진행.

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

  const [abChoice, setAbChoice] = useState<{ a: string; b: string; field: string } | null>(null);
  const polishABField = async (
    fieldKey: "merit_short_summary" | "recommendation_reason" | "full_merit_text"
  ) => {
    const current = (mc as any)[fieldKey] || "";
    if (!current.trim()) {
      alert("다듬을 내용이 비어 있습니다.");
      return;
    }
    setBusy(true);
    try {
      const r = await aiApi.polishAB(current);
      if (!r.a.ok || !r.b.ok) {
        alert(`AI 다듬기 실패: ${r.a.error || r.b.error}`);
        return;
      }
      setAbChoice({ a: r.a.text, b: r.b.text, field: fieldKey });
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
          <Button variant="accent" onClick={onSave}>
            💾 저장
          </Button>
        </div>
      </div>

      {/* AI 자동작성 */}
      <section className="krds-card krds-card-pad space-y-4">
        <h2 className="krds-section-title">AI 자동작성 보조</h2>

        <div>
          <label className="krds-label">
            키워드 선택 (여러 개 가능)
          </label>
          <KeywordChips
            committee={(() => {
              // 추천자 정보에서 위원회 이름을 추출 (예: "보건복지위원회" 포함)
              const t = (r as any)?.award_case?.recommender_full_title || "";
              const match = t.match(/([가-힣]+위원회)/);
              return match ? match[1] : null;
            })()}
            selected={selectedKw}
            onChange={setSelectedKw}
          />
        </div>

        <Field label="주요 활동 요약 (선택)" hint="공적사항에 포함할 실제 활동 사실">
          <TextArea
            rows={3}
            value={activitySummary}
            onChange={e => setActivitySummary(e.target.value)}
            placeholder="예: 2018년부터 매월 봉사활동 참여, 2023년 마을 자율방재단 창설 등"
          />
        </Field>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="accent"
            disabled={busy || selectedKw.length === 0}
            onClick={onGenerate}
          >
            {busy ? "생성 중..." : "✨ AI 초안 생성 (공적요지·공적사항·추천사유)"}
          </Button>
        </div>

        <p className="text-xs text-ink-500 leading-relaxed">
          OPENAI_API_KEY가 설정된 경우 GPT-5.4 mini 호출, 그렇지 않으면 규칙 기반 템플릿이 사용됩니다.
          <strong className="text-ink-700"> 모든 결과는 사람이 반드시 검토해야 합니다.</strong>
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
          <div className="mt-1 flex gap-3">
            <button
              type="button"
              className="text-xs text-blue-700 underline"
              onClick={() => polishField("full_merit_text")}
              disabled={busy}
            >
              ✨ AI 다듬기
            </button>
            <button
              type="button"
              className="text-xs text-accent-700 underline"
              onClick={() => polishABField("full_merit_text")}
              disabled={busy}
            >
              🆎 A/B 두 가지 안 비교
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
            variant="accent"
            onClick={onSave}
            className="sm:w-auto w-full"
          >
            💾 저장
          </Button>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-success-600">
            {savedAt ? `✓ ${savedAt.toLocaleTimeString()} 저장됨` : ""}
          </span>
          <span className="text-ink-500">
            파일 출력(PDF/HWPX/XLSX/ZIP)은 표창 건의 <strong>"문서 생성"</strong> 페이지에서 진행하세요.
          </span>
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

      {/* A/B 비교 모달 */}
      {abChoice && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/50 flex items-center justify-center p-4"
          onClick={() => setAbChoice(null)}
        >
          <div
            className="krds-card w-full max-w-4xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-ink-200">
              <h3 className="font-bold text-lg">A / B 두 가지 안 비교</h3>
              <p className="text-xs text-ink-500 mt-0.5">마음에 드는 쪽을 선택하세요.</p>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
              {[
                { key: "A", text: abChoice.a, color: "brand" },
                { key: "B", text: abChoice.b, color: "accent" },
              ].map(({ key, text, color }) => (
                <div key={key} className={`border-2 rounded-lg p-3 ${color === "brand" ? "border-brand-300" : "border-accent-300"}`}>
                  <div className={`font-bold mb-2 ${color === "brand" ? "text-brand-700" : "text-accent-700"}`}>
                    [{key}안] {key === "A" ? "보수적" : "적극적"}
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-ink-800 mb-3">{text}</pre>
                  <button
                    onClick={() => {
                      setMc((prev) => ({ ...prev, [abChoice.field]: text }));
                      setAbChoice(null);
                    }}
                    className={`krds-btn krds-btn-md w-full ${color === "brand" ? "krds-btn-primary" : "krds-btn-accent"}`}
                  >
                    이 안 선택
                  </button>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-ink-100 flex justify-end">
              <button onClick={() => setAbChoice(null)} className="krds-btn krds-btn-md krds-btn-ghost">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
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
