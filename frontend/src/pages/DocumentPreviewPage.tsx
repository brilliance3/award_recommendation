import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { generatePdf, getRecipient } from "../api";
import { absoluteUrl } from "../api/client";
import { Button } from "../components/Field";

export default function DocumentPreviewPage() {
  const { recipientId = "" } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    getRecipient(recipientId).then(r => setName(r.recipient_name));
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
            {generating ? "생성 중..." : "PDF 다운로드"}
          </Button>
        </div>
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
