import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button, Input } from "./Field";

/** 토큰 기반 공유 링크 — URL + QR + (선택)짧은 코드 표시 + 복사.
 *  basePath 기본값은 대상자 추가 링크(/apply/add); 관리 링크는 /apply/manage 전달.
 *  code 를 주면 작성자용 짧은 코드와 QR(스캔용)을 함께 노출한다. */
export default function ShareLinkBox({
  token,
  basePath = "/apply/add",
  code,
  qr = false,
}: {
  token: string;
  basePath?: string;
  code?: string | null;
  qr?: boolean;
}) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}${basePath}/${token}`;
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    try {
      await navigator.clipboard.writeText(url);
      done();
    } catch {
      // clipboard API 불가 환경(구형/비보안 컨텍스트) 폴백
      const el = document.createElement("input");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
        done();
      } catch {
        /* 무시 */
      }
      document.body.removeChild(el);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={url}
          readOnly
          onFocus={e => e.currentTarget.select()}
          className="flex-1 font-mono text-xs"
        />
        <Button type="button" variant="secondary" onClick={onCopy}>
          {copied ? "복사됨 ✓" : "링크 복사"}
        </Button>
      </div>
      {(qr || code) && (
        <div className="flex items-center gap-4 rounded-lg border border-ink-200 bg-white p-3">
          {qr && (
            <div className="shrink-0">
              <QRCodeSVG value={url} size={96} marginSize={1} />
              <p className="text-[10px] text-ink-500 text-center mt-1">QR 스캔</p>
            </div>
          )}
          {code && (
            <div className="min-w-0">
              <p className="text-xs text-ink-600">짧은 코드로도 접속 가능</p>
              <p className="font-mono font-bold text-2xl tracking-widest text-brand-700">
                {code}
              </p>
              <p className="text-[11px] text-ink-500 leading-snug break-keep">
                작성자에게 “{origin.replace(/^https?:\/\//, "")}{basePath} 접속 후 코드
                입력”이라고 안내하세요.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
