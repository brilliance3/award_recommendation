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
        // 경기도의회 GAC DARK BLUE (#3C5D93) 기반 정체성 컬러
        brand: {
          50:  "#eef2f9",
          100: "#d4def0",
          200: "#abbede",
          300: "#7e9bca",
          400: "#5a7ab2",
          500: "#436597",
          600: "#3C5D93", // 경기도의회 공식 GAC DARK BLUE
          700: "#314c79",
          800: "#283d62",
          900: "#1c2b46",
        },
        // 경기도의회 보조 BLUE (#2882B5) — 강조/링크/액션
        accent: {
          50:  "#e6f2f9",
          100: "#c5deee",
          200: "#9bc6e0",
          300: "#6dabce",
          400: "#4994c1",
          500: "#2882B5", // 경기도의회 공식 보조 BLUE PANTONE 7690C
          600: "#206d99",
          700: "#19567a",
          800: "#10405c",
          900: "#082a3d",
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
