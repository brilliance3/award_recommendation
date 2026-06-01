import { MERIT_CATEGORIES } from "../data/meritCategories";

interface Props {
  categoryValue: string;
  organizationName?: string;
  recipientName?: string;
  customExample: string;
}

export default function AwardSheetPreview({
  categoryValue,
  organizationName,
  recipientName,
  customExample,
}: Props) {
  const cat = MERIT_CATEGORIES.find(c => c.value === categoryValue);
  const body =
    categoryValue === "기타"
      ? customExample.trim() || "(여기에 입력한 표창 문구가 표시됩니다)"
      : cat?.example || "(해당 분야의 표창 문구 예시가 등록되지 않았습니다)";

  return (
    <div
      className="relative rounded-lg border border-amber-300 shadow-sm overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #f6ecd0 0%, #efe1bd 50%, #f6ecd0 100%)",
        fontFamily:
          '"Nanum Myeongjo", "Apple SD Gothic Neo", "Malgun Gothic", serif',
      }}
    >
      <div className="px-6 py-7 sm:px-8 sm:py-8 text-stone-800">
        <div className="text-[11px] tracking-wider text-stone-600 mb-6">
          제 26-○○○○호
        </div>
        <h3
          className="text-center text-2xl sm:text-3xl font-extrabold mb-6"
          style={{ letterSpacing: "0.6em", textIndent: "0.6em" }}
        >
          표창장
        </h3>
        <div className="text-right text-sm mb-1 text-stone-700">
          {organizationName?.trim() || "(단체명)"}
        </div>
        <div className="text-right text-xl font-bold mb-7 tracking-wider">
          {recipientName?.trim() || "(성명)"}
        </div>
        <p className="text-[15px] leading-9 indent-4 mb-8 break-keep whitespace-pre-wrap">
          {body}
        </p>
        <div className="text-center text-sm mb-3 text-stone-700">
          ○○○○년 ○○월 ○○일
        </div>
        <div className="flex items-center justify-center gap-3 relative">
          <span className="text-lg" style={{ letterSpacing: "0.4em" }}>
            경기도의회의장
          </span>
          <span className="text-lg font-bold tracking-[0.3em]">○ ○ ○</span>
          <span
            className="absolute right-2 sm:right-6 -top-1 inline-flex items-center justify-center w-12 h-12 rounded border-2 border-rose-600 text-rose-600 text-[10px] font-bold opacity-80"
            style={{ transform: "rotate(-6deg)", lineHeight: 1.1 }}
          >
            의장
            <br />직인
          </span>
        </div>
      </div>
    </div>
  );
}
