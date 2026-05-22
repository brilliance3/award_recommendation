import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteCase, listCases } from "../api";
import type { AwardCase } from "../types";
import { Button } from "../components/Field";

export default function DashboardPage() {
  const [cases, setCases] = useState<AwardCase[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    listCases()
      .then(setCases)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onDelete = async (id: string) => {
    if (!confirm("이 표창 건과 관련 대상자·문서를 모두 삭제합니다. 계속할까요?")) return;
    await deleteCase(id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">표창 건 목록</h1>
        <Button onClick={() => navigate("/cases/new")}>+ 새 표창 건 만들기</Button>
      </div>

      {loading ? (
        <div className="text-slate-500">불러오는 중...</div>
      ) : cases.length === 0 ? (
        <div className="bg-white rounded border border-dashed border-slate-300 p-10 text-center text-slate-500">
          아직 표창 건이 없습니다.
          <div className="mt-3">
            <Button onClick={() => navigate("/cases/new")}>지금 만들기</Button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded shadow border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="text-left px-4 py-2">표창 건명</th>
                <th className="text-left px-4 py-2">훈격</th>
                <th className="text-left px-4 py-2">추천자</th>
                <th className="text-left px-4 py-2">표창일</th>
                <th className="text-center px-4 py-2">대상자</th>
                <th className="text-right px-4 py-2">조치</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => (
                <tr key={c.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/cases/${c.id}`} className="font-semibold text-slate-900 hover:underline">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{c.award_grade}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {[c.recommender_department, c.recommender_position, c.recommender_name].filter(Boolean).join(" ")}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{c.award_date || "-"}</td>
                  <td className="px-4 py-3 text-center">{c.recipient_count}명</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button variant="secondary" onClick={() => navigate(`/cases/${c.id}`)}>대상자</Button>
                    <Button variant="secondary" onClick={() => navigate(`/cases/${c.id}/download`)}>문서</Button>
                    <Button variant="ghost" onClick={() => onDelete(c.id)}>삭제</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
