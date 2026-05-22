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
  useEffect(() => { load(); }, [caseId]);

  if (!detail) return <div className="text-slate-500">불러오는 중...</div>;

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
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold">{detail.title}</h1>
          <div className="text-sm text-slate-500">
            {detail.award_grade} · {detail.recommender_full_title} {detail.recommender_name}
          </div>
        </div>
        <div className="space-x-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>XLSX 업로드</Button>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={onUploadXlsx} />
          <Button onClick={() => navigate(`/cases/${caseId}/recipients/new`)}>+ 대상자 추가</Button>
          <Button variant="secondary" onClick={() => navigate(`/cases/${caseId}/download`)}>문서 생성</Button>
        </div>
      </div>

      <div className="bg-white rounded shadow border overflow-hidden mt-6">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-center px-4 py-2 w-12">No</th>
              <th className="text-left px-4 py-2">성명</th>
              <th className="text-left px-4 py-2">생년월일</th>
              <th className="text-left px-4 py-2">소속</th>
              <th className="text-left px-4 py-2">직위</th>
              <th className="text-left px-4 py-2">공적분야</th>
              <th className="text-right px-4 py-2">조치</th>
            </tr>
          </thead>
          <tbody>
            {detail.recipients.length === 0 ? (
              <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={7}>대상자가 없습니다</td></tr>
            ) : detail.recipients.map(r => (
              <tr key={r.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 text-center">{r.sequence_no}</td>
                <td className="px-4 py-3 font-semibold">
                  <Link className="hover:underline" to={`/recipients/${r.id}`}>{r.recipient_name}</Link>
                </td>
                <td className="px-4 py-3">{r.birth_date || "-"}</td>
                <td className="px-4 py-3">{r.organization_name || "-"}</td>
                <td className="px-4 py-3">{r.recipient_position_title || "-"}</td>
                <td className="px-4 py-3">{r.merit_category || "-"}</td>
                <td className="px-4 py-3 text-right space-x-1">
                  <Button variant="secondary" onClick={() => navigate(`/recipients/${r.id}/merit`)}>공적</Button>
                  <Button variant="secondary" onClick={() => navigate(`/recipients/${r.id}/preview`)}>미리보기</Button>
                  <Button variant="ghost" onClick={() => onDelete(r.id)}>삭제</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
