import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Radio, FileText, Menu, X, ChevronDown, User, Shield } from 'lucide-react';
import { useRole } from '../../context/RoleContext';
import { cn } from '../../lib/cn';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/map', label: 'Map' },
  { to: '/report', label: 'Report' },
  { to: '/reports', label: 'My Reports' },
];

export function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { setRole } = useRole();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const switchToResponder = () => {
    setRole('responder');
    navigate('/responder');
    setProfileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 bg-slate-900 rounded flex items-center justify-center">
            <Radio size={14} className="text-white" aria-hidden />
          </div>
          <span className="text-sm font-bold text-slate-900 tracking-tight">CDIS</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                pathname === link.to
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <Link
            to="/report"
            className="hidden sm:flex items-center gap-1.5 bg-red-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText size={14} aria-hidden />
            Report
          </Link>

          {/* Profile / Role switcher */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm text-slate-600"
              aria-expanded={profileOpen}
              aria-haspopup="true"
            >
              <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center">
                <User size={12} aria-hidden />
              </div>
              <span className="hidden sm:block font-medium">Alex</span>
              <ChevronDown size={14} aria-hidden />
            </button>

            {profileOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setProfileOpen(false)}
                  aria-hidden
                />
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-panel z-40 animate-fade-in overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900">Alex Johnson</p>
                    <p className="text-xs text-slate-500">Central District</p>
                    <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      <User size={10} aria-hidden />
                      Citizen
                    </div>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={switchToResponder}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <Shield size={14} className="text-slate-400" aria-hidden />
                      Switch to Responder View
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Mobile menu */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-slate-100"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white animate-fade-in">
          <nav className="p-4 space-y-1" aria-label="Mobile navigation">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  pathname === link.to
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
