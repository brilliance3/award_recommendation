import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addCareer,
  addPreviousAward,
  deleteCareer,
  deletePreviousAward,
  generateMerit,
  getRecipient,
  upsertMerit,
} from "../api";
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
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      await upsertMerit(recipientId, mc);
      setSaveModalOpen(true);
    } catch (err: any) {
      alert(
        "저장에 실패했습니다.\n" +
          (err?.response?.data?.detail || err?.message || "")
      );
    } finally {
      setSaving(false);
    }
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
        </Field>

        <Field label="추천사유">
          <TextArea
            rows={4}
            value={mc.recommendation_reason || ""}
            onChange={e =>
              setMc({ ...mc, recommendation_reason: e.target.value })
            }
          />
        </Field>

        <Field
          label="공적사항 (본문)"
          hint="자유 형식으로 작성하세요. 본문은 시스템이 자동 요약하여 공적개요서 (공적 개요 1~4) 칸에 반영됩니다."
        >
          <TextArea
            rows={16}
            value={mc.full_merit_text || ""}
            onChange={e => setMc({ ...mc, full_merit_text: e.target.value })}
          />
        </Field>

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

      {/* 저장 (페이지 맨 아래) */}
      <div className="flex justify-end pt-3 border-t border-ink-100">
        <Button
          onClick={onSave}
          disabled={saving}
          size="lg"
          className="sm:w-auto w-full"
        >
          {saving ? "저장 중..." : "저장"}
        </Button>
      </div>

      {/* 저장 완료 팝업 */}
      {saveModalOpen && (
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
                저장되었습니다
              </h3>
              <p className="text-sm text-ink-700 leading-relaxed">
                공적 내용이 정상적으로 저장되었습니다.
                <br />
                이후 <strong>[문서 생성]</strong> 메뉴에서 공적개요서·공적조서·
                체크리스트 HWPX 파일을 다운로드할 수 있습니다.
              </p>
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                onClick={() => setSaveModalOpen(false)}
                size="md"
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
