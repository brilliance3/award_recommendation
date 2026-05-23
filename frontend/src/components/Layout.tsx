import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

const nav = [
  { to: "/", label: "대시보드", end: true },
  { to: "/cases/new", label: "새 표창 건" },
  { to: "/stats", label: "통계 현황" },
];

export default function Layout() {
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  // 라우트 변경 시 모바일 메뉴 닫기
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-ink-50">
      {/* 상단 정부 표기 바 — KRDS 스타일 슬림 바 */}
      <div className="bg-ink-900 text-ink-100 text-[11px] sm:text-xs">
        <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 h-7 flex items-center justify-between">
          <span className="tracking-wide">경기도의회 · GYEONGGI PROVINCIAL COUNCIL</span>
          <span className="hidden sm:inline text-ink-300">행정 내부 시스템</span>
        </div>
      </div>

      {/* 메인 헤더 */}
      <header className="bg-white border-b border-ink-200 sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/90">
        <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="flex items-center gap-3 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
          >
            {/* 워드마크 심볼 */}
            <span
              aria-hidden
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-accent-600 text-white shadow-card"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5 sm:h-6 sm:w-6"
                aria-hidden="true"
              >
                <path
                  d="M12 2l2.4 5 5.6.8-4 4 1 5.7L12 14.9 6.9 17.5l1-5.7-4-4 5.6-.8L12 2z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] sm:text-xs font-semibold text-brand-700 leading-none">
                경기도의회
              </span>
              <span className="block text-sm sm:text-base font-bold text-ink-900 leading-tight truncate">
                공적조서 자동작성 시스템
              </span>
            </span>
          </Link>

          {/* 데스크탑 GNB */}
          <nav className="hidden md:flex items-center gap-1" aria-label="주요 메뉴">
            {nav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "px-3 py-2 rounded-md text-sm font-semibold transition",
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-700 hover:bg-ink-100",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* 모바일 햄버거 */}
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
            보건복지전문위원실
          </div>
          <div>
            © {new Date().getFullYear()} 공적조서 자동작성 시스템. 행정 업무용
            내부 시스템.
          </div>
        </div>
      </footer>
    </div>
  );
}
