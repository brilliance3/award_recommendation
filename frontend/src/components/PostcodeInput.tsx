import { useEffect, useRef, useState } from "react";

interface PostcodeData {
  zonecode: string;
  address: string;
  jibunAddress?: string;
  buildingName?: string;
}

interface Props {
  zipcode: string;
  address: string;
  onChange: (data: { zipcode: string; address: string }) => void;
  placeholder?: string;
}

declare global {
  interface Window {
    daum?: any;
  }
}

const POSTCODE_SCRIPT =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

/**
 * 카카오(다음) 우편번호 서비스 — 인증 키 불필요, 무료.
 * 버튼 클릭 시 팝업 띄워 검색 → 선택 → 우편번호 + 도로명 주소 자동 채움.
 */
export default function PostcodeInput({
  zipcode,
  address,
  onChange,
  placeholder,
}: Props) {
  const [loaded, setLoaded] = useState(!!window.daum);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (loaded || loadingRef.current) return;
    if (window.daum) {
      setLoaded(true);
      return;
    }
    loadingRef.current = true;
    const s = document.createElement("script");
    s.src = POSTCODE_SCRIPT;
    s.onload = () => setLoaded(true);
    s.onerror = () => {
      loadingRef.current = false;
      console.error("[PostcodeInput] 스크립트 로딩 실패");
    };
    document.head.appendChild(s);
  }, [loaded]);

  const openSearch = () => {
    if (!window.daum?.Postcode) {
      alert("주소 검색을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data: PostcodeData) => {
        onChange({
          zipcode: data.zonecode,
          address:
            data.address +
            (data.buildingName ? ` (${data.buildingName})` : ""),
        });
      },
    }).open({ popupTitle: "주소 검색" });
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="krds-input w-32"
          placeholder="우편번호"
          value={zipcode || ""}
          readOnly
          onClick={openSearch}
        />
        <button
          type="button"
          className="krds-btn krds-btn-md krds-btn-secondary whitespace-nowrap"
          onClick={openSearch}
          disabled={!loaded}
        >
          {loaded ? "🔍 주소 검색" : "로딩…"}
        </button>
      </div>
      <input
        className="krds-input"
        placeholder={placeholder || "기본 주소 (검색 후 자동 채움)"}
        value={address || ""}
        onChange={(e) => onChange({ zipcode, address: e.target.value })}
      />
    </div>
  );
}
