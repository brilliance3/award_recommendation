import { useEffect, useState } from "react";
import { statsApi, type CategoryStat, type CommitteeStat, type MemberStat, type OverviewStats } from "../api/stats";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "초안", cls: "krds-status-draft" },
  invited: { label: "작성중", cls: "krds-status-invited" },
  submitted_by_recipient: { label: "제출완료", cls: "krds-status-submitted" },
  approved: { label: "승인", cls: "krds-status-approved" },
  rejected: { label: "반려", cls: "krds-status-rejected" },
};

export default function StatsPage() {
  const [ov, setOv] = useState<OverviewStats | null>(null);
  const [coms, setComs] = useState<CommitteeStat[]>([]);
  const [mems, setMems] = useState<MemberStat[]>([]);
  const [cats, setCats] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      statsApi.overview(),
      statsApi.byCommittee(),
      statsApi.byMember(),
      statsApi.byMeritCategory(),
    ])
      .then(([o, c, m, ca]) => {
        setOv(o);
        setComs(c);
        setMems(m);
        setCats(ca);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !ov) return <div className="text-ink-500">불러오는 중...</div>;

  const maxComR = Math.max(...coms.map(c => c.recipients), 1);
  const maxMemR = Math.max(...mems.map(m => m.recipients), 1);
  const maxCatC = Math.max(...cats.map(c => c.count), 1);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="krds-page-header">
        <div>
          <h1 className="krds-page-title">통계 현황</h1>
          <p className="krds-page-sub">
            의원·상임위·공적분야별 추천 현황 통계
          </p>
        </div>
      </div>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <SummaryCard label="전체 표창 건" value={ov.total_cases} unit="건" color="brand" />
        <SummaryCard label="전체 대상자" value={ov.total_recipients} unit="명" color="accent" />
        <SummaryCard label="등록 의원" value={ov.total_council_members} unit="명" color="ink" />
        <SummaryCard
          label="제출 완료"
          value={ov.by_recipient_status.submitted_by_recipient || 0}
          unit="명"
          color="accent"
        />
      </div>

      {/* 처리 상태 분포 */}
      <section className="krds-card krds-card-pad">
        <h2 className="krds-section-title mb-3">처리 상태 분포</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ov.by_recipient_status).map(([s, n]) => {
            const meta = STATUS_LABEL[s] || { label: s, cls: "krds-status-draft" };
            return (
              <span key={s} className={`krds-status ${meta.cls}`}>
                {meta.label} {n}명
              </span>
            );
          })}
          {Object.keys(ov.by_recipient_status).length === 0 && (
            <span className="text-sm text-ink-500">데이터 없음</span>
          )}
        </div>
      </section>

      {/* 훈격 분포 */}
      <section className="krds-card krds-card-pad">
        <h2 className="krds-section-title mb-3">훈격별 표창 건수</h2>
        <ul className="space-y-1.5">
          {Object.entries(ov.by_award_grade).map(([g, n]) => (
            <li key={g} className="flex items-center justify-between text-sm">
              <span className="krds-badge krds-badge-brand">{g}</span>
              <span className="text-ink-700 font-semibold">{n}건</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 상임위별 */}
      <section className="krds-card krds-card-pad">
        <h2 className="krds-section-title mb-3">상임위별 추천 현황</h2>
        <div className="space-y-2">
          {coms.map(c => (
            <div key={c.committee}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">{c.committee}</span>
                <span className="text-ink-500">{c.cases}건 · {c.recipients}명</span>
              </div>
              <div className="h-2 bg-ink-100 rounded">
                <div
                  className="h-2 bg-brand-500 rounded"
                  style={{ width: `${(c.recipients / maxComR) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {coms.length === 0 && <p className="text-sm text-ink-500">데이터 없음</p>}
        </div>
      </section>

      {/* 의원별 (상위 15명) */}
      <section className="krds-card krds-card-pad">
        <h2 className="krds-section-title mb-3">의원별 추천 현황 (상위 15명)</h2>
        <div className="overflow-x-auto">
          <table className="krds-table">
            <thead>
              <tr>
                <th>의원</th>
                <th>정당</th>
                <th>지역구</th>
                <th>상임위</th>
                <th className="text-right">건수</th>
                <th className="text-right">대상자</th>
                <th className="w-[28%]">분포</th>
              </tr>
            </thead>
            <tbody>
              {mems.slice(0, 15).map(m => (
                <tr key={m.name}>
                  <td className="font-semibold">{m.name}</td>
                  <td>{m.party || "-"}</td>
                  <td>{m.district || "-"}</td>
                  <td>{m.committee || "-"}</td>
                  <td className="text-right">{m.cases}</td>
                  <td className="text-right font-semibold text-brand-700">{m.recipients}</td>
                  <td>
                    <div className="h-2 bg-ink-100 rounded">
                      <div
                        className="h-2 bg-accent-500 rounded"
                        style={{ width: `${(m.recipients / maxMemR) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {mems.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-ink-500 py-6">
                    데이터 없음
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 공적분야별 */}
      <section className="krds-card krds-card-pad">
        <h2 className="krds-section-title mb-3">공적분야별 대상자 분포</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {cats.map(c => (
            <div key={c.category} className="flex items-center gap-3">
              <span className="text-sm font-medium w-32 truncate">{c.category}</span>
              <div className="flex-1 h-2 bg-ink-100 rounded">
                <div
                  className="h-2 bg-brand-500 rounded"
                  style={{ width: `${(c.count / maxCatC) * 100}%` }}
                />
              </div>
              <span className="text-sm text-ink-700 w-12 text-right">{c.count}명</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label, value, unit, color,
}: { label: string; value: number; unit: string; color: "brand" | "accent" | "ink" }) {
  const cls = {
    brand: "bg-brand-50 text-brand-800 border-brand-200",
    accent: "bg-accent-50 text-accent-800 border-accent-200",
    ink: "bg-ink-50 text-ink-800 border-ink-200",
  }[color];
  return (
    <div className={`krds-card krds-card-pad border ${cls}`}>
      <div className="text-xs font-semibold opacity-80">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold">{value.toLocaleString()}</span>
        <span className="text-sm opacity-70">{unit}</span>
      </div>
    </div>
  );
}
