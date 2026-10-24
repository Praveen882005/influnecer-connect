import React from 'react';
import { BrowserRouter, Link, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/feedback';
import { AppRoutes } from './routes';

export const NavigationTopBar: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <header className="bg-slate-900 text-white text-xs px-4 py-2 flex flex-wrap items-center justify-between border-b border-slate-800 gap-2 z-40 select-none">
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
        <span className="font-semibold tracking-wide">
          BRAND BRIDGE — Creator &amp; Brand Collaboration Platform
        </span>
      </div>

      <nav aria-label="Quick Route Navigation" className="flex items-center gap-1.5 flex-wrap">
        <Link
          to="/"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-[4px] transition-colors cursor-pointer ${
            currentPath === '/'
              ? 'bg-sky-600 text-white'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          Public Website
        </Link>

        <span className="text-slate-600">|</span>

        <Link
          to="/brand/overview"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-[4px] transition-colors cursor-pointer ${
            currentPath.startsWith('/brand')
              ? 'bg-sky-600 text-white'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          Brand Workspace
        </Link>

        <Link
          to="/influencer/overview"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-[4px] transition-colors cursor-pointer ${
            currentPath.startsWith('/influencer')
              ? 'bg-indigo-600 text-white'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          Creator Studio
        </Link>

        <Link
          to="/admin/overview"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-[4px] transition-colors cursor-pointer ${
            currentPath.startsWith('/admin')
              ? 'bg-amber-600 text-white'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          Admin Operations
        </Link>

        <span className="text-slate-600">|</span>

        <Link
          to="/auth/sign-in"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-[4px] transition-colors cursor-pointer ${
            currentPath.startsWith('/auth')
              ? 'bg-emerald-600 text-white'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          Sign In
        </Link>

        <Link
          to="/prototype"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-[4px] transition-colors cursor-pointer ${
            currentPath === '/prototype'
              ? 'bg-sky-600 text-white'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          Prototype Sandbox
        </Link>

        <Link
          to="/design-system"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-[4px] transition-colors cursor-pointer ${
            currentPath === '/design-system'
              ? 'bg-sky-600 text-white'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          Design Tokens
        </Link>
      </nav>
    </header>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
            <NavigationTopBar />
            <main className="flex-1 flex flex-col">
              <AppRoutes />
            </main>
          </div>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
