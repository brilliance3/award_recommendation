import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listTrash,
  restoreCase,
  permanentDeleteCase,
  restoreAllCases,
  emptyTrash,
} from "../api";
import type { AwardCase } from "../types";
import { Button } from "../components/Field";

export default function TrashPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<AwardCase[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    listTrash()
      .then(setCases)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onRestore = async (id: string) => {
    await restoreCase(id);
    load();
  };
  const onPermanent = async (id: string) => {
    if (!confirm("이 표창 건을 완전히 삭제합니다. 되돌릴 수 없습니다. 계속할까요?"))
      return;
    await permanentDeleteCase(id);
    load();
  };
  const onRestoreAll = async () => {
    if (cases.length === 0) return;
    if (!confirm(`휴지통의 ${cases.length}건을 모두 관리로 복구합니다. 계속할까요?`))
      return;
    await restoreAllCases();
    load();
  };
  const onEmpty = async () => {
    if (cases.length === 0) return;
    if (
      !confirm(
        `휴지통을 비웁니다. ${cases.length}건이 영구 삭제되며 되돌릴 수 없습니다. 계속할까요?`
      )
    )
      return;
    await emptyTrash();
    load();
  };

  const recommender = (c: AwardCase) =>
    [c.recommender_department, c.recommender_position, c.recommender_name]
      .filter(Boolean)
      .join(" ") || "-";

  return (
    <div>
      <div className="krds-page-header">
        <div>
          <h1 className="krds-page-title">휴지통</h1>
          <p className="krds-page-sub">
            삭제된 표창 건입니다. 관리로 복구하거나 완전히 삭제할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate("/")}>
            ← 관리로
          </Button>
          <Button variant="ghost" onClick={onRestoreAll} disabled={!cases.length}>
            전체 복구
          </Button>
          <Button variant="danger" onClick={onEmpty} disabled={!cases.length}>
            휴지통 비우기
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-ink-500">불러오는 중...</div>
      ) : cases.length === 0 ? (
        <div className="krds-card krds-card-pad text-center py-12 text-ink-500">
          휴지통이 비어 있습니다.
        </div>
      ) : (
        <>
          {/* 데스크탑 */}
          <div className="hidden md:block krds-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="krds-table">
                <thead>
                  <tr>
                    <th className="w-[34%]">표창 건명</th>
                    <th>훈격</th>
                    <th>추천자</th>
                    <th className="text-right">조치</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map(c => (
                    <tr key={c.id}>
                      <td className="font-medium text-ink-900">{c.title}</td>
                      <td>
                        <span className="krds-badge krds-badge-ink">
                          {c.award_grade}
                        </span>
                      </td>
                      <td className="text-ink-700">{recommender(c)}</td>
                      <td className="text-right">
                        <div className="inline-flex gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onRestore(c.id)}
                          >
                            복구
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => onPermanent(c.id)}
                          >
                            완전 삭제
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 모바일 */}
          <ul className="md:hidden space-y-3">
            {cases.map(c => (
              <li key={c.id} className="krds-card krds-card-pad">
                <div className="text-base font-bold text-ink-900">{c.title}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="krds-badge krds-badge-ink">{c.award_grade}</span>
                </div>
                <div className="mt-2 text-xs text-ink-700">{recommender(c)}</div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onRestore(c.id)}
                  >
                    복구
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => onPermanent(c.id)}
                  >
                    완전 삭제
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
