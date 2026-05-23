import { useEffect, useState } from "react";
import { inviteApi, type BulkInviteLink } from "../api/invite";

interface Props {
  caseId: string;
  caseTitle: string;
  onClose: () => void;
}

/**
 * 표창건 공유 모달.
 * - 모든 대상자에게 일괄 초대 발급 (이미 발급된 사람은 그대로 유지)
 * - 각 대상자의 입력 링크를 클립보드로 복사
 * - 전체 링크를 한 번에 텍스트로 복사 (메일/카톡 첨부용)
 */
export default function ShareLinksModal({ caseId, caseTitle, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<BulkInviteLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    inviteApi
      .bulkIssue(caseId)
      .then((r) => setLinks(r.links))
      .catch((e) =>
        setError(e?.response?.data?.detail || "초대 발급 실패")
      )
      .finally(() => setLoading(false));
  }, [caseId]);

  const baseUrl = window.location.origin;
  const absoluteUrl = (path: string) => `${baseUrl}${path}`;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  const copyAll = () => {
    const text = links
      .map(
        (l) => `${l.recipient_name || "(이름 미입력)"} — ${absoluteUrl(l.public_url)}`
      )
      .join("\n");
    copy(text, "all");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="krds-card w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ink-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">공유 — 대상자별 입력 링크</h3>
            <p className="text-xs text-ink-500 mt-0.5">{caseTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="krds-btn krds-btn-sm krds-btn-ghost"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-3 border-b border-ink-100">
          <div className="krds-alert krds-alert-info text-xs">
            <span>ℹ️</span>
            <div>
              아래 링크를 추천 대상자에게 전달하면, 대상자가 본인의 인적사항(성명, 핸드폰, 주소 등)을 직접 입력하고 제출할 수 있습니다.
            </div>
          </div>
        </div>

        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-sm text-ink-600">
            총 <strong>{links.length}</strong>명
          </span>
          <button
            onClick={copyAll}
            className="krds-btn krds-btn-sm krds-btn-secondary"
            disabled={loading || links.length === 0}
          >
            {copiedId === "all" ? "✅ 복사됨" : "📋 전체 복사"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto border-t border-ink-100">
          {loading ? (
            <div className="p-8 text-center text-ink-500">불러오는 중...</div>
          ) : error ? (
            <div className="p-8 text-center text-danger-700">{error}</div>
          ) : links.length === 0 ? (
            <div className="p-8 text-center text-ink-500">
              대상자가 없습니다. 먼저 대상자를 추가하세요.
            </div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {links.map((l) => {
                const url = absoluteUrl(l.public_url);
                return (
                  <li
                    key={l.recipient_id}
                    className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink-900">
                        {l.recipient_name || "(이름 미입력)"}
                        {l.status === "submitted_by_recipient" && (
                          <span className="ml-2 krds-status krds-status-submitted">
                            ✓ 제출완료
                          </span>
                        )}
                        {l.status === "invited" && (
                          <span className="ml-2 krds-status krds-status-invited">
                            ⌛ 작성중
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink-500 break-all mt-0.5">
                        {url}
                      </div>
                    </div>
                    <button
                      onClick={() => copy(url, l.recipient_id)}
                      className="krds-btn krds-btn-sm krds-btn-secondary self-start sm:self-auto"
                    >
                      {copiedId === l.recipient_id ? "✅ 복사됨" : "📋 복사"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-ink-100 flex justify-end">
          <button onClick={onClose} className="krds-btn krds-btn-md krds-btn-primary">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
