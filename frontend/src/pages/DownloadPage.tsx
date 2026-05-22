import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { generateAll, generateXlsx, generateZip, getCase } from "../api";
import { absoluteUrl } from "../api/client";
import type { AwardCaseDetail, GeneratedFileInfo } from "../types";
import { Button } from "../components/Field";

export default function DownloadPage() {
  const { caseId = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<AwardCaseDetail | null>(null);
  const [files, setFiles] = useState<GeneratedFileInfo[]>([]);
  const [zipFile, setZipFile] = useState<GeneratedFileInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCase(caseId).then(setDetail);
  }, [caseId]);

  if (!detail) return <div className="text-ink-500">불러오는 중...</div>;

  const onGenXlsx = async () => {
    setBusy(true);
    try {
      setFiles((await generateXlsx(caseId)).files);
    } finally {
      setBusy(false);
    }
  };
  const onGenAll = async () => {
    setBusy(true);
    try {
      setFiles((await generateAll(caseId)).files);
    } finally {
      setBusy(false);
    }
  };
  const onGenZip = async () => {
    setBusy(true);
    try {
      setZipFile(await generateZip(caseId));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <nav className="text-xs text-ink-500 mb-3" aria-label="이동 경로">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="hover:text-brand-700"
        >
          대시보드
        </button>
        <span className="mx-1.5 text-ink-300">›</span>
        <button
          type="button"
          onClick={() => navigate(`/cases/${caseId}`)}
          className="hover:text-brand-700"
        >
          {detail.title}
        </button>
        <span className="mx-1.5 text-ink-300">›</span>
        <span className="text-ink-700">문서 생성</span>
      </nav>

      <div className="krds-page-header">
        <div>
          <h1 className="krds-page-title">{detail.title} · 문서 생성</h1>
          <p className="krds-page-sub">
            대상자 {detail.recipient_count}명 · 01·02·03 파일을 일괄 생성합니다.
          </p>
        </div>
      </div>

      <div className="krds-card krds-card-pad space-y-5">
        <div>
          <h2 className="krds-section-title mb-3">생성 옵션</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Button variant="secondary" disabled={busy} onClick={onGenXlsx}>
              01·03 XLSX만 생성
            </Button>
            <Button disabled={busy} onClick={onGenAll}>
              전체 파일(PDF+XLSX) 생성
            </Button>
            <Button variant="accent" disabled={busy} onClick={onGenZip}>
              ZIP 다운로드 생성
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate(`/cases/${caseId}`)}
            >
              ← 대상자 목록
            </Button>
          </div>
        </div>

        {files.length > 0 && (
          <div>
            <h2 className="krds-section-title mb-3">생성된 파일</h2>
            <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200 overflow-hidden">
              {files.map(f => (
                <li
                  key={f.file_name}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-4 py-3 bg-white"
                >
                  <span className="text-sm text-ink-800 break-all">
                    {f.file_name}
                  </span>
                  <a
                    className="krds-link text-sm self-start sm:self-auto"
                    href={absoluteUrl(f.download_url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    다운로드 ↓
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {zipFile && (
          <div>
            <h2 className="krds-section-title mb-3">ZIP 패키지</h2>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-accent-200 bg-accent-50 px-3 sm:px-4 py-3">
              <span className="text-sm font-semibold text-accent-700 break-all">
                {zipFile.file_name}
              </span>
              <a
                className="krds-link text-sm"
                href={absoluteUrl(zipFile.download_url)}
                target="_blank"
                rel="noreferrer"
              >
                다운로드 ↓
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
