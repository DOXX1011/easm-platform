import React from "react";
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from "recharts";

export default function FindingsBySeverity({ counts }) {
  const data = [
    { name: "High", value: counts.High || 0 },
    { name: "Medium", value: counts.Medium || 0 },
    { name: "Low", value: counts.Low || 0 },
  ];

  const COLORS = ["#fb7185", "#fbbf24", "#34d399"]; // red, amber, green

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <article className="panel-surface rounded-xl p-6">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Findings by Severity</p>

      {total === 0 ? (
        <div className="mt-6 text-sm text-zinc-400">No findings available</div>
      ) : (
        <div className="mt-4 h-64 flex flex-col items-center justify-between">
          <div className="w-full flex-1 flex items-center justify-center">
            <div className="w-[220px] h-[220px] outline-none focus:outline-none">
              <ResponsiveContainer width="100%" height="100%" className="outline-none focus:outline-none">
                <PieChart className="outline-none focus:outline-none">
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={64}
                    outerRadius={96}
                    paddingAngle={0}
                    isAnimationActive={false}
                    style={{ pointerEvents: "none" }}
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                        stroke="transparent"
                        style={{ pointerEvents: "none", outline: "none" }}
                      />
                    ))}
                  </Pie>
                  <Tooltip cursor={false} content={() => null} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-2 flex justify-center gap-6 text-sm text-zinc-200">
            <div className="flex items-baseline gap-2">High: <span className="font-semibold text-red-300">{counts.High || 0}</span></div>
            <div className="flex items-baseline gap-2">Medium: <span className="font-semibold text-amber-300">{counts.Medium || 0}</span></div>
            <div className="flex items-baseline gap-2">Low: <span className="font-semibold text-emerald-300">{counts.Low || 0}</span></div>
          </div>
        </div>
      )}
    </article>
  );
}
