import { ReactNode } from "react";

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-ink-50">
      {/* 상단 슬림 바 — 관리자 Layout과 동일 톤 */}
      <div className="bg-ink-900 text-ink-100 text-[11px] sm:text-xs">
        <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 h-7 flex items-center justify-between">
          <span className="tracking-wide">
            경기도의회 · GYEONGGI PROVINCIAL COUNCIL
          </span>
          <span className="hidden sm:inline text-ink-300">
            의장 표창 추천 신청
          </span>
        </div>
      </div>

      {/* 메인 헤더 — 흰색 배경(CI 규정: 밝은 배경에는 컬러 마크) */}
      <header className="bg-white border-b border-ink-200">
        <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
          <div
            className="flex items-center gap-3 min-w-0"
            aria-label="경기도의회"
          >
            <img
              src="/ci/assembly-logo-black.png"
              alt="경기도의회 Gyeonggido Assembly"
              className="h-10 sm:h-12 w-auto select-none"
              draggable={false}
            />
            <span className="hidden sm:flex flex-col min-w-0 pl-3 border-l border-ink-200">
              <span className="text-[11px] font-semibold text-brand-700 leading-none tracking-wide">
                보건복지전문위원실
              </span>
              <span className="text-sm sm:text-base font-bold text-ink-900 leading-tight truncate mt-1">
                의장 표창 추천 신청
              </span>
            </span>
          </div>

          <img
            src="/ci/slogan-blue.png"
            alt="사람중심 민생중심 의회다운 의회"
            className="hidden lg:block h-8 xl:h-9 w-auto select-none"
            draggable={false}
          />
        </div>

        {/* 민간인 페이지 안내 바 — GNB 자리에 한 줄 안내 */}
        <div className="bg-brand-700 text-white">
          <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 py-2 text-xs sm:text-sm text-center sm:text-left">
            본 페이지는 표창 추천 신청을 위한 공용 양식입니다. 입력 정보는
            보건복지위원회 전문위원실 검토 후 절차에 반영됩니다.
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        <div className="max-w-page mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 lg:py-10">
          {children}
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
            © {new Date().getFullYear()} 표창 관리 시스템. 표창 추천
            신청 공용 양식.
          </div>
        </div>
      </footer>
    </div>
  );
}
