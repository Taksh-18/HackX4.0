import { Outlet } from 'react-router-dom';
import { ResponderSidebar } from './ResponderSidebar';

export function ResponderLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <ResponderSidebar />
      <main className="flex-1 overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
