"use client";

import { Button } from "@/portals/super-staff/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/portals/super-staff/components/ui/card";
import { Input, numValue } from "@/portals/super-staff/components/ui/input";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import { ConfigLoadState } from "./config-load-state";
import { ConfigTabRail } from "./config-tab-rail";
import { DiffConfirmModal } from "./diff-confirm-modal";
import { DepartmentsCard, IncidentTypesCard } from "./incident-catalogs";
import { ImpactNote } from "./impact-note";
import {
  useDepartmentsEditor,
  useIncidentTypesEditor,
} from "../hooks/use-catalog-editors";
import { useConfigEditor } from "../hooks/use-config-editor";
import { toIncidentConfigArgs } from "../lib/config-args";
import { diffIncidents } from "../lib/diff";
import { incidentImpact } from "../lib/impact";
import { getIncidentsConfig } from "../lib/queries";
import { validateIncidents } from "../lib/validation";
import type { IncidentLevel, IncidentsConfig } from "../types";

const LEVELS: IncidentLevel[] = ["Critical", "High", "Medium", "Low"];
const SNAPSHOT_NOTE =
  "Applies to incidents armed after this change. In-flight records keep their current targets.";

/** Module scope — see the note in use-config-editor on the load effect. */
async function commitIncidents(after: IncidentsConfig): Promise<IncidentsConfig> {
  await callRpc("save_incident_config", toIncidentConfigArgs(after));
  return getIncidentsConfig();
}

export function IncidentsConfigView() {
  const {
    draft,
    saved,
    update,
    errors,
    changes,
    dirty,
    confirmOpen,
    setConfirmOpen,
    saving,
    requestSave,
    confirmSave,
    reset,
    error,
  } = useConfigEditor({
    load: getIncidentsConfig,
    diff: diffIncidents,
    validate: validateIncidents,
    commit: commitIncidents,
    moduleLabel: "Incidents",
  });

  // Called before the early return — hooks cannot be conditional.
  const departments = useDepartmentsEditor();
  const incidentTypes = useIncidentTypesEditor();

  const anyDirty =
    dirty || departments.dirtyKeys.size > 0 || incidentTypes.dirtyKeys.size > 0;

  if (!draft || !saved) {
    return <ConfigLoadState error={error} />;
  }

  const impact = incidentImpact(saved, draft);

  const setLevel = (level: IncidentLevel, hours: number) =>
    update({ slaHours: { ...draft.slaHours, [level]: hours } });

  return (
    <div className="pb-24">
      <div>
        <h1 className="text-3xl font-bold text-lucena-blue">Configuration</h1>
        <p className="text-gray-500 mt-2">
          Edit business-rule constants. Changes apply to new records only.
        </p>
      </div>

      <div className="mt-6">
        <ConfigTabRail dirty={anyDirty} />
      </div>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>SLA Hours by Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {LEVELS.map((level) => (
                <div key={level} className="flex flex-col gap-1">
                  <label
                    htmlFor={`sla-${level}`}
                    className="text-sm font-medium text-gray-900"
                  >
                    {level} (hours)
                  </label>
                  <Input
                    id={`sla-${level}`}
                    type="number"
                    min={1}
                    value={numValue(draft.slaHours[level])}
                    error={errors[`sla-${level}`]}
                    onChange={(e) => setLevel(level, e.target.valueAsNumber)}
                  />
                </div>
              ))}
            </div>
            <ImpactNote>{impact.sla}</ImpactNote>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>At-Risk Threshold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex max-w-xs flex-col gap-1">
              <label htmlFor="atRisk" className="text-sm font-medium text-gray-900">
                At-risk at (% of SLA window)
              </label>
              <Input
                id="atRisk"
                type="number"
                min={1}
                max={99}
                value={numValue(draft.atRiskThresholdPct)}
                error={errors.atRisk}
                onChange={(e) =>
                  update({ atRiskThresholdPct: e.target.valueAsNumber })
                }
              />
              <p className="text-xs text-gray-500">
                Incidents flag as at-risk once this % of the SLA window has passed.
              </p>
            </div>
            <ImpactNote>{impact.atRisk}</ImpactNote>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unverified Incident Handling</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="nudgeDay" className="text-sm font-medium text-gray-900">
                  Nudge citizen on day
                </label>
                <Input
                  id="nudgeDay"
                  type="number"
                  min={1}
                  value={numValue(draft.nudgeDay)}
                  error={errors.nudgeDay}
                  onChange={(e) => update({ nudgeDay: e.target.valueAsNumber })}
                />
              </div>
              {/*
                l57 runs two distinct sweeper passes: it closes a RESOLVED,
                unconfirmed report as `auto_confirmed` on auto_close_day, and
                closes a NEVER-VERIFIED report as `expired_unverified` after
                confirmation_window_days. The old single label conflated them.
              */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="autoCloseDay"
                  className="text-sm font-medium text-gray-900"
                >
                  Auto-close a resolved report on day
                </label>
                <Input
                  id="autoCloseDay"
                  type="number"
                  min={1}
                  value={numValue(draft.autoCloseDay)}
                  error={errors.autoCloseDay}
                  onChange={(e) => update({ autoCloseDay: e.target.valueAsNumber })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="confirmationWindow"
                  className="text-sm font-medium text-gray-900"
                >
                  Close a never-verified report after (days)
                </label>
                <Input
                  id="confirmationWindow"
                  type="number"
                  min={1}
                  value={numValue(draft.confirmationWindowDays)}
                  error={errors.confirmationWindow}
                  onChange={(e) =>
                    update({ confirmationWindowDays: e.target.valueAsNumber })
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="maxActiveReports"
                  className="text-sm font-medium text-gray-900"
                >
                  Max active reports per citizen
                </label>
                <Input
                  id="maxActiveReports"
                  type="number"
                  min={1}
                  value={numValue(draft.maxActiveReportsPerCitizen)}
                  error={errors.maxActiveReports}
                  onChange={(e) =>
                    update({ maxActiveReportsPerCitizen: e.target.valueAsNumber })
                  }
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              A nightly job applies these. Nudge must fall before auto-close.
            </p>
            <ImpactNote>{impact.unverified}</ImpactNote>
          </CardContent>
        </Card>

        <DepartmentsCard editor={departments} />
        <IncidentTypesCard editor={incidentTypes} departments={departments.rows} />
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 py-4">
        <Button variant="secondary" onClick={reset} disabled={!dirty || saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={requestSave} disabled={!dirty || saving}>
          Save changes
        </Button>
      </div>

      <DiffConfirmModal
        open={confirmOpen}
        moduleLabel="Incidents"
        changes={changes}
        snapshotNote={SNAPSHOT_NOTE}
        saving={saving}
        onConfirm={confirmSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
