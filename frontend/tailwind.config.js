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
        // 경기도의회 CI — GAC DARK BLUE (#3C5D93, PANTONE 653C) 기반 메인 정체성
        brand: {
          50:  "#eef2f8",
          100: "#d6e1ee",
          200: "#adc3dd",
          300: "#84a5cc",
          400: "#5b87bb",
          500: "#4a72a8",
          600: "#3c5d93", // primary — GAC DARK BLUE
          700: "#324d7a",
          800: "#283d61",
          900: "#1e2d48",
        },
        // 경기도의회 CI 보조색 — BLUE (#2882B5, PANTONE 7690C)
        sky: {
          50:  "#e9f3f9",
          500: "#2882b5",
          600: "#206999",
          700: "#19527a",
        },
        // 경기도의회 CI 시상색 — GOLD (#AD8B3A, PANTONE 872C). 표창 강조용
        gold: {
          50:  "#faf6ec",
          100: "#f2e8c8",
          500: "#c9a854",
          600: "#ad8b3a",
          700: "#8a6e2e",
        },
        // 경기도의회 CI 시상색 — SILVER (#999999), WARM GRAY (#7D7D7D)
        silver: {
          400: "#b3b3b3",
          500: "#999999",
          600: "#7d7d7d",
        },
        // 경기 그린 — 액센트 / 강조 (기존 컴포넌트 호환 보존)
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
