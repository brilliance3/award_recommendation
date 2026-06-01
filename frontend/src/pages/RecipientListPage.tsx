import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteRecipient, getCase, importXlsx, updateCase } from "../api";
import type { AwardCaseDetail } from "../types";
import { Button, Input } from "../components/Field";

export default function RecipientListPage() {
  const { caseId = "" } = useParams();
  const [detail, setDetail] = useState<AwardCaseDetail | null>(null);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  // 표창건명 인라인 편집
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  // 표창일 인라인 편집
  const [editingAwardDate, setEditingAwardDate] = useState(false);
  const [awardDateDraft, setAwardDateDraft] = useState("");
  const [savingAwardDate, setSavingAwardDate] = useState(false);

  const load = () => getCase(caseId).then(setDetail);
  useEffect(() => {
    load();
  }, [caseId]);

  if (!detail) return <div className="text-ink-500">불러오는 중...</div>;

  const startEditTitle = () => {
    setTitleDraft(detail.title);
    setEditingTitle(true);
  };
  const cancelEditTitle = () => {
    setEditingTitle(false);
    setTitleDraft("");
  };
  const saveTitle = async () => {
    const t = titleDraft.trim();
    if (!t) {
      alert("표창건명을 입력해 주세요.");
      return;
    }
    if (t === detail.title) {
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    try {
      await updateCase(caseId, { title: t });
      await load();
      setEditingTitle(false);
    } catch (err: any) {
      alert(
        "건명 저장에 실패했습니다.\n" +
          (err?.response?.data?.detail || err?.message || "")
      );
    } finally {
      setSavingTitle(false);
    }
  };

  const startEditAwardDate = () => {
    setAwardDateDraft(detail.award_date || "");
    setEditingAwardDate(true);
  };
  const cancelEditAwardDate = () => {
    setEditingAwardDate(false);
    setAwardDateDraft("");
  };
  const saveAwardDate = async () => {
    if (awardDateDraft === (detail.award_date || "")) {
      setEditingAwardDate(false);
      return;
    }
    setSavingAwardDate(true);
    try {
      await updateCase(caseId, { award_date: awardDateDraft || undefined });
      await load();
      setEditingAwardDate(false);
    } catch (err: any) {
      alert(
        "표창일 저장에 실패했습니다.\n" +
          (err?.response?.data?.detail || err?.message || "")
      );
    } finally {
      setSavingAwardDate(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("이 대상자와 관련 문서를 삭제합니다. 계속할까요?")) return;
    await deleteRecipient(id);
    load();
  };

  const onUploadXlsx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await importXlsx(caseId, f);
    load();
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-xs text-ink-500 mb-3" aria-label="이동 경로">
        <Link to="/" className="hover:text-brand-700">
          대시보드
        </Link>
        <span className="mx-1.5 text-ink-300">›</span>
        <span className="text-ink-700">{detail.title}</span>
      </nav>

      <div className="krds-page-header">
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                placeholder="예) 홍길동 의장표창 추천 / 경기복지재단 표창 추천"
                autoFocus
                className="sm:flex-1"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveTitle();
                  } else if (e.key === "Escape") {
                    cancelEditTitle();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={saveTitle}
                  disabled={savingTitle}
                >
                  {savingTitle ? "저장 중..." : "저장"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={cancelEditTitle}
                >
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="krds-page-title break-keep">{detail.title}</h1>
              <Button
                size="sm"
                variant="ghost"
                onClick={startEditTitle}
                title="표창건명 수정"
              >
                ✎ 건명 수정
              </Button>
            </div>
          )}
          <div className="krds-page-sub flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="krds-badge krds-badge-brand">
              {detail.award_grade}
            </span>
            <span>
              {detail.recommender_full_title} {detail.recommender_name}
            </span>
            <span className="text-ink-300">·</span>
            {editingAwardDate ? (
              <span className="inline-flex items-center gap-1.5">
                <Input
                  type="date"
                  value={awardDateDraft}
                  onChange={e => setAwardDateDraft(e.target.value)}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveAwardDate();
                    } else if (e.key === "Escape") {
                      cancelEditAwardDate();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={saveAwardDate}
                  disabled={savingAwardDate}
                >
                  {savingAwardDate ? "저장 중..." : "저장"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={cancelEditAwardDate}
                >
                  취소
                </Button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span>표창일 {detail.award_date || "미정"}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={startEditAwardDate}
                  title="표창일 수정"
                >
                  ✎
                </Button>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="md"
            variant="secondary"
            onClick={() => fileRef.current?.click()}
          >
            XLSX 업로드
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={onUploadXlsx}
          />
          <Button onClick={() => navigate(`/cases/${caseId}/recipients/new`)}>
            ＋ 대상자 추가
          </Button>
          <Button
            variant="accent"
            onClick={() => navigate(`/cases/${caseId}/download`)}
          >
            문서 생성
          </Button>
        </div>
      </div>

      {/* 신청자 정보 (민간인 /apply 신청 건만 표시) */}
      {detail.applicant_name && (
        <div className="krds-card krds-card-pad mb-4 border-ink-200">
          <h2 className="text-sm font-bold text-ink-800 mb-2">
            신청자 정보 (민간인 신청)
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="text-ink-500 shrink-0 w-20">신청자</dt>
              <dd className="text-ink-800">
                {detail.applicant_name}
                {detail.applicant_role === "organization" && (
                  <span className="ml-1 text-xs text-ink-500">
                    (기관 대표)
                  </span>
                )}
              </dd>
            </div>
            {detail.applicant_organization && (
              <div className="flex gap-2">
                <dt className="text-ink-500 shrink-0 w-20">기관·단체</dt>
                <dd className="text-ink-800">{detail.applicant_organization}</dd>
              </div>
            )}
            {detail.applicant_contact && (
              <div className="flex gap-2">
                <dt className="text-ink-500 shrink-0 w-20">연락처</dt>
                <dd className="text-ink-800">{detail.applicant_contact}</dd>
              </div>
            )}
            {detail.applicant_delivery_address && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="text-ink-500 shrink-0 w-20">등기수령</dt>
                <dd className="text-ink-800 break-all">
                  {detail.applicant_delivery_address}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* 데스크탑/태블릿 — 표 */}
      <div className="hidden md:block krds-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="krds-table">
            <thead>
              <tr>
                <th className="w-14 text-center">No</th>
                <th>성명</th>
                <th>생년월일</th>
                <th>소속</th>
                <th>직위</th>
                <th>공적분야</th>
                <th className="text-right">조치</th>
              </tr>
            </thead>
            <tbody>
              {detail.recipients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-ink-500 py-8">
                    대상자가 없습니다. 우측 상단에서 추가하거나 XLSX를 업로드하세요.
                  </td>
                </tr>
              ) : (
                detail.recipients.map(r => (
                  <tr key={r.id}>
                    <td className="text-center text-ink-500">
                      {r.sequence_no}
                    </td>
                    <td className="font-semibold">
                      <Link className="krds-link" to={`/recipients/${r.id}`}>
                        {r.recipient_name}
                      </Link>
                    </td>
                    <td>{r.birth_date || "-"}</td>
                    <td>{r.organization_name || "-"}</td>
                    <td>{r.recipient_position_title || "-"}</td>
                    <td>{r.merit_category || "-"}</td>
                    <td className="text-right">
                      <div className="inline-flex gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            navigate(`/recipients/${r.id}/merit`)
                          }
                        >
                          공적
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            navigate(`/recipients/${r.id}/preview`)
                          }
                        >
                          미리보기
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            navigate(`/recipients/${r.id}/admin-review`)
                          }
                        >
                          검토
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => onDelete(r.id)}
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 모바일 — 카드 리스트 */}
      <div className="md:hidden space-y-3">
        {detail.recipients.length === 0 ? (
          <div className="krds-card krds-card-pad text-center text-ink-500">
            대상자가 없습니다. 상단 버튼에서 추가하세요.
          </div>
        ) : (
          detail.recipients.map(r => (
            <div key={r.id} className="krds-card krds-card-pad">
              <div className="flex items-center justify-between gap-2">
                <Link
                  to={`/recipients/${r.id}`}
                  className="text-base font-bold text-ink-900 hover:text-brand-700"
                >
                  {r.sequence_no}. {r.recipient_name}
                </Link>
                {r.merit_category && (
                  <span className="krds-badge krds-badge-accent">
                    {r.merit_category}
                  </span>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-1.5 text-xs">
                <dt className="text-ink-500">생년월일</dt>
                <dd className="col-span-2 text-ink-800">
                  {r.birth_date || "-"}
                </dd>
                <dt className="text-ink-500">소속</dt>
                <dd className="col-span-2 text-ink-800">
                  {r.organization_name || "-"}
                </dd>
                <dt className="text-ink-500">직위</dt>
                <dd className="col-span-2 text-ink-800">
                  {r.recipient_position_title || "-"}
                </dd>
              </dl>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/recipients/${r.id}/merit`)}
                >
                  공적
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/recipients/${r.id}/preview`)}
                >
                  미리보기
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate(`/recipients/${r.id}/admin-review`)}
                >
                  검토
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onDelete(r.id)}
                >
                  삭제
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
