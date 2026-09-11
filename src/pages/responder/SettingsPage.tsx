import { useState } from 'react';
import { Bell, Eye, User } from 'lucide-react';
import { cn } from '../../lib/cn';

interface ToggleProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ label, description, checked, onChange, id }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        id={id}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5',
          checked ? 'bg-slate-900' : 'bg-slate-300'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
        <span className="sr-only">{label}</span>
      </button>
    </div>
  );
}

export function SettingsPage() {
  const [notifications, setNotifications] = useState({
    critical: true,
    high: true,
    developing: false,
    resolved: false,
  });

  const [display, setDisplay] = useState({
    darkMap: false,
    clusterMarkers: true,
    showUncertainty: true,
    compactFeed: false,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">Responder preferences and configuration</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl space-y-5">
          {/* Profile */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <User size={16} className="text-slate-500" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-800">Responder Profile</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1" htmlFor="unit-name">
                  Unit name
                </label>
                <input
                  id="unit-name"
                  type="text"
                  defaultValue="Unit Alpha"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1" htmlFor="region">
                  Operational region
                </label>
                <input
                  id="region"
                  type="text"
                  defaultValue="Central District & Riverfront"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1" htmlFor="status">Status</label>
                <select
                  id="status"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                >
                  <option value="online">Online</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <Bell size={16} className="text-slate-500" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-800">Notifications</h2>
            </div>
            <ToggleRow
              id="notif-critical"
              label="Critical incidents"
              description="Alert immediately for critical-severity incidents"
              checked={notifications.critical}
              onChange={v => setNotifications(n => ({ ...n, critical: v }))}
            />
            <ToggleRow
              id="notif-high"
              label="High severity"
              description="Notify for high-severity incidents"
              checked={notifications.high}
              onChange={v => setNotifications(n => ({ ...n, high: v }))}
            />
            <ToggleRow
              id="notif-developing"
              label="Developing incidents"
              description="Notify when new incidents enter the developing state"
              checked={notifications.developing}
              onChange={v => setNotifications(n => ({ ...n, developing: v }))}
            />
            <ToggleRow
              id="notif-resolved"
              label="Resolutions"
              description="Notify when incidents are resolved"
              checked={notifications.resolved}
              onChange={v => setNotifications(n => ({ ...n, resolved: v }))}
            />
          </div>

          {/* Display */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <Eye size={16} className="text-slate-500" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-800">Display Preferences</h2>
            </div>
            <ToggleRow
              id="disp-cluster"
              label="Cluster map markers"
              description="Group nearby incidents into clusters at lower zoom levels"
              checked={display.clusterMarkers}
              onChange={v => setDisplay(d => ({ ...d, clusterMarkers: v }))}
            />
            <ToggleRow
              id="disp-uncertainty"
              label="Show uncertainty radius"
              description="Display geolocation uncertainty radius on map"
              checked={display.showUncertainty}
              onChange={v => setDisplay(d => ({ ...d, showUncertainty: v }))}
            />
            <ToggleRow
              id="disp-compact"
              label="Compact feed"
              description="Show a denser, more compact incident feed"
              checked={display.compactFeed}
              onChange={v => setDisplay(d => ({ ...d, compactFeed: v }))}
            />
          </div>

          {/* Save */}
          <button className="w-full py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
