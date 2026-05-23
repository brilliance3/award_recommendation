import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import GacSymbol from "./GacSymbol";

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
      {/* 상단 정부 표기 바 — KRDS 슬림 바 + GAC 슬로건 */}
      <div className="bg-brand-700 text-white text-[11px] sm:text-xs">
        <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 h-7 flex items-center justify-between">
          <span className="tracking-wide font-semibold">
            경기도의회 · GYEONGGI-DO ASSEMBLY
          </span>
          <span className="hidden sm:flex items-center gap-2">
            <span className="opacity-80 italic">
              사람중심 · 민생중심 · 의회다운 의회
            </span>
            <span className="opacity-50">|</span>
            <span className="opacity-80">행정 내부 시스템</span>
          </span>
        </div>
      </div>

      {/* 메인 헤더 */}
      <header className="bg-white border-b border-ink-200 sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/90">
        <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="flex items-center gap-3 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
          >
            {/* GAC 무궁화 심벌 — 경기도의회 CI */}
            <span
              aria-hidden
              className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white border-2 border-brand-600 shadow-card flex-shrink-0"
            >
              <GacSymbol size={28} color="#3C5D93" className="sm:scale-110" />
            </span>
            <span className="min-w-0 flex flex-col">
              <span className="flex items-baseline gap-1.5 leading-none">
                <span className="text-[10px] sm:text-[11px] font-bold tracking-widest text-brand-700">
                  GAC
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-ink-500">
                  경기도의회
                </span>
              </span>
              <span className="block text-sm sm:text-base font-bold text-ink-900 leading-tight truncate mt-0.5">
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
        <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 border border-brand-200 flex-shrink-0">
                <GacSymbol size={32} color="#3C5D93" />
              </span>
              <div>
                <div className="text-sm font-bold text-ink-900">
                  경기도의회 <span className="text-brand-700">GAC</span>
                </div>
                <div className="text-xs text-ink-500 mt-0.5 italic">
                  사람중심 · 민생중심 · 의회다운 의회
                </div>
                <div className="text-xs text-ink-500 mt-1">
                  16429 경기도 수원시 영통구 도청로 30
                </div>
              </div>
            </div>
            <div className="text-xs text-ink-500 sm:text-right space-y-1">
              <div>공적조서 자동작성 시스템 v0.2</div>
              <div>© {new Date().getFullYear()} 경기도의회 사무처</div>
              <div className="text-ink-400">행정 업무용 내부 시스템</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
