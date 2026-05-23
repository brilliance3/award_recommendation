import { useMemo, useState } from "react";

/**
 * 네이버 지도 후기 스타일의 키워드 선택 칩.
 *
 * 상임위/분야별 사전을 제공하고, 사용자가 다중 선택 → 누적된 키워드 배열을
 * onChange 콜백으로 전달. 자유 키워드 입력도 지원.
 */

// 12개 상임위 + 분야별 키워드 사전
const COMMITTEE_KEYWORDS: Record<string, string[]> = {
  "안전행정위원회": [
    "주민자치 활성화", "재난·안전 봉사", "행정 효율화",
    "민원 친절 응대", "지역행사 운영", "마을공동체 화합",
    "방범·교통 봉사", "공무원 청렴",
  ],
  "기획재정위원회": [
    "예산 절감", "정책 제안", "투명성 제고",
    "재정 효율화", "조세 봉사", "공공자산 관리",
  ],
  "경제노동위원회": [
    "소상공인 지원", "일자리 창출", "근로자 권익",
    "전통시장 활성화", "노사 화합", "직업훈련 봉사",
  ],
  "문화체육관광위원회": [
    "문화예술 진흥", "전통문화 계승", "체육 보급",
    "관광 활성화", "문화재 보존", "도서관·박물관 봉사",
    "생활체육 지도",
  ],
  "농정해양위원회": [
    "농업 발전", "친환경 농업", "어촌계 봉사",
    "농산물 직거래", "도시농업 보급", "축산 위생",
    "농촌 일손 돕기",
  ],
  "보건복지위원회": [
    "취약계층 지원", "어르신 돌봄", "장애인 복지",
    "아동·청소년 보호", "한부모 가정 지원", "의료 봉사",
    "다문화 가정 지원", "정신건강 봉사", "감염병 대응",
  ],
  "건설교통위원회": [
    "도로·교통 안전", "주거 환경 개선", "건설 안전",
    "대중교통 봉사", "보행 환경", "주차 봉사",
  ],
  "도시환경위원회": [
    "환경 보호", "재활용 캠페인", "기후위기 대응",
    "녹지 보전", "도시 정비", "쓰레기 줄이기",
    "에너지 절약",
  ],
  "미래과학협력위원회": [
    "과학 보급", "디지털 격차 해소", "스마트시티",
    "AI 윤리 교육", "스타트업 지원", "메이커 교육",
  ],
  "여성가족평생교육위원회": [
    "여성 권익 향상", "평생교육 활성화",
    "가족 친화 문화", "성평등 봉사", "다문화 교육",
    "평생학습관 봉사",
  ],
  "교육기획위원회": [
    "교육 환경 개선", "학교폭력 예방", "교육 격차 해소",
    "진로지도 봉사", "방과후 학습 봉사", "장학사업",
  ],
  "교육행정위원회": [
    "학교 행정 지원", "학부모 참여", "교직원 복지",
    "학교운영위원회", "급식 봉사", "교육시설 안전",
  ],
};

const GENERIC_KEYWORDS = [
  "다년간 헌신", "솔선수범", "청렴결백", "지역사회 화합",
  "어려운 이웃 지원", "봉사정신", "책임감", "성실",
  "꾸준한 나눔", "지역 발전 기여", "주민 신뢰", "모범적 활동",
];

interface Props {
  /** 선택된 위원회 — null 이면 전체 카테고리 노출 */
  committee?: string | null;
  /** 선택된 키워드 배열 */
  selected: string[];
  onChange: (kws: string[]) => void;
}

export default function KeywordChips({ committee, selected, onChange }: Props) {
  const [customInput, setCustomInput] = useState("");

  const groups = useMemo(() => {
    const out: { title: string; items: string[] }[] = [];
    if (committee && COMMITTEE_KEYWORDS[committee]) {
      out.push({ title: `📋 ${committee} 추천`, items: COMMITTEE_KEYWORDS[committee] });
    }
    out.push({ title: "🌟 공통 키워드", items: GENERIC_KEYWORDS });
    return out;
  }, [committee]);

  const toggle = (kw: string) => {
    if (selected.includes(kw)) {
      onChange(selected.filter((x) => x !== kw));
    } else {
      onChange([...selected, kw]);
    }
  };

  const addCustom = () => {
    const v = customInput.trim();
    if (!v) return;
    if (!selected.includes(v)) onChange([...selected, v]);
    setCustomInput("");
  };

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="text-xs font-semibold text-ink-600 mb-1.5">
            {g.title}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {g.items.map((kw) => {
              const on = selected.includes(kw);
              return (
                <button
                  key={kw}
                  type="button"
                  className={`krds-chip ${on ? "krds-chip-active" : ""}`}
                  onClick={() => toggle(kw)}
                >
                  {kw}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* 자유 입력 */}
      <div>
        <div className="text-xs font-semibold text-ink-600 mb-1.5">✏️ 직접 입력</div>
        <div className="flex gap-2">
          <input
            className="krds-input flex-1"
            placeholder="기타 키워드를 입력하고 Enter"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <button
            type="button"
            className="krds-btn krds-btn-md krds-btn-secondary"
            onClick={addCustom}
          >
            추가
          </button>
        </div>
      </div>

      {/* 선택된 키워드 요약 */}
      {selected.length > 0 && (
        <div className="krds-alert krds-alert-info">
          <span>✅</span>
          <div className="flex-1">
            <p className="font-bold mb-1">선택된 키워드 {selected.length}개</p>
            <div className="flex flex-wrap gap-1">
              {selected.map((kw) => (
                <span
                  key={kw}
                  className="krds-badge krds-badge-brand cursor-pointer"
                  onClick={() => toggle(kw)}
                  title="클릭하여 제거"
                >
                  {kw} ✕
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
