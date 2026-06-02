import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getQuotaStatus, setGovernorMark } from "../api";
import type { QuotaResponse } from "../api/dashboards";
import { Button } from "../components/Field";

export default function QuotaPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [savingGov, setSavingGov] = useState<string | null>(null);

  // 경기도지사 표창 사용 체크/해제 — 낙관적 갱신 후 실패 시 롤백
  const onToggleGovernor = async (name: string, next: boolean) => {
    setSavingGov(name);
    setData(prev =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map(r =>
              r.legislator_name === name ? { ...r, governor_used: next } : r
            ),
          }
        : prev
    );
    try {
      await setGovernorMark(name, next);
    } catch {
      setData(prev =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map(r =>
                r.legislator_name === name
                  ? { ...r, governor_used: !next }
                  : r
              ),
            }
          : prev
      );
      alert("도지사 표창 체크 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSavingGov(null);
    }
  };

  const applyUrl =
    typeof window !== "undefined" ? `${window.location.origin}/apply` : "/apply";

  const goToCases = (name: string) =>
    navigate(`/?legislator=${encodeURIComponent(name)}`);

  const onCopyApplyUrl = async () => {
    try {
      await navigator.clipboard.writeText(applyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("복사에 실패했습니다. 수동으로 복사해 주세요.");
    }
  };

  useEffect(() => {
    setLoading(true);
    getQuotaStatus()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-ink-500">불러오는 중...</div>;
  if (!data) return <div className="text-ink-500">데이터를 불러올 수 없습니다.</div>;

  const totalUsed = data.rows.reduce((s, r) => s + r.used, 0);
  const totalCases = data.rows.reduce((s, r) => s + r.case_count, 0);

  return (
    <div>
      <div className="krds-page-header">
        <div>
          <h1 className="krds-page-title">의원 쿼터 현황</h1>
          <p className="krds-page-sub">
            의장 표창: 회기년도 {fmtDate(data.term_start)} ~ {fmtDate(data.term_end)} ·
            의원당 100명 한도(위원장 무제한) · 케이스 {totalCases}건 / 대상자{" "}
            {totalUsed}명
          </p>
          <p className="krds-page-sub mt-0.5">
            경기도지사 표창: {fmtDate(data.calendar_start)} ~{" "}
            {fmtDate(data.calendar_end)} (임기 기준) · 의원당 1명 — 처리하면
            체크만 하세요
          </p>
        </div>
      </div>

      {/* 민간인·기관 신청용 URL 안내 카드 */}
      <div className="krds-card krds-card-pad mb-5 border-brand-200 bg-brand-50/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-brand-700">
              민간인·기관 신청용 URL
            </h2>
            <p className="text-xs text-ink-600 mt-0.5">
              아래 주소를 복사해서 신청자에게 전달하세요. 신청 폼이 제출되면
              전체 표창 현황에 자동으로 추가됩니다.
            </p>
            <code className="block mt-2 px-2 py-1.5 rounded bg-white border border-ink-200 text-xs sm:text-sm text-ink-800 break-all">
              {applyUrl}
            </code>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="secondary" onClick={onCopyApplyUrl}>
              {copied ? "복사됨 ✓" : "URL 복사"}
            </Button>
            <a
              href={applyUrl}
              target="_blank"
              rel="noreferrer"
              className="krds-link text-sm self-center"
            >
              새 탭에서 열기 ↗
            </a>
          </div>
        </div>
      </div>

      {/* 데스크탑 / 태블릿 */}
      <div className="hidden md:block krds-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="krds-table">
            <thead>
              <tr>
                <th className="w-14 text-center">No</th>
                <th>의원명</th>
                <th>정당</th>
                <th>담당자</th>
                <th className="text-center">최대 쿼터</th>
                <th className="text-center">사용</th>
                <th className="text-center">남은</th>
                <th className="text-center">진행률</th>
                <th className="text-center">케이스 수</th>
                <th className="text-center">도지사 표창<br /><span className="text-[10px] font-normal text-ink-400">처리 시 체크(연 1건)</span></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, idx) => (
                <QuotaTableRow
                  key={r.legislator_name}
                  idx={idx}
                  r={r}
                  onName={() => goToCases(r.legislator_name)}
                  onToggleGovernor={onToggleGovernor}
                  savingGov={savingGov === r.legislator_name}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 모바일 */}
      <ul className="md:hidden space-y-3">
        {data.rows.map(r => (
          <li key={r.legislator_name} className="krds-card krds-card-pad">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-ink-900">
                <button
                  type="button"
                  onClick={() => goToCases(r.legislator_name)}
                  className="krds-link hover:underline"
                >
                  {r.legislator_name}
                </button>
                {r.is_chair && (
                  <span className="ml-2 krds-badge krds-badge-brand">
                    위원장
                  </span>
                )}
              </h3>
              <span
                className={
                  "krds-badge " +
                  partyBadgeClass(r.party)
                }
              >
                {r.party}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <dt className="text-ink-500">사용</dt>
              <dd className="col-span-2 text-ink-800 font-semibold">
                {r.used}명{" "}
                <span className="text-ink-400 font-normal">
                  / {r.is_chair ? "무제한" : `${r.max_quota}명`}
                </span>
              </dd>
              <dt className="text-ink-500">남은</dt>
              <dd
                className={
                  "col-span-2 font-semibold " +
                  (r.is_chair
                    ? "text-ink-800"
                    : (r.remaining ?? 0) < 0
                    ? "text-danger-600"
                    : (r.remaining ?? 0) <= 10
                    ? "text-warn-600"
                    : "text-success-600")
                }
              >
                {r.is_chair ? "무제한" : `${r.remaining}명`}
              </dd>
              <dt className="text-ink-500">케이스</dt>
              <dd className="col-span-2 text-ink-800">{r.case_count}건</dd>
              <dt className="text-ink-500">도지사 표창</dt>
              <dd className="col-span-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-600 cursor-pointer disabled:opacity-50"
                    checked={r.governor_used}
                    disabled={savingGov === r.legislator_name}
                    onChange={e =>
                      onToggleGovernor(r.legislator_name, e.target.checked)
                    }
                  />
                  <span
                    className={
                      "font-semibold " +
                      (r.governor_used ? "text-success-700" : "text-ink-500")
                    }
                  >
                    {r.governor_used ? "사용함" : "미사용"}
                  </span>
                </label>
              </dd>
            </dl>
            {!r.is_chair && (
              <ProgressBar used={r.used} max={r.max_quota || 100} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuotaTableRow({
  idx,
  r,
  onName,
  onToggleGovernor,
  savingGov,
}: {
  idx: number;
  r: import("../api/dashboards").QuotaRow;
  onName: () => void;
  onToggleGovernor: (name: string, next: boolean) => void;
  savingGov: boolean;
}) {
  const remaining = r.remaining ?? 0;
  const danger = !r.is_chair && remaining < 0;
  const warn = !r.is_chair && remaining >= 0 && remaining <= 10;
  return (
    <tr>
      <td className="text-center text-ink-500">{idx + 1}</td>
      <td className="font-semibold">
        <button
          type="button"
          onClick={onName}
          className="krds-link hover:underline"
          title="이 의원의 표창 현황 보기"
        >
          {r.legislator_name}
        </button>
        {r.is_chair && (
          <span className="ml-2 krds-badge krds-badge-brand">위원장</span>
        )}
      </td>
      <td>
        <span
          className={
            "krds-badge " +
            partyBadgeClass(r.party)
          }
        >
          {r.party}
        </span>
      </td>
      <td className="text-ink-600">{r.staff || "-"}</td>
      <td className="text-center">{r.is_chair ? "무제한" : `${r.max_quota}명`}</td>
      <td className="text-center font-semibold">{r.used}</td>
      <td
        className={
          "text-center font-bold " +
          (danger
            ? "text-danger-600"
            : warn
            ? "text-warn-600"
            : "text-success-700")
        }
      >
        {r.is_chair ? "무제한" : remaining}
      </td>
      <td className="text-center" style={{ minWidth: 120 }}>
        {r.is_chair ? (
          <span className="text-ink-400 text-xs">—</span>
        ) : (
          <ProgressBar used={r.used} max={r.max_quota || 100} />
        )}
      </td>
      <td className="text-center text-ink-700">{r.case_count}건</td>
      <td className="text-center" title="경기도지사 표창 처리 완료 시 체크(연 1건)">
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand-600 cursor-pointer disabled:opacity-50"
          checked={r.governor_used}
          disabled={savingGov}
          onChange={e => onToggleGovernor(r.legislator_name, e.target.checked)}
          aria-label={`${r.legislator_name} 경기도지사 표창 사용 체크`}
        />
      </td>
    </tr>
  );
}

function ProgressBar({ used, max }: { used: number; max: number }) {
  const ratio = max > 0 ? Math.min(used / max, 1) : 0;
  const overflow = used > max;
  const pct = Math.round(ratio * 100);
  const color = overflow
    ? "bg-danger-500"
    : pct >= 90
    ? "bg-warn-500"
    : "bg-success-500";
  return (
    <div className="w-full">
      <div className="h-2 w-full rounded bg-ink-100 overflow-hidden">
        <div
          className={`h-full ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="mt-0.5 text-[10px] text-ink-500">
        {pct}% {overflow && <span className="text-danger-600">초과</span>}
      </div>
    </div>
  );
}

function fmtDate(iso: string): string {
  // "2025-07-01" -> "2025.07.01."
  const [y, m, d] = iso.split("-");
  return `${y}.${m}.${d}.`;
}

// 정당은 자유 입력 — 민주/국힘은 기존 색, 그 외(또는 빈 값)는 회색 배지
function partyBadgeClass(party?: string): string {
  if (party === "민주") return "krds-badge-democratic";
  if (party === "국힘") return "krds-badge-people";
  return "krds-badge-ink";
}
