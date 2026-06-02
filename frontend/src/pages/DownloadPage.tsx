import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  generateChecklistHwpx,
  generateOverviewHwpx,
  generateRecipientListXlsx,
  generateReportHwpx,
  generateZip,
  stampUploadedPdf,
  getCase,
  getQuotaStatus,
  getSettings,
  updateCase,
} from "../api";
import { absoluteUrl } from "../api/client";
import type { AppSetting } from "../api/settings";
import type { AwardCaseDetail, GeneratedFileInfo } from "../types";
import { Button } from "../components/Field";

/** 생성된 파일을 브라우저에서 곧바로 다운로드(저장)시킨다. */
function triggerDownload(file: GeneratedFileInfo) {
  const a = document.createElement("a");
  a.href = absoluteUrl(file.download_url);
  a.download = file.file_name;
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function DownloadPage() {
  const { caseId = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<AwardCaseDetail | null>(null);
  const [setting, setSetting] = useState<AppSetting | null>(null);
  const [files, setFiles] = useState<GeneratedFileInfo[]>([]);
  const [zipFile, setZipFile] = useState<GeneratedFileInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false); // 도장찍기 드래그앤드롭 하이라이트
  const [quotaWarned, setQuotaWarned] = useState(false);

  const refresh = async () => {
    const d = await getCase(caseId);
    setDetail(d);
  };

  useEffect(() => {
    refresh();
    getSettings().then(setSetting).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  // 추천의원 의장 표창 쿼터가 다 찼으면 1회 안내 + 위원장 명의 제안
  useEffect(() => {
    if (!detail || quotaWarned || detail.chair_sign) return;
    if ((detail.award_grade || "").includes("지사")) return; // 도지사는 위원장 무관
    getQuotaStatus()
      .then(q => {
        const row = q.rows.find(
          r => r.legislator_name === detail.recommender_name
        );
        if (row && !row.is_chair && row.remaining !== null && row.remaining <= 0) {
          setQuotaWarned(true);
          if (
            confirm(
              `추천의원 ${detail.recommender_name} 님의 표창 쿼터가 모두 찼습니다 ` +
                `(사용 ${row.used} / 한도 ${row.max_quota}명).\n\n` +
                `위원장 명의로 진행하시겠습니까?\n` +
                `(의원 쿼터 통계는 추천의원에 그대로 남고, 문서 추천관만 위원장 명의로 출력됩니다.)`
            )
          ) {
            updateCase(caseId, { chair_sign: true }).then(refresh);
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, quotaWarned]);

  if (!detail) return <div className="text-ink-500">불러오는 중...</div>;

  const onGenOverviewHwpx = async () => {
    setBusy(true);
    try {
      const res = await generateOverviewHwpx(caseId);
      setFiles(res.files);
      res.files.forEach(triggerDownload);
    } finally {
      setBusy(false);
    }
  };
  // 한글에서 저장한 PDF를 받아 도장 처리 (파일 선택·드래그앤드롭 공용)
  const processStampFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("PDF 파일만 올릴 수 있습니다. (한글에서 PDF로 저장 후 올려주세요)");
      return;
    }
    setBusy(true);
    try {
      const res = await stampUploadedPdf(caseId, file);
      setFiles(res.files);
      res.files.forEach(triggerDownload);
    } catch (err: any) {
      alert(
        err?.response?.data?.detail || err?.message || "도장 처리에 실패했습니다."
      );
    } finally {
      setBusy(false);
    }
  };
  const onStampUploaded = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 다시 선택 가능하도록 초기화
    processStampFile(file);
  };
  const onStampDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;
    processStampFile(e.dataTransfer.files?.[0]);
  };
  const onGenReportHwpx = async () => {
    setBusy(true);
    try {
      const res = await generateReportHwpx(caseId);
      setFiles(res.files);
      res.files.forEach(triggerDownload);
    } catch (err: any) {
      alert(
        err?.response?.data?.detail ||
          err?.message ||
          "02 공적조서 HWPX 생성에 실패했습니다."
      );
    } finally {
      setBusy(false);
    }
  };
  const onGenRecipientListXlsx = async () => {
    setBusy(true);
    try {
      const res = await generateRecipientListXlsx(caseId);
      setFiles(res.files);
      res.files.forEach(triggerDownload);
    } finally {
      setBusy(false);
    }
  };
  const onGenChecklistHwpx = async () => {
    setBusy(true);
    try {
      const res = await generateChecklistHwpx(caseId);
      setFiles(res.files);
      res.files.forEach(triggerDownload);
    } catch (err: any) {
      alert(
        err?.response?.data?.detail ||
          err?.message ||
          "체크리스트 HWPX 생성에 실패했습니다."
      );
    } finally {
      setBusy(false);
    }
  };
  const onToggleChairSign = async () => {
    if (!detail) return;
    const next = !detail.chair_sign;
    setBusy(true);
    try {
      await updateCase(caseId, { chair_sign: next });
      await refresh();
      setFiles([]);
      setZipFile(null);
    } finally {
      setBusy(false);
    }
  };

  const isGovernor = (detail?.award_grade || "").includes("지사");
  const onToggleGrade = async () => {
    if (!detail || !setting) return;
    const next = isGovernor
      ? setting.award_grade || "경기도의회 의장 표창"
      : setting.governor_award_grade || "경기도지사 표창";
    if (
      !isGovernor &&
      !confirm("이 표창건을 경기도지사 표창으로 변경합니다. 진행할까요?")
    ) {
      return;
    }
    setBusy(true);
    try {
      await updateCase(caseId, { award_grade: next });
      await refresh();
      setFiles([]);
      setZipFile(null);
    } finally {
      setBusy(false);
    }
  };

  const onGenZip = async () => {
    setBusy(true);
    try {
      const z = await generateZip(caseId);
      setZipFile(z);
      triggerDownload(z);
    } catch (err: any) {
      alert(
        err?.response?.data?.detail ||
          err?.message ||
          "ZIP 생성에 실패했습니다."
      );
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
            대상자 {detail.recipient_count}명 · 01 공적개요서·02 공적조서·03
            표창대상자·서식8 체크리스트를 생성합니다.
          </p>
        </div>
      </div>

      <div className="krds-card krds-card-pad space-y-5">
        {/* 훈격 — 경기도지사 표창은 담당자만 지정 */}
        <div
          className={
            "rounded-lg border p-3 sm:p-4 " +
            (isGovernor
              ? "border-accent-300 bg-accent-50"
              : "border-ink-200 bg-ink-50")
          }
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">
                훈격: {detail.award_grade}
              </h3>
              <p className="text-xs text-ink-700 mt-0.5">
                경기도지사 표창은 담당자만 지정할 수 있습니다. 변경하면
                공적조서·표창대상자의 훈격이 함께 바뀝니다.
              </p>
            </div>
            <Button
              variant={isGovernor ? "ghost" : "secondary"}
              disabled={busy || !setting}
              onClick={onToggleGrade}
            >
              {isGovernor
                ? "경기도의회 의장 표창으로 되돌리기"
                : "경기도지사 표창으로 변경"}
            </Button>
          </div>
        </div>

        {/* 위원장 명의 제출 — 통계는 원래 추천의원에 남고 문서 추천관만 위원장으로 */}
        <div
          className={
            "rounded-lg border p-3 sm:p-4 " +
            (detail.chair_sign
              ? "border-brand-500 bg-brand-50"
              : "border-ink-200 bg-ink-50")
          }
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">
                {detail.chair_sign
                  ? "✓ 위원장 명의로 제출 — 모든 문서 추천관이 위원장으로 출력됩니다"
                  : "추천의원 명의로 제출"}
              </h3>
              <p className="text-xs text-ink-700 mt-0.5">
                추천의원 쿼터가 다 찼을 때 사용합니다. 의원 쿼터 통계는 원래
                추천의원에 그대로 남고, 공적조서·표창대상자 추천관만 위원장
                명의로 출력됩니다.
              </p>
            </div>
            <Button
              variant={detail.chair_sign ? "ghost" : "secondary"}
              disabled={busy}
              onClick={onToggleChairSign}
            >
              {detail.chair_sign ? "위원장 명의 해제" : "위원장 명의로 제출"}
            </Button>
          </div>
        </div>

        <div>
          <h2 className="krds-section-title mb-3">생성 옵션</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button disabled={busy} onClick={onGenOverviewHwpx}>
              1. 공적개요서 HWPX
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={onGenReportHwpx}
              title="한글에서 열어 확인·수정 후 PDF로 저장하세요"
            >
              2. 공적조서 HWPX
            </Button>
            <Button disabled={busy} onClick={onGenRecipientListXlsx}>
              3. 표창대상자 XLSX
            </Button>
            <Button disabled={busy} onClick={onGenChecklistHwpx}>
              서식8 체크리스트 HWPX
            </Button>
          </div>
          <p className="text-xs text-ink-500 mt-2">
            02 공적조서는 <strong>HWPX로 받아 한글에서 PDF로 저장</strong>한 뒤, 아래
            〈한글 PDF에 도장 찍기〉에 올려 도장본을 받으세요(서식 100% 그대로).
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 sm:p-4">
          <h3 className="text-sm font-bold text-blue-700">
            한글 PDF에 도장 찍기 (정확한 제출본)
          </h3>
          <p className="text-xs text-ink-700 mt-0.5">
            ① 〈공적조서 HWPX〉를 한글에서 열어 확인·수정 → ② <strong>한글에서 PDF로 저장</strong>
            (서식이 100% 그대로) → ③ 그 PDF를 아래에 올리면 추천관·조사자 도장((인) 자리)을
            찍어 드립니다. 제출본은 이 도장본 PDF를 사용하세요.
          </p>
          <label
            onDragOver={e => {
              e.preventDefault();
              if (!busy) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onStampDrop}
            className={
              "mt-3 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-7 text-center transition " +
              (busy
                ? "opacity-50 pointer-events-none border-blue-300 bg-white "
                : "cursor-pointer ") +
              (dragOver
                ? "border-blue-500 bg-blue-100"
                : "border-blue-300 bg-white hover:bg-blue-50")
            }
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={onStampUploaded}
              disabled={busy}
              className="hidden"
            />
            <span className="text-2xl leading-none text-blue-500">⬆</span>
            <span className="text-sm font-semibold text-blue-700">
              PDF 파일을 여기로 끌어다 놓거나 클릭해서 선택
            </span>
            <span className="text-[11px] text-ink-500">
              한글에서 ‘PDF로 저장’한 파일만 가능합니다
            </span>
          </label>
          <p className="text-[11px] text-ink-500 mt-1">
            ※ 한글 PDF에 “(인)” 글자가 있어야 그 자리에 도장이 찍힙니다(양식 그대로면 자동 인식).
          </p>
        </div>

        <div className="rounded-lg border border-accent-200 bg-accent-50 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-accent-700">
                전체 다운로드 (ZIP)
              </h3>
              <p className="text-xs text-ink-700 mt-0.5">
                01 공적개요서·<strong>02 공적조서 HWPX</strong>·03 표창대상자·서식8을
                한 번에 묶어서 받습니다. 02 공적조서는 한글에서 PDF로 저장·도장해 제출하세요.
              </p>
            </div>
            <Button variant="accent" disabled={busy} onClick={onGenZip}>
              ZIP 생성
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

        <div>
          <Button
            variant="ghost"
            onClick={() => navigate(`/cases/${caseId}`)}
          >
            ← 대상자 목록
          </Button>
        </div>
      </div>
    </div>
  );
}
