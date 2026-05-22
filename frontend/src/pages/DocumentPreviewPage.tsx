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
      if (res.files[0]) window.open(absoluteUrl(res.files[0].download_url), "_blank");
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "알 수 없는 오류";
      alert(`PDF 생성 실패\n${detail}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{name} - 공적조서 미리보기</h1>
        <div className="space-x-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>뒤로</Button>
          <Button disabled={generating} onClick={onDownload}>{generating ? "생성 중..." : "PDF 다운로드"}</Button>
        </div>
      </div>
      <div className="bg-white shadow rounded overflow-hidden" style={{ height: "80vh" }}>
        <iframe
          title="공적조서 미리보기"
          src={absoluteUrl(`/api/recipients/${recipientId}/preview`)}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
