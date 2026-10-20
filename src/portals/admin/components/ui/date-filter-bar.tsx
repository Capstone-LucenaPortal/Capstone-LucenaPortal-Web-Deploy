// src/portals/admin/components/ui/date-filter-bar.tsx
"use client";

import { DateRangeKey } from "@/portals/admin/lib/dates";

export type DateFilterPreset = DateRangeKey | "Custom";

const PRESETS: DateRangeKey[] = ["Today", "Week", "Month", "Quarter", "Annual"];

interface BasisOption<B extends string> {
  value: B;
  label: string;
}

interface DateFilterBarProps<B extends string> {
  basisOptions: readonly BasisOption<B>[];
  dateBasis: B;
  onDateBasisChange: (basis: B) => void;
  preset: DateFilterPreset;
  onPresetChange: (preset: DateFilterPreset) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (date: string) => void;
  onCustomEndChange: (date: string) => void;
  compare: boolean;
  onCompareChange: (compare: boolean) => void;
  tone?: "light" | "dark";
}

const CONTROL_CLASSES =
  "h-8 rounded-none border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-900";

export function DateFilterBar<B extends string>({
  basisOptions,
  dateBasis,
  onDateBasisChange,
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  compare,
  onCompareChange,
  tone = "light",
}: DateFilterBarProps<B>) {
  const isCustom = preset === "Custom";
  const dark = tone === "dark";
  const activePresetClasses = dark
    ? "z-10 border-white bg-white text-blue-950"
    : "z-10 border-blue-900 bg-blue-900 text-white";
  const activeCustomClasses = dark
    ? "border-white bg-white text-blue-950"
    : "border-blue-900 bg-blue-900 text-white";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          aria-label="Date type"
          value={dateBasis}
          onChange={(event) => onDateBasisChange(event.target.value as B)}
          className={CONTROL_CLASSES}
        >
          {basisOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="flex" role="group" aria-label="Date range preset">
          {PRESETS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onPresetChange(key)}
              className={`-ml-px h-8 border px-3 text-xs font-medium first:ml-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-900 ${
                preset === key
                  ? activePresetClasses
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <div
          className={`flex items-center border ${
            isCustom ? (dark ? "border-white" : "border-blue-900") : "border-gray-300"
          }`}
        >
          <span
            className={`h-8 border-r px-2 text-xs font-medium leading-8 ${
              isCustom
                ? activeCustomClasses
                : "border-gray-300 bg-gray-50 text-gray-600"
            }`}
          >
            Custom
          </span>
          <input
            type="date"
            aria-label="Custom range start"
            value={customStart}
            max={customEnd}
            onChange={(event) => {
              onCustomStartChange(event.target.value);
              onPresetChange("Custom");
            }}
            className="h-8 border-0 bg-white px-2 text-xs text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-900"
          />
          <span className={`text-xs ${dark ? "text-white/60" : "text-gray-500"}`}>–</span>
          <input
            type="date"
            aria-label="Custom range end"
            value={customEnd}
            min={customStart}
            onChange={(event) => {
              onCustomEndChange(event.target.value);
              onPresetChange("Custom");
            }}
            className="h-8 border-0 bg-white px-2 text-xs text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-900"
          />
        </div>

        <label
          className={`flex cursor-pointer items-center gap-1.5 text-xs font-medium ${
            dark ? "text-white" : "text-gray-700"
          }`}
        >
          <input
            type="checkbox"
            checked={compare}
            onChange={(event) => onCompareChange(event.target.checked)}
            className="h-3.5 w-3.5 rounded-none accent-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-900"
          />
          Compare to previous period
        </label>
      </div>
    </div>
  );
}
