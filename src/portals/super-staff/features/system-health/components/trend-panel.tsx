"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatManilaHourMinute } from "../lib/format";
import type { HealthSample } from "../types";
import { Panel } from "./panel";

type TrendLine = { key: "connections" | "emailQueued" | "pushQueued"; name: string; color: string };

/** A 24 h trend line from the 5-minute samples. */
export function TrendPanel({
  title,
  samples,
  lines,
}: {
  title: string;
  samples: HealthSample[];
  lines: TrendLine[];
}) {
  return (
    <Panel title={title}>
      {samples.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-gray-500">
          No samples in the last 24 h yet. One is taken every 5 minutes.
        </p>
      ) : (
        <div className="h-40 px-5 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={samples} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="sampledAt"
                tickFormatter={formatManilaHourMinute}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                minTickGap={40}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip labelFormatter={(v) => `${formatManilaHourMinute(String(v))} (Asia/Manila)`} />
              {lines.length > 1 && <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />}
              {lines.map((l) => (
                <Line
                  key={l.key}
                  type="monotone"
                  dataKey={l.key}
                  name={l.name}
                  stroke={l.color}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
