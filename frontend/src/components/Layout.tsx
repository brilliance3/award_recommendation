import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { getSettings, logout } from "../api";

const nav = [
  { to: "/quota", label: "의원 쿼터 현황" },
  // '관리'와 '전체 표창 현황'은 중복이라 하나로 통합('표창 관리').
  { to: "/", label: "표창 관리", end: true },
  { to: "/settings", label: "설정" },
];

export default function Layout() {
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [deptName, setDeptName] = useState("보건복지전문위원실");

  // 라우트 변경 시 모바일 메뉴 닫기
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  // 설정의 부서명을 헤더·푸터에 반영 (마운트 + 설정 저장 시 갱신)
  useEffect(() => {
    const load = () =>
      getSettings()
        .then(s => {
          if (s.department_name) setDeptName(s.department_name);
        })
        .catch(() => {});
    load();
    window.addEventListener("settings-updated", load);
    return () => window.removeEventListener("settings-updated", load);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-ink-50">
      {/* 상단 정부 표기 바 — KRDS 스타일 슬림 바 */}
      <div className="bg-ink-900 text-ink-100 text-[11px] sm:text-xs">
        <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 h-7 flex items-center justify-between">
          <span className="tracking-wide">경기도의회 · GYEONGGI PROVINCIAL COUNCIL</span>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-ink-300">행정 내부 시스템</span>
            <button
              type="button"
              onClick={async () => {
                await logout().catch(() => {});
                window.dispatchEvent(new Event("auth-expired"));
              }}
              className="text-ink-200 hover:text-white underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 메인 헤더 — 흰색 배경(CI 규정: 밝은 배경에는 컬러 마크) */}
      <header className="bg-white border-b border-ink-200 sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/95">
        <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* 좌측: 경기도의회 공식 가로 로고 (assembly-logo-black.png) */}
          <Link
            to="/quota"
            className="flex items-center gap-3 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
            aria-label="경기도의회 표창 관리 시스템 — 의원 쿼터 현황"
          >
            <img
              src="/ci/assembly-logo-black.png"
              alt="경기도의회 Gyeonggido Assembly"
              className="h-10 sm:h-12 w-auto select-none"
              draggable={false}
            />
            <span className="hidden sm:flex flex-col min-w-0 pl-3 border-l border-ink-200">
              <span className="text-[11px] font-semibold text-brand-700 leading-none tracking-wide">
                {deptName}
              </span>
              <span className="text-sm sm:text-base font-bold text-ink-900 leading-tight truncate mt-1">
                표창 관리 시스템
              </span>
            </span>
          </Link>

          {/* 우측: 슬로건 마크 (slogan-blue.png) + 모바일 햄버거 */}
          <div className="flex items-center gap-3">
            <img
              src="/ci/slogan-blue.png"
              alt="사람중심 민생중심 의회다운 의회"
              className="hidden lg:block h-8 xl:h-9 w-auto select-none"
              draggable={false}
            />

            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md text-ink-700 hover:bg-ink-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen(v => !v)}
            >
              {open ? (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* GNB — 헤더 하단 brand-700 바 (어두운 배경 + 흰색 텍스트) */}
        <nav
          className="hidden md:block bg-brand-700"
          aria-label="주요 메뉴"
        >
          <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1">
            {nav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "px-4 py-2.5 text-sm font-semibold transition border-b-2",
                    isActive
                      ? "text-white border-gold-500 bg-brand-800"
                      : "text-white/85 border-transparent hover:text-white hover:bg-brand-800/60",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* 모바일 메뉴 */}
        {open && (
          <div id="mobile-menu" className="md:hidden border-t border-ink-200 bg-white">
            <nav className="px-2 py-2 flex flex-col" aria-label="모바일 주요 메뉴">
              {nav.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      "px-3 py-3 rounded-md text-base font-semibold",
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-ink-800 hover:bg-ink-100",
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 w-full">
        <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 lg:py-10">
          <div key={loc.pathname}>
            <Outlet />
          </div>
        </div>
      </main>

      <footer className="border-t border-ink-200 bg-white">
        <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs text-ink-500">
          <div>
            <span className="font-semibold text-ink-700">경기도의회</span>
            <span className="mx-2 text-ink-300">|</span>
            {deptName}
          </div>
          <div>
            © {new Date().getFullYear()} 표창 관리 시스템. 행정 업무용
            내부 시스템.
          </div>
        </div>
      </footer>
    </div>
  );
}
