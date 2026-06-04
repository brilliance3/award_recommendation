import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  getAllCases,
  updateCase,
  listLegislators,
  deleteCase,
  trashAllCases,
} from "../api";
import type { CasesResponse, CaseRow } from "../api/dashboards";
import { CASE_STATUSES, CASE_STATUS_LABELS } from "../api/dashboards";
import type { Legislator } from "../api/settings";
import { Button } from "../components/Field";

const STATUS_COLOR: Record<string, string> = {
  대기: "bg-ink-100 text-ink-700",
  예정: "bg-blue-100 text-blue-700",
  진행: "bg-amber-100 text-amber-700",
  보관: "bg-purple-100 text-purple-700",
  완료: "bg-emerald-100 text-emerald-700",
  취소: "bg-red-100 text-red-700",
};

const isExternal = (r: CaseRow) => !!r.applicant_role;
const isDone = (r: CaseRow) => (r.status || "") === "완료";

/** 목록 행/카드 배경 — 완료=회색 음영(우선), 외부신청=강조(앰버). */
function rowHighlight(r: CaseRow): string {
  if (isDone(r)) return "bg-ink-100 text-ink-400";
  if (isExternal(r)) return "bg-amber-50";
  return "";
}

export default function AllCasesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [statusF, setStatusF] = useState("");
  const [recommenderF, setRecommenderF] = useState(
    searchParams.get("legislator") || ""
  );
  const [legislators, setLegislators] = useState<Legislator[]>([]);

  const load = () => {
    setLoading(true);
    getAllCases()
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    listLegislators().then(setLegislators).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, []);

  const onDelete = async (row: CaseRow) => {
    if (
      !confirm(
        "이 표창 건을 휴지통으로 보냅니다. (휴지통에서 복구할 수 있습니다)"
      )
    )
      return;
    try {
      await deleteCase(row.id);
      load();
    } catch (err: any) {
      alert("삭제 실패: " + (err?.response?.data?.detail || err?.message || ""));
    }
  };

  const onTrashAll = async () => {
    const n = data?.rows.length || 0;
    if (n === 0) return;
    if (
      !confirm(
        `관리 중인 표창건 ${n}건을 모두 휴지통으로 보냅니다.\n(휴지통에서 복구할 수 있습니다) 계속할까요?`
      )
    )
      return;
    await trashAllCases();
    load();
  };

  // 필터 드롭다운 옵션 (추천의원·표창일은 데이터에서 추출)
  const recommenderOptions = useMemo(
    () =>
      [...new Set((data?.rows || []).map(r => r.recommender_name).filter(Boolean))] as string[],
    [data]
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    const f = filter.trim();
    if (f) {
      rows = rows.filter(
        r =>
          (r.recommender_name || "").includes(f) ||
          r.title.includes(f) ||
          r.recipient_names.some(n => n.includes(f)) ||
          (r.applicant_name || "").includes(f) ||
          (r.status || "").includes(f)
      );
    }
    if (statusF) rows = rows.filter(r => (r.status || "예정") === statusF);
    if (recommenderF) rows = rows.filter(r => (r.recommender_name || "") === recommenderF);
    // 표창일 최신순 정렬 (빈 값은 맨 아래)
    return [...rows].sort((a, b) => {
      const da = a.award_date || "";
      const db = b.award_date || "";
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db.localeCompare(da);
    });
  }, [data, filter, statusF, recommenderF]);

  const onStatusChange = async (row: CaseRow, newStatus: string) => {
    if (row.status === newStatus) return;
    try {
      await updateCase(row.id, { status: newStatus });
      setData(d =>
        d
          ? {
              ...d,
              rows: d.rows.map(r =>
                r.id === row.id ? { ...r, status: newStatus } : r
              ),
            }
          : d
      );
    } catch (err: any) {
      alert(
        "상태 저장 실패: " +
          (err?.response?.data?.detail || err?.message || "")
      );
    }
  };

  const onRecommenderChange = async (row: CaseRow, newName: string) => {
    if ((row.recommender_name || "") === newName) return;
    try {
      await updateCase(row.id, { recommender_name: newName });
      setData(d =>
        d
          ? {
              ...d,
              rows: d.rows.map(r =>
                r.id === row.id ? { ...r, recommender_name: newName } : r
              ),
            }
          : d
      );
    } catch (err: any) {
      alert(
        "추천의원 변경 실패: " +
          (err?.response?.data?.detail || err?.message || "")
      );
    }
  };

  if (loading) return <div className="text-ink-500">불러오는 중...</div>;
  if (!data) return <div className="text-ink-500">데이터를 불러올 수 없습니다.</div>;

  const totalRecipients = filtered.reduce((s, r) => s + r.recipient_count, 0);

  return (
    <div>
      <div className="krds-page-header">
        <div>
          <h1 className="krds-page-title">표창 관리</h1>
          <p className="krds-page-sub">
            전체 {filtered.length}건 / 대상자 {totalRecipients}명 · 현재 회기{" "}
            {fmtDate(data.term_start)} ~ {fmtDate(data.term_end)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="md"
            onClick={() => navigate("/cases/new")}
            className="w-full sm:w-auto"
          >
            <span aria-hidden>＋</span> 새 표창 건 만들기
          </Button>
          <Button
            size="md"
            variant="secondary"
            onClick={() => navigate("/trash")}
            className="w-full sm:w-auto"
          >
            🗑 휴지통
          </Button>
        </div>
      </div>

      <div className="krds-card krds-card-pad mb-4 space-y-2">
        <input
          type="text"
          placeholder="의원명·표창건명·대상자·신청자로 검색"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-ink-500">상태</label>
          <select
            value={statusF}
            onChange={e => setStatusF(e.target.value)}
            className="rounded-lg border border-ink-300 px-2 py-1.5 text-sm"
          >
            <option value="">전체</option>
            {CASE_STATUSES.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <label className="text-xs text-ink-500 ml-2">추천의원</label>
          <select
            value={recommenderF}
            onChange={e => setRecommenderF(e.target.value)}
            className="rounded-lg border border-ink-300 px-2 py-1.5 text-sm"
          >
            <option value="">전체</option>
            {recommenderOptions.map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          {(statusF || recommenderF || filter) && (
            <button
              type="button"
              onClick={() => {
                setFilter("");
                setStatusF("");
                setRecommenderF("");
              }}
              className="ml-2 text-xs text-brand-700 hover:underline"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* 데스크탑/태블릿 */}
      <div className="hidden md:block krds-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="krds-table">
            <thead>
              <tr>
                <th className="w-12 text-center">No</th>
                <th>상태</th>
                <th>표창건명</th>
                <th>훈격</th>
                <th>추천의원</th>
                <th className="text-center">인원</th>
                <th>대상자</th>
                <th>공적제출일</th>
                <th>발급목표일</th>
                <th>표창일 ↓</th>
                <th className="text-right">조치</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center text-ink-500 py-8">
                    해당하는 표창 건이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr key={r.id} className={rowHighlight(r)}>
                    <td className="text-center text-ink-500">{idx + 1}</td>
                    <td>
                      <StatusSelector row={r} onChange={onStatusChange} />
                    </td>
                    <td>
                      <Link to={`/cases/${r.id}`} className="krds-link">
                        {r.title}
                      </Link>
                      {isExternal(r) && (
                        <span
                          className="krds-badge bg-amber-100 text-amber-800 ml-1.5 align-middle whitespace-nowrap"
                          title="외부에서 접수된 신청입니다."
                        >
                          외부신청
                        </span>
                      )}
                    </td>
                    <td>
                      {r.award_grade ? (
                        <span className="krds-badge krds-badge-brand whitespace-nowrap">
                          {r.award_grade}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="font-semibold">
                      <RecommenderSelect
                        row={r}
                        legislators={legislators}
                        onChange={onRecommenderChange}
                      />
                      {r.chair_sign && (
                        <span
                          className="krds-badge krds-badge-accent mt-1 inline-block"
                          title="문서가 위원장 명의로 출력됩니다(쿼터 통계는 원래 추천의원에 집계)."
                        >
                          위원장 명의로 제출
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className="krds-badge krds-badge-ink">
                        {r.recipient_count}명
                      </span>
                    </td>
                    <td
                      className="text-ink-700 break-words whitespace-normal align-top"
                      style={{ maxWidth: 180 }}
                    >
                      {r.recipient_names.join(", ") || "-"}
                    </td>
                    <td className="text-ink-700 whitespace-nowrap">{r.recommendation_date || "-"}</td>
                    <td className="text-ink-700 whitespace-nowrap">{r.target_issue_date || "-"}</td>
                    <td className="text-ink-700 whitespace-nowrap">
                      {r.award_date || "-"}
                      {(r.award_date_count || 0) > 1 && (
                        <span className="text-ink-500">
                          {" "}외 {(r.award_date_count || 1) - 1}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => onDelete(r)}
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
      </div>

      {/* 모바일 */}
      <ul className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <li className="krds-card krds-card-pad text-center text-ink-500">
            해당하는 표창 건이 없습니다.
          </li>
        ) : (
          filtered.map(r => (
            <li
              key={r.id}
              className={`krds-card krds-card-pad ${
                isDone(r)
                  ? "bg-ink-100 opacity-70"
                  : isExternal(r)
                  ? "bg-amber-50 border-amber-200"
                  : ""
              }`}
            >
              <Link
                to={`/cases/${r.id}`}
                className="inline-flex items-center gap-1.5 text-base font-bold text-ink-900 hover:text-brand-700"
              >
                {r.title}
                {isExternal(r) && (
                  <span className="krds-badge bg-amber-100 text-amber-800 whitespace-nowrap">
                    외부신청
                  </span>
                )}
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusSelector row={r} onChange={onStatusChange} />
                {r.award_grade && (
                  <span className="krds-badge krds-badge-brand">
                    {r.award_grade}
                  </span>
                )}
                <span className="krds-badge krds-badge-ink">
                  {r.recommender_name || "추천자 미지정"}
                </span>
                {r.chair_sign && (
                  <span
                    className="krds-badge krds-badge-accent"
                    title="문서가 위원장 명의로 출력됩니다(쿼터 통계는 원래 추천의원에 집계)."
                  >
                    위원장 명의로 제출
                  </span>
                )}
                <span className="krds-badge krds-badge-ink">
                  {r.recipient_count}명
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
                <dt className="text-ink-500">대상자</dt>
                <dd className="col-span-2 text-ink-800">
                  {r.recipient_names.join(", ") || "-"}
                </dd>
                <dt className="text-ink-500">신청자</dt>
                <dd className="col-span-2 text-ink-800">
                  {r.applicant_name || "-"}
                </dd>
                <dt className="text-ink-500">공적제출일</dt>
                <dd className="col-span-2 text-ink-800">
                  {r.recommendation_date || "-"}
                </dd>
                <dt className="text-ink-500">발급목표일</dt>
                <dd className="col-span-2 text-ink-800">
                  {r.target_issue_date || "-"}
                </dd>
                <dt className="text-ink-500">표창일</dt>
                <dd className="col-span-2 text-ink-800">
                  {r.award_date || "-"}
                  {(r.award_date_count || 0) > 1 && (
                    <span className="text-ink-500">
                      {" "}외 {(r.award_date_count || 1) - 1}일(대상자별)
                    </span>
                  )}
                </dd>
              </dl>
              <div className="mt-4 flex justify-end">
                <Button size="sm" variant="danger" onClick={() => onDelete(r)}>
                  삭제
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>

      {(data.rows.length || 0) > 0 && (
        <div className="mt-8 rounded-lg border border-danger-200 bg-danger-50/40 p-4">
          <h2 className="text-sm font-bold text-danger-700">전체 삭제</h2>
          <p className="text-xs text-ink-600 mt-0.5">
            관리 중인 표창건을 한 번에 휴지통으로 보냅니다 (휴지통에서 복구 가능).
          </p>
          <div className="mt-3">
            <Button size="sm" variant="ghost" onClick={onTrashAll}>
              전체 삭제 (휴지통으로)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y}.${m}.${d}.`;
}

function RecommenderSelect({
  row,
  legislators,
  onChange,
}: {
  row: CaseRow;
  legislators: Legislator[];
  onChange: (row: CaseRow, name: string) => void;
}) {
  const cur = row.recommender_name || "";
  // 현재 추천의원이 명단에 없으면(과거 데이터 등) 옵션에 포함시켜 유지
  const names = legislators.map(l => l.name);
  const options = names.includes(cur) || !cur ? names : [cur, ...names];
  return (
    <select
      value={cur}
      onChange={e => onChange(row, e.target.value)}
      className="text-sm rounded border border-ink-300 px-1.5 py-1 bg-white focus:ring-2 focus:ring-brand-500 outline-none"
      title="추천의원 변경 (의원 쿼터가 차면 위원장으로 변경 가능)"
    >
      {!cur && <option value="">미지정</option>}
      {options.map(n => {
        const leg = legislators.find(l => l.name === n);
        return (
          <option key={n} value={n}>
            {n}
            {leg?.is_chair ? " (위원장)" : ""}
          </option>
        );
      })}
    </select>
  );
}

function StatusSelector({
  row,
  onChange,
}: {
  row: CaseRow;
  onChange: (row: CaseRow, status: string) => void;
}) {
  const cur = row.status || "예정";
  const color = STATUS_COLOR[cur] || "bg-ink-100 text-ink-700";
  return (
    <select
      value={cur}
      onChange={e => onChange(row, e.target.value)}
      className={`text-xs font-semibold rounded px-2 py-1 border-none focus:ring-2 focus:ring-brand-500 outline-none ${color}`}
      title={CASE_STATUS_LABELS[cur] || ""}
    >
      {CASE_STATUSES.map(s => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
