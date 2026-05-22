import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const loc = useLocation();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 text-white shadow">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold tracking-tight">
            공적조서 자동작성 시스템
          </Link>
          <nav className="text-sm text-slate-300 space-x-4">
            <Link className="hover:text-white" to="/">대시보드</Link>
            <Link className="hover:text-white" to="/cases/new">새 표창 건</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        <div key={loc.pathname}>
          <Outlet />
        </div>
      </main>
      <footer className="text-center text-xs text-slate-400 py-6">
        © {new Date().getFullYear()} 공적조서 자동 생성 시스템
      </footer>
    </div>
  );
}
