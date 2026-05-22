/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.25rem",
        md: "1.5rem",
        lg: "2rem",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          "Pretendard",
          "Pretendard Variable",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "맑은 고딕",
          "sans-serif",
        ],
      },
      colors: {
        // 경기 블루 (Gyeonggi Blue) — 메인 정체성 컬러
        brand: {
          50:  "#eaf2ff",
          100: "#cfe0ff",
          200: "#a5c4ff",
          300: "#6ea0ff",
          400: "#3a78f2",
          500: "#1a5cd6",
          600: "#0a47b4", // primary
          700: "#073a91",
          800: "#062f74",
          900: "#04204f",
        },
        // 경기 그린 (Gyeonggi Green) — 액센트 / 강조
        accent: {
          50:  "#e7f8ef",
          100: "#c4ecd6",
          200: "#8fdcb3",
          300: "#54c88c",
          400: "#1eb068",
          500: "#089656",
          600: "#007a47",
          700: "#005f38",
          800: "#00472a",
          900: "#00301c",
        },
        // KRDS 중립 (회색 스케일)
        ink: {
          50:  "#f7f8fa",
          100: "#eef0f4",
          200: "#dfe3ea",
          300: "#c4cbd6",
          400: "#9aa3b2",
          500: "#6b7385",
          600: "#4a5364",
          700: "#343c4a",
          800: "#222834",
          900: "#10141c",
        },
        danger: {
          50:  "#fdecec",
          500: "#d6354a",
          600: "#b8273b",
          700: "#94192e",
        },
        warn: {
          50:  "#fff7e6",
          500: "#d68a00",
          600: "#a86c00",
        },
        success: {
          50:  "#e6f7ec",
          500: "#1aa761",
          600: "#0f854a",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 20, 28, 0.04), 0 1px 3px rgba(16, 20, 28, 0.06)",
        pop:  "0 8px 24px rgba(16, 20, 28, 0.12)",
      },
      borderRadius: {
        xl2: "0.875rem",
      },
      maxWidth: {
        page: "1200px",
      },
    },
  },
  plugins: [],
};
