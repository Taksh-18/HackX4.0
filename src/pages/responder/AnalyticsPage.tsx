import { useEffect, useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { mockApi } from '../../services/mockApi';
import { LoadingState } from '../../components/ui/LoadingState';

type Analytics = Awaited<ReturnType<typeof mockApi.getAnalytics>>;

const COLORS = {
  flood: '#3B82F6',
  fire: '#EF4444',
  accident: '#F97316',
  structural: '#8B5CF6',
  landslide: '#10B981',
  weather: '#06B6D4',
  other: '#94A3B8',
};

const VERIFICATION_COLORS = ['#16A34A', '#CA8A04', '#DC2626'];
const PRIORITY_COLORS = ['#DC2626', '#EA580C', '#CA8A04', '#94A3B8'];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-slate-800 mb-4">{children}</h2>
  );
}

export function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    mockApi.getAnalytics().then(setData);
  }, []);

  if (!data) return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Analytics</h1>
      </div>
      <div className="p-6">
        <LoadingState />
      </div>
    </div>
  );

  const typeData = Object.entries(data.byType)
    .map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v }))
    .filter(d => d.value > 0);

  const verificationData = [
    { name: 'Corroborated', value: data.byVerification.corroborated },
    { name: 'Developing', value: data.byVerification.developing },
    { name: 'Contradicted', value: data.byVerification.contradicted },
  ];

  const priorityData = [
    { name: 'Critical Dispatch', value: data.byActionPriority.critical_dispatch },
    { name: 'Deploy Scout', value: data.byActionPriority.deploy_scout },
    { name: 'Monitor', value: data.byActionPriority.monitor },
    { name: 'Suppressed', value: data.byActionPriority.suppressed },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Operational Analytics</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {data.totalIncidents} total incidents — current session
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Incident volume over time */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card lg:col-span-2">
            <SectionTitle>Incident Volume</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data.incidentVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#0F172A"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Incidents"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Incident types */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <SectionTitle>Incident Types</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={typeData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="value" name="Incidents" radius={[3, 3, 0, 0]}>
                  {typeData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={COLORS[entry.name.toLowerCase() as keyof typeof COLORS] ?? '#94A3B8'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Verification breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <SectionTitle>Verification Status</SectionTitle>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={150}>
                <PieChart>
                  <Pie
                    data={verificationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {verificationData.map((_, idx) => (
                      <Cell key={idx} fill={VERIFICATION_COLORS[idx]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {verificationData.map((d, idx) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: VERIFICATION_COLORS[idx] }}
                      aria-hidden
                    />
                    <span className="text-slate-600">{d.name}</span>
                    <span className="font-semibold text-slate-800 ml-auto pl-4">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action priority breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <SectionTitle>Response Actions</SectionTitle>
            <div className="space-y-3">
              {priorityData.map((d, idx) => (
                <div key={d.name} className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: PRIORITY_COLORS[idx] }}
                    aria-hidden
                  />
                  <span className="text-sm text-slate-600 flex-1">{d.name}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${data.totalIncidents > 0 ? (d.value / data.totalIncidents) * 100 : 0}%`,
                        background: PRIORITY_COLORS[idx],
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 w-4 text-right">{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Geographic hotspots */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <SectionTitle>Geographic Activity</SectionTitle>
            <div className="space-y-2">
              {data.hotspots.map((spot, idx) => (
                <div
                  key={spot.name}
                  className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0"
                >
                  <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}</span>
                  <span className="text-sm text-slate-700 flex-1">{spot.name}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    spot.severity === 'critical' ? 'bg-red-100 text-red-700' :
                    spot.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {spot.severity}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">{spot.count} incident{spot.count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
