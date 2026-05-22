import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { generateAll, generateXlsx, generateZip, getCase } from "../api";
import type { AwardCaseDetail, GeneratedFileInfo } from "../types";
import { Button } from "../components/Field";

export default function DownloadPage() {
  const { caseId = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<AwardCaseDetail | null>(null);
  const [files, setFiles] = useState<GeneratedFileInfo[]>([]);
  const [zipFile, setZipFile] = useState<GeneratedFileInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getCase(caseId).then(setDetail); }, [caseId]);

  if (!detail) return <div className="text-slate-500">불러오는 중...</div>;

  const onGenXlsx = async () => {
    setBusy(true);
    try { setFiles((await generateXlsx(caseId)).files); }
    finally { setBusy(false); }
  };
  const onGenAll = async () => {
    setBusy(true);
    try { setFiles((await generateAll(caseId)).files); }
    finally { setBusy(false); }
  };
  const onGenZip = async () => {
    setBusy(true);
    try { setZipFile(await generateZip(caseId)); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{detail.title} - 문서 생성</h1>
      <div className="text-sm text-slate-500 mb-6">대상자 {detail.recipient_count}명</div>

      <div className="bg-white shadow rounded p-6 space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" disabled={busy} onClick={onGenXlsx}>01·03 XLSX만 생성</Button>
          <Button disabled={busy} onClick={onGenAll}>전체 파일(PDF+XLSX) 생성</Button>
          <Button variant="secondary" disabled={busy} onClick={onGenZip}>전체 ZIP 다운로드 생성</Button>
          <Button variant="ghost" onClick={() => navigate(`/cases/${caseId}`)}>← 대상자 목록</Button>
        </div>

        {files.length > 0 && (
          <div>
            <h2 className="font-bold mt-2 mb-2">생성된 파일</h2>
            <ul className="space-y-1 text-sm">
              {files.map(f => (
                <li key={f.file_name} className="flex justify-between border-b py-2">
                  <span>{f.file_name}</span>
                  <a className="text-blue-600 hover:underline" href={f.download_url} target="_blank" rel="noreferrer">다운로드</a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {zipFile && (
          <div className="border-t pt-3">
            <h2 className="font-bold mb-2">ZIP 패키지</h2>
            <div className="flex justify-between text-sm border rounded px-3 py-2 bg-slate-50">
              <span>{zipFile.file_name}</span>
              <a className="text-blue-600 hover:underline" href={zipFile.download_url} target="_blank" rel="noreferrer">다운로드</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
