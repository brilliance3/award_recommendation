import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { generateConsentPdf, generatePdf, getRecipient } from "../api";
import { absoluteUrl } from "../api/client";
import { Button } from "../components/Field";

export default function DocumentPreviewPage() {
  const { recipientId = "" } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  // 생성된 서명본 동의서 PDF URL — 같은 화면에서 바로 확인(iframe)
  const [consentUrl, setConsentUrl] = useState<string | null>(null);

  useEffect(() => {
    getRecipient(recipientId).then(r => {
      setName(r.recipient_name);
      setSignedAt(r.signed_at ?? null);
    });
  }, [recipientId]);

  const onDownload = async () => {
    setGenerating(true);
    try {
      const res = await generatePdf(recipientId);
      if (res.files[0])
        window.open(absoluteUrl(res.files[0].download_url), "_blank");
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail || err?.message || "알 수 없는 오류";
      alert(`PDF 생성 실패\n${detail}`);
    } finally {
      setGenerating(false);
    }
  };

  // 서명본 개인정보 동의서 PDF 생성 → 화면 하단에 바로 표시 + 새 탭/다운로드 가능
  const onConsent = async (openTab: boolean) => {
    setConsentBusy(true);
    try {
      const res = await generateConsentPdf(recipientId);
      const url = res.files[0] && absoluteUrl(res.files[0].download_url);
      if (url) {
        setConsentUrl(url);
        if (openTab) window.open(url, "_blank");
      }
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail || err?.message || "알 수 없는 오류";
      alert(`동의서 PDF 생성 실패\n${detail}`);
    } finally {
      setConsentBusy(false);
    }
  };

  return (
    <div>
      <div className="krds-page-header">
        <div>
          <h1 className="krds-page-title">{name} · 공적조서 미리보기</h1>
          <p className="krds-page-sub">
            HTML 미리보기 후 PDF로 다운로드할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            ← 뒤로
          </Button>
          <Button
            variant="accent"
            disabled={generating}
            onClick={onDownload}
          >
            {generating ? "생성 중..." : "공적조서 PDF 다운로드"}
          </Button>
        </div>
      </div>

      {/* 서명본 개인정보 동의서 — 대상자가 신청 시 입력한 자필 서명이 합성된 PDF */}
      <div className="krds-card p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-ink-900">개인정보 수집·이용 및 제공 동의서 (서명본)</h2>
            <p className="text-xs text-ink-500 mt-0.5">
              {signedAt
                ? "대상자 자필 서명이 합성된 동의서 PDF입니다. 생성 후 아래에서 바로 확인할 수 있습니다."
                : "이 대상자는 자필 서명 없이 제출되어 서명란이 비어 있습니다(문구·동의 표시는 채워집니다)."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={signedAt ? "text-xs text-success-700 font-semibold" : "text-xs text-ink-400"}>
              {signedAt ? "✓ 서명 있음" : "서명 없음"}
            </span>
            <Button variant="secondary" disabled={consentBusy} onClick={() => onConsent(false)}>
              {consentBusy ? "생성 중..." : "동의서 확인"}
            </Button>
            <Button variant="accent" disabled={consentBusy} onClick={() => onConsent(true)}>
              새 탭/다운로드 ↓
            </Button>
          </div>
        </div>
        {consentUrl && (
          <div className="mt-3 overflow-hidden rounded border border-ink-200" style={{ height: "min(70vh, 900px)" }}>
            <iframe title="서명본 동의서 미리보기" src={consentUrl} className="w-full h-full bg-white" />
          </div>
        )}
      </div>

      <div
        className="krds-card overflow-hidden"
        style={{ height: "min(80vh, 1100px)" }}
      >
        <iframe
          title="공적조서 미리보기"
          src={absoluteUrl(`/api/recipients/${recipientId}/preview`)}
          className="w-full h-full bg-white"
        />
      </div>
    </div>
  );
}
