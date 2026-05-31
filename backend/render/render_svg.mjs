// HWPX → 페이지별 SVG 렌더 (한글 호환 미리보기용).
// @rhwp/core(WASM)로 한컴 한글과 동일한 페이지 분할/레이아웃을 재현한다.
// LibreOffice(soffice) 변환은 줄 높이가 달라 한글과 페이지가 어긋나므로 이 경로로 대체.
//
// rhwp는 한글/한자를 1.0em(정사각형)으로 레이아웃하지만 실제 경기천년바탕은 0.91/0.92em
// 이라 한글보다 넓게 잡힌다. 호출 측(pdf_preview._apply_preview_ratio)에서 미리보기 전용
// HWPX의 글자 장평을 낮춰 이 차이를 보정하므로, 이 스크립트는 단순히 렌더만 한다.
//
// 사용법: node render_svg.mjs <input.hwpx> <output_dir>
//   output_dir/page_001.svg ... 저장 후 {"pages":N} 를 stdout에 출력.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import init, { HwpDocument } from "@rhwp/core";

const require = createRequire(import.meta.url);

async function main() {
  const inPath = process.argv[2];
  const outDir = process.argv[3];
  if (!inPath || !outDir) {
    console.error("usage: node render_svg.mjs <input.hwpx> <output_dir>");
    process.exit(2);
  }
  const wasmPath = require.resolve("@rhwp/core/rhwp_bg.wasm");
  await init({ module_or_path: readFileSync(wasmPath) });

  const doc = new HwpDocument(new Uint8Array(readFileSync(inPath)));
  const pages = doc.pageCount();
  mkdirSync(outDir, { recursive: true });
  for (let i = 0; i < pages; i++) {
    const svg = doc.renderPageSvg(i);
    const name = `page_${String(i + 1).padStart(3, "0")}.svg`;
    writeFileSync(join(outDir, name), svg, "utf8");
  }
  process.stdout.write(JSON.stringify({ pages }));
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
