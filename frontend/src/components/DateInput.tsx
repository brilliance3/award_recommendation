// 날짜 입력 — 숫자만 치면 YYYY.MM.DD 로 자동 정렬되는 텍스트 입력.
// native <input type="date"> 가 브라우저(특히 사파리)에서 "260601.00.00" 같은
// 이상한 값을 만드는 문제를 피하기 위해 사용한다.
// 외부에는 항상 백엔드가 기대하는 "YYYY-MM-DD"(또는 빈 문자열)로 value를 주고받는다.
//
// 입력 규칙:
//  - 6자리(YYMMDD)를 다 치고 칸을 벗어나면(blur) 2000년대로 보정 → 2015.12.30
//  - 8자리(YYYYMMDD)는 그대로 → 2012.12.12
//  - 입력 '도중'에는 6자리에 함부로 "20"을 붙이지 않는다(8자리 연도 입력을 막지 않기 위해).
import { useEffect, useState } from "react";

interface Props {
  value: string; // "YYYY-MM-DD" | ""
  onChange: (isoDate: string) => void; // "YYYY-MM-DD" | "" 로 전달
  placeholder?: string;
  minDate?: string; // "YYYY-MM-DD" 미만이면 경고 표시 (예: 오늘 이후만)
  minHint?: string; // minDate 위반 시 보여줄 안내문
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void; // Enter 저장/Escape 취소 등
  autoFocus?: boolean;
}

const inputBase =
  "w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm " +
  "text-ink-900 placeholder:text-ink-400 hover:border-ink-400 " +
  "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500";

// "YYYY-MM-DD" → "YYYY.MM.DD" (화면 표시용)
function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[1]}.${m[2]}.${m[3]}`;
}

// 숫자열 d(이미 \D 제거됨)를 YYYY.MM.DD 표시형 + 완성 시 ISO 로.
// 월(1-12)·일(1-31) 범위를 벗어나면 iso를 빈 문자열로 반환해 서버에 잘못된 날짜가 가지 않게 한다.
function buildFromDigits(d: string): { display: string; iso: string } {
  d = d.slice(0, 8);
  const y = d.slice(0, 4);
  const mo = d.slice(4, 6);
  const da = d.slice(6, 8);
  let display = y;
  if (d.length > 4) display += "." + mo;
  if (d.length > 6) display += "." + da;
  let iso = "";
  if (y.length === 4 && mo.length === 2 && da.length === 2) {
    const moNum = parseInt(mo, 10);
    const daNum = parseInt(da, 10);
    // 월(1-12)·일(1-31) 범위 검증 — 벗어나면 유효 ISO를 emit하지 않음
    if (moNum >= 1 && moNum <= 12 && daNum >= 1 && daNum <= 31) {
      iso = `${y}-${mo}-${da}`;
    }
  }
  return { display, iso };
}

export default function DateInput({
  value,
  onChange,
  placeholder,
  minDate,
  minHint,
  onKeyDown,
  autoFocus,
}: Props) {
  const [text, setText] = useState(isoToDisplay(value));

  // minDate 위반 여부 (value가 완성됐고 minDate보다 이전이면 경고)
  const violatesMin = !!(minDate && value && value < minDate);

  // 외부 value가 바뀌면(예: 임시저장 복원) 표시도 동기화
  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  // 입력 중: 6자리에 "20"을 붙이지 않는다 (8자리 연도 입력 보존).
  const handleChange = (raw: string) => {
    const d = raw.replace(/\D/g, "");
    const { display, iso } = buildFromDigits(d);
    setText(display);
    onChange(iso);
  };

  // 칸을 벗어날 때: 6자리(YYMMDD)면 2000년대로 보정해 완성.
  const handleBlur = () => {
    let d = text.replace(/\D/g, "");
    if (d.length === 6) d = "20" + d; // 15.12.30 → 2015.12.30
    const { display, iso } = buildFromDigits(d);
    setText(display);
    onChange(iso);
  };

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        className={
          inputBase +
          (violatesMin ? " border-danger-500 focus:ring-danger-500" : "")
        }
        value={text}
        onChange={e => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        placeholder={placeholder || "예: 1990.03.15 (숫자만 입력)"}
        maxLength={10}
      />
      {violatesMin && (
        <p className="mt-1 text-xs text-danger-600">
          {minHint || "오늘 이후의 날짜를 입력해 주세요."}
        </p>
      )}
    </div>
  );
}
