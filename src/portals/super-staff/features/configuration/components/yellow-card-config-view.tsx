"use client";

import { Button } from "@/portals/super-staff/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/portals/super-staff/components/ui/card";
import { Input, numValue } from "@/portals/super-staff/components/ui/input";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import { ConfigLoadState } from "./config-load-state";
import { ConfigTabRail } from "./config-tab-rail";
import { DiffConfirmModal } from "./diff-confirm-modal";
import { ImpactNote } from "./impact-note";
import { DocumentTypesCard } from "./yellow-card-catalogs";
import { useDocumentTypesEditor } from "../hooks/use-catalog-editors";
import { useConfigEditor } from "../hooks/use-config-editor";
import { toYellowCardConfigArgs } from "../lib/config-args";
import { diffYellowCard } from "../lib/diff";
import { yellowCardImpact } from "../lib/impact";
import { getYellowCardConfig } from "../lib/queries";
import { validateYellowCard } from "../lib/validation";
import type { YellowCardConfig } from "../types";

// Two knobs, two rules (l80): the target is snapshotted per application, the
// threshold is read live. One note covering both must say which is which.
const SNAPSHOT_NOTE =
  "A new processing target applies to new applications only; in-flight applications keep their current target. A new at-risk threshold applies at once to every running application.";

/** Module scope — see the note in use-config-editor on the load effect. */
async function commitYellowCard(after: YellowCardConfig): Promise<YellowCardConfig> {
  await callRpc("save_yellow_card_config", toYellowCardConfigArgs(after));
  return getYellowCardConfig();
}

export function YellowCardConfigView() {
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
    load: getYellowCardConfig,
    diff: diffYellowCard,
    validate: validateYellowCard,
    commit: commitYellowCard,
    moduleLabel: "Yellow Card",
  });

  // Called before the early return — hooks cannot be conditional.
  const documentTypes = useDocumentTypesEditor();
  const anyDirty = dirty || documentTypes.dirtyKeys.size > 0;

  if (!draft || !saved) {
    return <ConfigLoadState error={error} />;
  }

  const impact = yellowCardImpact(saved, draft);

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
            <CardTitle>Processing-Time Target</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex max-w-xs flex-col gap-1">
              <label
                htmlFor="processingDays"
                className="text-sm font-medium text-gray-900"
              >
                Target (working days)
              </label>
              <Input
                id="processingDays"
                type="number"
                min={1}
                value={numValue(draft.processingTimeTargetDays)}
                error={errors.processingDays}
                onChange={(e) =>
                  update({ processingTimeTargetDays: e.target.valueAsNumber })
                }
              />
              <p className="text-xs text-gray-500">
                Applications should reach a decision within this many working days.
                Sets each application&apos;s Processing Deadline.
              </p>
            </div>
            <ImpactNote>{impact.target}</ImpactNote>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>At-Risk Threshold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex max-w-xs flex-col gap-1">
              <label htmlFor="ycAtRisk" className="text-sm font-medium text-gray-900">
                Flag at (% of target used)
              </label>
              <Input
                id="ycAtRisk"
                type="number"
                min={1}
                max={99}
                value={numValue(draft.atRiskThresholdPct)}
                error={errors.atRisk}
                onChange={(e) => update({ atRiskThresholdPct: e.target.valueAsNumber })}
              />
              <p className="text-xs text-gray-500">
                Staff see an application as at risk once it has used this share of its
                processing target in working time. Internal to staff; citizens never see it.
              </p>
            </div>
            <ImpactNote>{impact.atRisk}</ImpactNote>
          </CardContent>
        </Card>

        <DocumentTypesCard editor={documentTypes} />
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
        moduleLabel="Yellow Card"
        changes={changes}
        snapshotNote={SNAPSHOT_NOTE}
        saving={saving}
        onConfirm={confirmSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
