// 02 공적조서 HTML 미리보기 — 서버가 경기천년체로 직접 렌더한 HTML을 iframe으로 표시.
// HWPX→PDF 변환(rhwp/soffice)을 거치지 않아 즉시 표시되고 글꼴이 정확하다.
// 실제 제출 문서(HWPX/PDF)와 줄바꿈·페이지 나뉨이 다를 수 있어 상단에 안내를 둔다.
import { useEffect, useState } from "react";
import { absoluteUrl } from "../api/client";

interface Props {
  caseId: string;
  reloadKey?: number; // 바뀌면 다시 로드
}

export default function HtmlPreview({ caseId, reloadKey = 0 }: Props) {
  const [count, setCount] = useState(1); // 대상자 수
  const [idx, setIdx] = useState(0); // 0-based 대상자 인덱스
  const [loading, setLoading] = useState(true);

  // 대상자 수 파악(X-Recipient-Count) — 다인 case 넘김 버튼 범위 결정
  useEffect(() => {
    let alive = true;
    setIdx(0);
    fetch(
      absoluteUrl(
        `/api/award-cases/${caseId}/preview-html?recipient_index=0&t=${reloadKey}`
      )
    )
      .then(r => {
        const c = parseInt(r.headers.get("X-Recipient-Count") || "1", 10);
        if (alive) setCount(Number.isNaN(c) ? 1 : Math.max(1, c));
      })
      .catch(() => {
        /* 미리보기 로드 실패는 iframe 자체 표시로 드러남 */
      });
    return () => {
      alive = false;
    };
  }, [caseId, reloadKey]);

  const src = absoluteUrl(
    `/api/award-cases/${caseId}/preview-html?recipient_index=${idx}&t=${reloadKey}`
  );

  useEffect(() => {
    setLoading(true);
  }, [src]);

  return (
    <div>
      {/* 미리보기 ↔ 실제 출력 차이 안내 */}
      <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-relaxed">
        <b>화면 확인용 미리보기입니다.</b> 글꼴(경기천년체)은 실제 문서와 같지만,
        한글(HWPX)·PDF로 <b>다운로드한 실제 제출 문서와는 줄바꿈·페이지 나뉨이 다를 수
        있습니다.</b>{" "}
        최종 확인은 다운로드한 파일을 기준으로 하세요.
      </div>

      {/* 다인 case 대상자 넘김 */}
      {count > 1 && (
        <div className="flex items-center justify-center gap-3 mb-2">
          <button
            type="button"
            className="px-3 py-1 rounded bg-brand-700 text-white text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={idx <= 0}
          >
            ‹ 이전 대상자
          </button>
          <span className="text-sm font-semibold text-ink-700">
            대상자 {idx + 1} / {count}
          </span>
          <button
            type="button"
            className="px-3 py-1 rounded bg-brand-700 text-white text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => setIdx(i => Math.min(count - 1, i + 1))}
            disabled={idx >= count - 1}
          >
            다음 대상자 ›
          </button>
        </div>
      )}

      <div
        className="relative bg-ink-100 rounded-lg overflow-hidden"
        style={{ height: "72vh" }}
      >
        {loading && (
          <span className="absolute left-1/2 top-4 -translate-x-1/2 text-sm text-ink-400 z-10">
            불러오는 중...
          </span>
        )}
        <iframe
          key={src}
          src={src}
          title="공적조서 미리보기"
          onLoad={() => setLoading(false)}
          className="w-full h-full bg-white"
          style={{ border: "none" }}
        />
      </div>
    </div>
  );
}
