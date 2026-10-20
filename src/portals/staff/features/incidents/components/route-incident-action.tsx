"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/portals/staff/components/ui/modal";
import { Button } from "@/portals/staff/components/ui/button";
import { routeIncident } from "../lib/actions";
import { LEVEL_LABELS, LEVEL_ORDER, isRoutable } from "../lib/status";
import type { Incident, IncidentLevel } from "../types";

export function RouteIncidentAction({
  incident,
  departments,
}: {
  incident: Incident;
  /** [code, label] pairs from public_departments, in catalogue order. */
  departments: [string, string][];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [department, setDepartment] = useState(
    incident.assigned_department_code ??
      incident.suggested_department_code ??
      departments[0]?.[0] ??
      "",
  );
  const [level, setLevel] = useState<IncidentLevel>(incident.incident_level);
  const [note, setNote] = useState("");

  // route_incident would accept in_progress, but rerouting a claimed incident
  // leaves its responder attached to a department that no longer owns it — the
  // incident then vanishes from that responder's own list. Decision 7.
  if (incident.status === "in_progress") {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
        {incident.assigned_responder_name
          ? `Held by ${incident.assigned_responder_name}. `
          : "Currently claimed. "}
        A supervisor must release the claim before this incident can be
        rerouted.
      </div>
    );
  }

  if (!isRoutable(incident.status)) return null;

  const isReroute = incident.routed_at !== null;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await routeIncident({
        incidentId: incident.id,
        departmentCode: department,
        level,
        note,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setOpen(false);
      // Clear the note, or reopening the dialog to reroute silently re-attaches
      // the note from the previous routing to a different decision.
      setNote("");
      // The Server Action revalidated; refresh so this page re-reads rather
      // than showing the state it rendered with.
      router.refresh();
    });
  }

  return (
    <div>
      <Button onClick={() => setOpen(true)}>
        {isReroute ? "Reroute" : "Route to department"}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h2 className="text-lg font-bold text-gray-900">
          {isReroute ? "Reroute incident" : "Route incident"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Confirm the suggested department or override it.
        </p>

        <label
          htmlFor="route-department"
          className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          Department
        </label>
        <select
          id="route-department"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
        >
          {departments.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
              {code === incident.suggested_department_code ? " (suggested)" : ""}
            </option>
          ))}
        </select>

        {/* route_incident takes p_level, and triage is exactly where a level
            gets corrected — the catalogue's base_level is a guess from the
            incident type, not a judgement about this report. */}
        <label
          htmlFor="route-level"
          className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          Level
        </label>
        <select
          id="route-level"
          value={level}
          onChange={(event) => setLevel(event.target.value as IncidentLevel)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
        >
          {LEVEL_ORDER.map((value) => (
            <option key={value} value={value}>
              {LEVEL_LABELS[value]}
              {value === incident.incident_level ? " (current)" : ""}
            </option>
          ))}
        </select>

        <label
          htmlFor="route-note"
          className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          Note (optional)
        </label>
        <textarea
          id="route-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
        />

        {!incident.is_verified && (
          <p className="mt-3 rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
            This report is unverified — routing will not start the SLA clock
            until the citizen attaches a photo.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={pending || !department}>
            {pending ? "Saving…" : isReroute ? "Confirm reroute" : "Confirm route"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
