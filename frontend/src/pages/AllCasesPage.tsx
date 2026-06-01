import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getAllCases, updateCase, listLegislators } from "../api";
import type { CasesResponse, CaseRow } from "../api/dashboards";
import { CASE_STATUSES, CASE_STATUS_LABELS } from "../api/dashboards";
import type { Legislator } from "../api/settings";

const STATUS_COLOR: Record<string, string> = {
  대기: "bg-ink-100 text-ink-700",
  예정: "bg-blue-100 text-blue-700",
  진행: "bg-amber-100 text-amber-700",
  보관: "bg-purple-100 text-purple-700",
  완료: "bg-emerald-100 text-emerald-700",
  취소: "bg-red-100 text-red-700",
};

export default function AllCasesPage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<CasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [statusF, setStatusF] = useState("");
  const [recommenderF, setRecommenderF] = useState(
    searchParams.get("legislator") || ""
  );
  const [legislators, setLegislators] = useState<Legislator[]>([]);

  useEffect(() => {
    listLegislators().then(setLegislators).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getAllCases()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

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
          <h1 className="krds-page-title">전체 표창 현황</h1>
          <p className="krds-page-sub">
            회기년도 {fmtDate(data.term_start)} ~ {fmtDate(data.term_end)} ·{" "}
            {filtered.length}건 / 대상자 {totalRecipients}명
          </p>
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
                <th>추천의원</th>
                <th className="text-center">인원</th>
                <th>대상자</th>
                <th>공적제출일</th>
                <th>발급목표일</th>
                <th>표창일 ↓</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-ink-500 py-8">
                    해당하는 표창 건이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="text-center text-ink-500">{idx + 1}</td>
                    <td>
                      <StatusSelector row={r} onChange={onStatusChange} />
                    </td>
                    <td>
                      <Link to={`/cases/${r.id}`} className="krds-link">
                        {r.title}
                      </Link>
                    </td>
                    <td className="font-semibold">
                      <RecommenderSelect
                        row={r}
                        legislators={legislators}
                        onChange={onRecommenderChange}
                      />
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
                    <td className="text-ink-700 whitespace-nowrap">{r.award_date || "-"}</td>
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
            <li key={r.id} className="krds-card krds-card-pad">
              <Link
                to={`/cases/${r.id}`}
                className="block text-base font-bold text-ink-900 hover:text-brand-700"
              >
                {r.title}
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusSelector row={r} onChange={onStatusChange} />
                <span className="krds-badge krds-badge-brand">
                  {r.recommender_name || "추천자 미지정"}
                </span>
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
                </dd>
              </dl>
            </li>
          ))
        )}
      </ul>
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
