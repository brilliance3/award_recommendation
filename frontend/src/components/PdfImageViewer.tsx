// 미리보기 뷰어 — PDF를 페이지별 이미지로 받아 좌우 화살표로 한 장씩 넘긴다.
// react-pdf(worker)에 의존하지 않아 모든 배포 환경에서 동작.
import { useEffect, useState } from "react";
import { absoluteUrl } from "../api/client";

interface Props {
  caseId: string;
  kind: "overview" | "report" | "recipients";
  reloadKey?: number; // 바뀌면 다시 로드
}

export default function PdfImageViewer({ caseId, kind, reloadKey = 0 }: Props) {
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(0); // 0-based
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(true);

  // 페이지 수 조회
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setPage(0);
    setPages(0);
    fetch(
      absoluteUrl(
        `/api/award-cases/${caseId}/preview-pages?kind=${kind}&t=${reloadKey}`
      )
    )
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        if (!alive) return;
        setPages(d.pages || 0);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError("미리보기를 불러오지 못했습니다.");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [caseId, kind, reloadKey]);

  const imgSrc = absoluteUrl(
    `/api/award-cases/${caseId}/preview-page-image?kind=${kind}&page=${page}&t=${reloadKey}`
  );

  useEffect(() => {
    setImgLoading(true);
  }, [imgSrc]);

  const goPrev = () => setPage(p => Math.max(0, p - 1));
  const goNext = () => setPage(p => Math.min(pages - 1, p + 1));

  const arrowBtn =
    "shrink-0 w-12 h-12 rounded-full bg-brand-700 text-white shadow-lg flex " +
    "items-center justify-center text-2xl leading-none hover:bg-brand-800 " +
    "disabled:opacity-30 disabled:cursor-not-allowed transition";

  if (loading)
    return (
      <div className="flex items-center justify-center" style={{ height: "70vh" }}>
        <p className="text-sm text-ink-500">
          불러오는 중... (첫 로딩은 PDF 변환으로 10~30초 걸릴 수 있습니다.)
        </p>
      </div>
    );

  if (error)
    return (
      <div
        className="flex flex-col items-center justify-center gap-3"
        style={{ height: "70vh" }}
      >
        <p className="text-sm text-danger-600">{error}</p>
        <a
          href={absoluteUrl(
            `/api/award-cases/${caseId}/${
              kind === "overview"
                ? "preview-overview-pdf"
                : kind === "recipients"
                ? "preview-recipient-list-pdf"
                : "preview-report-pdf"
            }?t=${reloadKey}`
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-brand-700 underline"
        >
          새 탭에서 PDF로 열기
        </a>
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        <button
          type="button"
          className={arrowBtn}
          onClick={goPrev}
          disabled={page <= 0}
          aria-label="이전 페이지"
        >
          ‹
        </button>
        <div
          className="relative bg-ink-100 rounded-lg overflow-hidden flex items-center justify-center"
          style={{ height: "72vh", flex: 1, maxWidth: 820 }}
        >
          {imgLoading && (
            <span className="absolute text-sm text-ink-400">불러오는 중...</span>
          )}
          <img
            src={imgSrc}
            alt={`${page + 1}페이지`}
            onLoad={() => setImgLoading(false)}
            className="max-h-full max-w-full object-contain shadow-md bg-white"
            style={{ opacity: imgLoading ? 0.3 : 1, transition: "opacity .2s" }}
          />
        </div>
        <button
          type="button"
          className={arrowBtn}
          onClick={goNext}
          disabled={page >= pages - 1}
          aria-label="다음 페이지"
        >
          ›
        </button>
      </div>
      <p className="text-center text-sm font-semibold text-ink-700 mt-3">
        {pages ? `${page + 1} / ${pages}` : "—"}
      </p>
    </div>
  );
}
