import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const completed = payload.find((p) => p.dataKey === "completed")?.value || 0;
  const failed = payload.find((p) => p.dataKey === "failed")?.value || 0;
  const incomplete = payload.find((p) => p.dataKey === "incomplete")?.value || 0;

  return (
    <div className="rounded border border-zinc-700 bg-[#071018] p-2 text-sm text-zinc-100 shadow-sm" style={{ minWidth: 160 }}>
      <div className="font-medium text-xs text-zinc-200 mb-1">{label}</div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between"><span className="text-zinc-300">Completed</span><span className="font-semibold text-blue-300">{completed}</span></div>
        <div className="flex items-center justify-between"><span className="text-zinc-300">Failed</span><span className="font-semibold text-red-300">{failed}</span></div>
        <div className="flex items-center justify-between"><span className="text-zinc-300">Incomplete</span><span className="font-semibold text-amber-300">{incomplete}</span></div>
      </div>
    </div>
  );
}

export default function RecentScanActivity({ activity }) {
  const hasData = Array.isArray(activity) && activity.some((d) => d.total > 0);
  const totalRuns = Array.isArray(activity) ? activity.reduce((s, d) => s + (d.total || 0), 0) : 0;
  const sparse = totalRuns > 0 && totalRuns < 6; // small heuristic

  return (
    <article className="panel-surface rounded-xl p-6 outline-none focus:outline-none">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Recent Scan Activity</p>

      {!hasData ? (
        <div className="mt-6 text-sm text-zinc-400">No recent scan activity</div>
      ) : (
        <div className="mt-4 h-56 flex flex-col">
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%" className="outline-none focus:outline-none">
              <BarChart data={activity} className="outline-none" role="img">
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip cursor={false} content={<CustomTooltip />} />
                <Legend formatter={(value) => <span className="text-sm text-zinc-300">{value}</span>} />
                <Bar dataKey="completed" stackId="a" fill="#60a5fa" name="Completed" isAnimationActive={false} onMouseEnter={() => {}} onMouseLeave={() => {}} stroke="transparent" />
                <Bar dataKey="failed" stackId="a" fill="#fb7185" name="Failed" isAnimationActive={false} onMouseEnter={() => {}} onMouseLeave={() => {}} stroke="transparent" />
                <Bar dataKey="incomplete" stackId="a" fill="#f59e0b" name="Incomplete" isAnimationActive={false} onMouseEnter={() => {}} onMouseLeave={() => {}} stroke="transparent" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {null}
        </div>
      )}
    </article>
  );
}
