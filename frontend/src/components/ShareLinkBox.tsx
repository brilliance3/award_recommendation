import { useState } from "react";
import { Button, Input } from "./Field";

/** 토큰 기반 공유 링크 — URL 표시 + 복사. 토큰만 받아 현재 도메인으로 조립.
 *  basePath 기본값은 대상자 추가 링크(/apply/add); 대표 관리 링크는 /apply/manage 전달. */
export default function ShareLinkBox({
  token,
  basePath = "/apply/add",
}: {
  token: string;
  basePath?: string;
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
    <div className="mt-3 flex flex-col sm:flex-row gap-2">
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
  );
}
