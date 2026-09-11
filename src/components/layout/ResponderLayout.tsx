import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Radio } from 'lucide-react';
import { ResponderSidebar } from './ResponderSidebar';

export function ResponderLayout() {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const closeNavigation = useCallback(() => setNavigationOpen(false), []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* CHANGED: the responder navigation becomes a drawer on small screens. */}
      <ResponderSidebar open={navigationOpen} onClose={closeNavigation} />
      <div className="flex flex-1 min-w-0 flex-col">
        <header className="md:hidden h-14 flex-shrink-0 bg-slate-950 text-white px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-red-600 rounded flex items-center justify-center">
              <Radio size={14} aria-hidden />
            </div>
            <span className="text-sm font-bold">CDIS Responder</span>
          </div>
          <button
            type="button"
            onClick={() => setNavigationOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-800"
            aria-label="Open responder navigation"
            aria-expanded={navigationOpen}
            aria-controls="responder-navigation"
          >
            <Menu size={20} aria-hidden />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
