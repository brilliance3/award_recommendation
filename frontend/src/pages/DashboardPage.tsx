import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteCase, listCases, seedDemoData } from "../api";
import type { AwardCase } from "../types";
import { Button } from "../components/Field";
import ShareLinksModal from "../components/ShareLinksModal";

export default function DashboardPage() {
  const [cases, setCases] = useState<AwardCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareCase, setShareCase] = useState<AwardCase | null>(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    listCases()
      .then(setCases)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onDelete = async (id: string) => {
    if (!confirm("이 표창 건과 관련 대상자·문서를 모두 삭제합니다. 계속할까요?"))
      return;
    await deleteCase(id);
    load();
  };

  return (
    <div>
      <div className="krds-page-header">
        <div>
          <h1 className="krds-page-title">표창 건 목록</h1>
          <p className="krds-page-sub">
            추천 표창 건을 등록·관리하고 공적조서 PDF·XLSX를 생성합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="md"
            variant="secondary"
            onClick={async () => {
              if (!confirm("[DEMO] 표시된 가상 표창 건 3개와 대상자 50명을 새로 생성합니다.\n기존 [DEMO] 데이터는 자동 삭제됩니다. 계속할까요?"))
                return;
              const r = await seedDemoData(50);
              alert(`완료: ${r.demo_recipients}명 / ${r.demo_cases.length}건`);
              load();
            }}
            className="w-full sm:w-auto"
          >
            🧪 데모 데이터 50명 생성
          </Button>
          <Button
            size="md"
            onClick={() => navigate("/cases/new")}
            className="w-full sm:w-auto"
          >
            <span aria-hidden>＋</span> 새 표창 건 만들기
          </Button>
        </div>
      </div>

      {loading ? (
        <SkeletonList />
      ) : cases.length === 0 ? (
        <div className="krds-card krds-card-pad flex flex-col items-center justify-center text-center py-12 sm:py-16">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 sm:h-7 sm:w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <p className="text-ink-800 font-semibold">아직 등록된 표창 건이 없습니다</p>
          <p className="text-sm text-ink-500 mt-1">
            첫 표창 추천 건을 만들고 대상자·공적사항을 등록해 보세요.
          </p>
          <div className="mt-5">
            <Button size="lg" onClick={() => navigate("/cases/new")}>
              지금 만들기
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* 데스크탑/태블릿 — 표 */}
          <div className="hidden md:block krds-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="krds-table">
                <thead>
                  <tr>
                    <th className="w-[30%]">표창 건명</th>
                    <th>훈격</th>
                    <th>추천자</th>
                    <th>표창일</th>
                    <th className="text-center">대상자</th>
                    <th className="text-right">조치</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map(c => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/cases/${c.id}`} className="krds-link">
                          {c.title}
                        </Link>
                      </td>
                      <td>
                        <span className="krds-badge krds-badge-brand">
                          {c.award_grade}
                        </span>
                      </td>
                      <td className="text-ink-700">
                        {[
                          c.recommender_department,
                          c.recommender_position,
                          c.recommender_name,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      </td>
                      <td className="text-ink-700">{c.award_date || "-"}</td>
                      <td className="text-center">
                        <span className="krds-badge krds-badge-ink">
                          {c.recipient_count}명
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="inline-flex gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => navigate(`/cases/${c.id}`)}
                          >
                            대상자
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setShareCase(c)}
                            title="대상자별 입력 링크 공유"
                          >
                            🔗 공유
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              navigate(`/cases/${c.id}/download`)
                            }
                          >
                            문서
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => onDelete(c.id)}
                          >
                            삭제
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 모바일 — 카드 리스트 */}
          <ul className="md:hidden space-y-3">
            {cases.map(c => (
              <li key={c.id} className="krds-card krds-card-pad">
                <Link
                  to={`/cases/${c.id}`}
                  className="block text-base font-bold text-ink-900 hover:text-brand-700"
                >
                  {c.title}
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="krds-badge krds-badge-brand">
                    {c.award_grade}
                  </span>
                  <span className="krds-badge krds-badge-ink">
                    대상자 {c.recipient_count}명
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <dt className="col-span-1 text-ink-500">추천자</dt>
                  <dd className="col-span-2 text-ink-800">
                    {[
                      c.recommender_department,
                      c.recommender_position,
                      c.recommender_name,
                    ]
                      .filter(Boolean)
                      .join(" ") || "-"}
                  </dd>
                  <dt className="col-span-1 text-ink-500">표창일</dt>
                  <dd className="col-span-2 text-ink-800">
                    {c.award_date || "-"}
                  </dd>
                </dl>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/cases/${c.id}`)}
                  >
                    대상자
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShareCase(c)}
                  >
                    🔗 공유
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/cases/${c.id}/download`)}
                  >
                    문서
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => onDelete(c.id)}
                  >
                    삭제
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {shareCase && (
        <ShareLinksModal
          caseId={shareCase.id}
          caseTitle={shareCase.title}
          onClose={() => setShareCase(null)}
        />
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="krds-card krds-card-pad space-y-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="animate-pulse flex items-center gap-3">
          <div className="h-4 w-1/3 bg-ink-100 rounded" />
          <div className="h-4 w-20 bg-ink-100 rounded" />
          <div className="h-4 w-24 bg-ink-100 rounded" />
          <div className="ml-auto h-8 w-20 bg-ink-100 rounded" />
        </div>
      ))}
    </div>
  );
}
