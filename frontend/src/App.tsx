import React from 'react';
import { BrowserRouter, Link, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/feedback';
import { AppRoutes } from './routes';
import { BrandBridgeMark } from './components/brand/BrandBridgeLogo';

export const NavigationTopBar: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <header className="bg-[#17243A] text-white text-xs px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between border-b border-[#21324E] gap-2.5 z-40 select-none shadow-xs">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 group transition-opacity hover:opacity-90">
          <div className="p-0.5 rounded-md bg-white/10 border border-white/15">
            <BrandBridgeMark size={20} theme="light" />
          </div>
          <span className="font-bold tracking-tight text-white font-['Manrope',sans-serif]">
            BRAND<span className="text-[#93C5FD] ml-0.5">BRIDGE</span>
          </span>
        </Link>
        <span className="hidden sm:inline-block text-[#697386]">·</span>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-[#DCE5FA]/80 font-medium">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#21865B]" />
          Enterprise Collaboration Platform
        </span>
      </div>

      <nav aria-label="Quick Route Navigation" className="flex items-center gap-1.5 flex-wrap">
        <Link
          to="/"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-[6px] transition-all cursor-pointer ${
            currentPath === '/'
              ? 'bg-[#4169E1] text-white shadow-xs'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          Public Website
        </Link>

        <span className="text-[#475569]">|</span>

        <Link
          to="/brand/overview"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-[6px] transition-all cursor-pointer ${
            currentPath.startsWith('/brand')
              ? 'bg-[#4169E1] text-white shadow-xs'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          Brand Workspace
        </Link>

        <Link
          to="/influencer/overview"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-[6px] transition-all cursor-pointer ${
            currentPath.startsWith('/influencer')
              ? 'bg-[#4F46E5] text-white shadow-xs'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          Creator Studio
        </Link>

        <Link
          to="/admin/overview"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-[6px] transition-all cursor-pointer ${
            currentPath.startsWith('/admin')
              ? 'bg-[#B7791F] text-white shadow-xs'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          Admin Operations
        </Link>

        <span className="text-[#475569]">|</span>

        <Link
          to="/auth/sign-in"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-[6px] transition-all cursor-pointer ${
            currentPath.startsWith('/auth')
              ? 'bg-[#21865B] text-white shadow-xs'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          Sign In
        </Link>

        <Link
          to="/prototype"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-[6px] transition-all cursor-pointer ${
            currentPath === '/prototype'
              ? 'bg-[#4169E1] text-white shadow-xs'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          Prototype Sandbox
        </Link>

        <Link
          to="/design-system"
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-[6px] transition-all cursor-pointer ${
            currentPath === '/design-system'
              ? 'bg-[#4169E1] text-white shadow-xs'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
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
          <div className="min-h-screen bg-[#F7F5F0] text-[#17243A] flex flex-col font-sans">
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
