import { useEffect, useMemo, useState } from "react";
import { councilApi } from "../api";
import type { CouncilCommittee, CouncilMember } from "../types";

interface Props {
  onSelect: (m: CouncilMember) => void;
  placeholder?: string;
}

/**
 * 경기도의회 의원 선택 콤보 박스.
 * - 상임위 필터 + 이름/지역구 검색
 * - 선택 시 onSelect 콜백
 *
 * 사용 예:
 *   <CouncilMemberPicker
 *     onSelect={(m) => {
 *       setForm({ ...form, recommender_name: m.name, ... });
 *     }}
 *   />
 */
export default function CouncilMemberPicker({ onSelect, placeholder }: Props) {
  const [committees, setCommittees] = useState<CouncilCommittee[]>([]);
  const [members, setMembers] = useState<CouncilMember[]>([]);
  const [committee, setCommittee] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    councilApi.listCommittees().then(setCommittees).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (committee) params.committee = committee;
    if (q) params.q = q;
    councilApi
      .listMembers(params)
      .then(setMembers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [committee, q]);

  const grouped = useMemo(() => {
    const byCommittee: Record<string, CouncilMember[]> = {};
    for (const m of members) {
      const key = m.council_role
        ? `🏛️ ${m.council_role}`
        : m.committee_name || "기타";
      if (!byCommittee[key]) byCommittee[key] = [];
      byCommittee[key].push(m);
    }
    return byCommittee;
  }, [members]);

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          className="krds-input flex-1"
          value={committee}
          onChange={(e) => setCommittee(e.target.value)}
        >
          <option value="">상임위 전체</option>
          {committees.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className="krds-input flex-1"
          placeholder={placeholder || "이름/지역구 검색 (예: 강웅철, 수원시)"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="border border-ink-200 rounded max-h-64 overflow-y-auto">
        {loading ? (
          <div className="p-3 text-sm text-ink-500">불러오는 중…</div>
        ) : members.length === 0 ? (
          <div className="p-3 text-sm text-ink-500">검색 결과가 없습니다.</div>
        ) : (
          Object.entries(grouped).map(([groupName, items]) => (
            <div key={groupName}>
              <div className="px-3 py-1 bg-ink-50 text-xs font-semibold text-ink-700">
                {groupName} ({items.length})
              </div>
              {items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelect(m)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 border-t border-ink-100 flex flex-col"
                >
                  <span className="font-medium">
                    {m.name}{" "}
                    {m.chinese_name && (
                      <span className="text-xs text-ink-500">({m.chinese_name})</span>
                    )}
                    {m.council_role && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                        {m.council_role}
                      </span>
                    )}
                    {m.committee_role && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">
                        {m.committee_role}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-ink-600">
                    {m.party} · {m.district}
                    {m.committee_name && ` · ${m.committee_name}`}
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
