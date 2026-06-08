// 자필 서명 패드 — PC는 마우스, 모바일·태블릿은 손가락/펜으로 직접 그린다.
// Pointer Events 하나로 마우스·터치·펜을 모두 처리한다.
// 그린 결과는 투명 배경 PNG data URL("data:image/png;base64,...")로 onChange 전달.
// 비어 있으면(획이 하나도 없으면) 빈 문자열을 전달한다.
import { useEffect, useRef } from "react";

interface Props {
  value: string; // PNG data URL | ""
  onChange: (dataUrl: string) => void;
  height?: number; // 캔버스 높이(px), 기본 160
}

export default function SignaturePad({ value, onChange, height = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // 캔버스 해상도를 표시 크기 + DPR에 맞춰 설정(고해상도 화면에서 선명)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111111";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    dirty.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (dirty.current && canvasRef.current) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    dirty.current = false;
    onChange("");
  };

  return (
    <div className="space-y-1">
      <canvas
        ref={canvasRef}
        style={{ height, touchAction: "none" }}
        className="w-full rounded-lg border-2 border-dashed border-ink-300 bg-white cursor-crosshair"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
      <div className="flex items-center justify-between text-xs">
        <span className={value ? "text-success-700 font-semibold" : "text-ink-400"}>
          {value ? "✓ 서명이 입력되었습니다." : "위 칸에 마우스(PC) 또는 손가락(모바일·태블릿)으로 서명해 주세요."}
        </span>
        <button
          type="button"
          onClick={clear}
          className="rounded border border-ink-300 px-2 py-1 text-ink-600 hover:bg-ink-50"
        >
          지우기
        </button>
      </div>
    </div>
  );
}
