"use client";

import { createContext, useContext } from "react";
import { useSystemHealth, type SystemHealthData } from "../hooks/use-system-health";
import { formatManilaClock } from "../lib/format";
import { SectionNav } from "./section-nav";

const DataContext = createContext<SystemHealthData | null>(null);

/** The loaded reading, for a page inside System Health. The shell renders pages only once it has one. */
export function useSystemHealthData(): SystemHealthData {
  const data = useContext(DataContext);
  if (data === null) throw new Error("useSystemHealthData is used outside SystemHealthShell");
  return data;
}

/**
 * Super-staff's System Health (#72–#75, ADR 0008): whether the software
 * itself is working. Wraps General and every section page: one load, refreshed
 * every 60 s, shared by the page and the second-level nav, which stays put as
 * the officer moves between sections.
 */
export function SystemHealthShell({ children }: { children: React.ReactNode }) {
  const state = useSystemHealth();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold text-lucena-blue">System Health</h1>
          <p className="text-gray-500 mt-2">
            Whether the software itself is working: the Citizen services, and the database,
            storage, notifications, background jobs and sign-in they depend on.
          </p>
        </div>
        {state.kind === "ready" && (
          <p className="text-sm text-gray-500">
            Updated {formatManilaClock(state.data.loadedAt)} (Asia/Manila)
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <SectionNav data={state.kind === "ready" ? state.data : null} />
        <div className="min-w-0 flex-1">
          {state.kind === "error" ? (
            <p className="text-sm text-red-500">{state.message}</p>
          ) : state.kind === "loading" ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              {state.refreshError !== null && (
                <p className="mb-4 text-sm text-red-500">
                  {state.refreshError} Showing the last good reading.
                </p>
              )}
              <DataContext.Provider value={state.data}>{children}</DataContext.Provider>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
