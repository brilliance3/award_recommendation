import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteRecipient, getCase, importXlsx } from "../api";
import type { AwardCaseDetail } from "../types";
import { Button } from "../components/Field";

export default function RecipientListPage() {
  const { caseId = "" } = useParams();
  const [detail, setDetail] = useState<AwardCaseDetail | null>(null);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => getCase(caseId).then(setDetail);
  useEffect(() => {
    load();
  }, [caseId]);

  if (!detail) return <div className="text-ink-500">불러오는 중...</div>;

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
        <div className="min-w-0">
          <h1 className="krds-page-title break-keep">{detail.title}</h1>
          <div className="krds-page-sub flex flex-wrap items-center gap-1.5">
            <span className="krds-badge krds-badge-brand">
              {detail.award_grade}
            </span>
            <span>
              {detail.recommender_full_title} {detail.recommender_name}
            </span>
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
