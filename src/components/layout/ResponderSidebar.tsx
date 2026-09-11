import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Radio,
  LayoutDashboard,
  Map,
  List,
  FileText,
  BarChart2,
  Settings,
  Circle,
  User,
  ChevronDown,
  X,
} from 'lucide-react';
import { useRole } from '../../context/RoleContext';
import { useIncidents } from '../../context/IncidentContext';
import { cn } from '../../lib/cn';

const navItems = [
  { to: '/responder', label: 'Overview', Icon: LayoutDashboard, exact: true },
  { to: '/responder/map', label: 'Incident Map', Icon: Map },
  { to: '/responder/feed', label: 'Incident Feed', Icon: List },
  { to: '/responder/reports', label: 'Reports', Icon: FileText },
  { to: '/responder/analytics', label: 'Analytics', Icon: BarChart2 },
  { to: '/responder/settings', label: 'Settings', Icon: Settings },
];

export function ResponderSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { setRole } = useRole();
  const { metrics } = useIncidents();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  const switchToCitizen = () => {
    setRole('citizen');
    navigate('/');
  };

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-label="Close responder navigation"
        />
      )}
      <aside
        id="responder-navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-slate-950 h-full flex-shrink-0 transition-transform md:static md:z-auto md:w-56 xl:w-64 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-slate-800">
        <div className="w-7 h-7 bg-red-600 rounded flex items-center justify-center flex-shrink-0">
          <Radio size={14} className="text-white" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-bold text-white tracking-tight leading-none">CDIS</p>
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-0.5">Responder</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto p-1.5 text-slate-400 hover:text-white md:hidden"
          aria-label="Close responder navigation"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      {/* Critical alert indicator */}
      {metrics.critical > 0 && (
        <div className="mx-3 mt-3 flex items-center gap-2 bg-red-600/10 border border-red-500/20 rounded-lg px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-soft flex-shrink-0" aria-hidden />
          <span className="text-xs font-semibold text-red-400">
            {metrics.critical} critical
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Responder navigation">
        {navItems.map(({ to, label, Icon, exact }) => {
          const isActive = exact ? pathname === to : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={16} aria-hidden />
              {label}
              {to === '/responder/feed' && metrics.active > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full">
                  {metrics.active}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Profile */}
      <div className="border-t border-slate-800 p-3">
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-900 transition-colors"
            aria-expanded={profileOpen}
          >
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
              <User size={14} className="text-slate-300" aria-hidden />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-semibold text-white leading-none truncate">Unit Alpha</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Circle size={6} className="text-green-400 fill-current" aria-hidden />
                <span className="text-[10px] text-slate-400">Online</span>
              </div>
            </div>
            <ChevronDown size={12} className="text-slate-500" aria-hidden />
          </button>

          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setProfileOpen(false)}
                aria-hidden
              />
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-700 rounded-xl shadow-lg z-40 animate-fade-in overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700">
                  <p className="text-sm font-semibold text-white">Unit Alpha</p>
                  <p className="text-xs text-slate-400">Emergency Response Team</p>
                </div>
                <div className="p-2">
                  <button
                    onClick={switchToCitizen}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <User size={14} aria-hidden />
                    Switch to Citizen View
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      </aside>
    </>
  );
}
