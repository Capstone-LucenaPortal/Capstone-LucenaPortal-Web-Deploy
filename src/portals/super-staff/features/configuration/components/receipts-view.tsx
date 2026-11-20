"use client";

import { useRef, useState } from "react";
import { Badge } from "@/portals/super-staff/components/ui/badge";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/portals/super-staff/components/ui/card";
import { Input } from "@/portals/super-staff/components/ui/input";
import {
  imageSrc,
  putSeal,
  validateImageFile,
} from "@/portals/super-staff/lib/storage/site-content";
import { rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import { ConfigLoadState } from "./config-load-state";
import { ConfigTabRail } from "./config-tab-rail";
import { DiffConfirmModal } from "./diff-confirm-modal";
import { useConfigEditor, type ConfigEditor } from "../hooks/use-config-editor";
import { diffAgencyIdentity, diffOfficer } from "../lib/diff";
import { toAgencyIdentityArgs, toOfficerArgs } from "../lib/receipts-args";
import { getAgencyIdentity, getOfficer } from "../lib/receipts-queries";
import {
  OFFICER_SERVICE_LABELS,
  OFFICER_SERVICES,
  type AgencyIdentity,
  type Officer,
  type OfficerService,
} from "../lib/receipts-types";
import { validateAgencyIdentity, validateOfficer } from "../lib/validation";

const OFFICER_NOTES = [
  "This save is one-way: once saved, this officer is no longer a placeholder, and there is no way back.",
  "It changes future receipts only. Receipts already issued keep the officer who was named when they were issued.",
];

const AGENCY_NOTE =
  "It changes future receipts only. Receipts already issued keep the agency name and seal they were issued with.";
const OLD_SEAL_NOTE = "The old seal stays on those receipts. Seals are never deleted.";

// ── Module scope — see the note in use-config-editor ────────────────────────
// `load` is an effect dependency, so each officer's loader needs a stable
// identity: one per service, built once.
const OFFICER_LOADERS = Object.fromEntries(
  OFFICER_SERVICES.map((service) => [service, () => getOfficer(service)]),
) as Record<OfficerService, () => Promise<Officer>>;

async function commitOfficer(after: Officer): Promise<Officer> {
  await callRpc("update_officer_of_record", toOfficerArgs(after));
  return getOfficer(after.service);
}

async function commitAgencyIdentity(after: AgencyIdentity): Promise<AgencyIdentity> {
  await callRpc("save_agency_identity", toAgencyIdentityArgs(after));
  return getAgencyIdentity();
}

function useOfficerEditor(service: OfficerService) {
  return useConfigEditor({
    load: OFFICER_LOADERS[service],
    diff: diffOfficer,
    validate: validateOfficer,
    commit: commitOfficer,
    moduleLabel: `Officer of Record (${OFFICER_SERVICE_LABELS[service]})`,
  });
}

function TextField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-900">
        {label}
      </label>
      <Input id={id} value={value} error={error} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Each card saves on its own, so it carries its own footer and dialog. */
function CardActions<T>({ editor }: { editor: ConfigEditor<T> }) {
  return (
    <div className="mt-4 flex justify-end gap-3">
      <Button
        variant="secondary"
        size="sm"
        onClick={editor.reset}
        disabled={!editor.dirty || editor.saving}
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={editor.requestSave}
        disabled={!editor.dirty || editor.saving}
      >
        Save
      </Button>
    </div>
  );
}

function OfficerCard({
  service,
  editor,
}: {
  service: OfficerService;
  editor: ConfigEditor<Officer>;
}) {
  const label = OFFICER_SERVICE_LABELS[service];
  const { draft, saved, errors, update } = editor;

  return (
    <Card role="region" aria-label={`${label} Officer of Record`}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>{label}</CardTitle>
          {/* From `saved`, not `draft`: only a confirmed save ends it. */}
          {saved?.isPlaceholder && (
            <Badge variant="warning">Placeholder: not yet nominated</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!draft || !saved ? (
          <ConfigLoadState error={editor.error} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <TextField
                id={`${service}-fullName`}
                label="Name"
                value={draft.fullName}
                error={errors.fullName}
                onChange={(fullName) => update({ fullName })}
              />
              <TextField
                id={`${service}-unit`}
                label="Unit"
                value={draft.unit}
                error={errors.unit}
                onChange={(unit) => update({ unit })}
              />
              <TextField
                id={`${service}-designation`}
                label="Designation"
                value={draft.designation}
                error={errors.designation}
                onChange={(designation) => update({ designation })}
              />
            </div>
            <CardActions editor={editor} />
          </>
        )}
      </CardContent>

      <DiffConfirmModal
        open={editor.confirmOpen}
        moduleLabel={`${label} Officer of Record`}
        changes={editor.changes}
        snapshotNote={OFFICER_NOTES}
        saving={editor.saving}
        onConfirm={editor.confirmSave}
        onCancel={() => editor.setConfirmOpen(false)}
      />
    </Card>
  );
}

function SealImage({ path, alt }: { path: string; alt: string }) {
  const src = imageSrc(path || null);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-24 w-24 rounded-md border border-gray-200 bg-white object-contain"
    />
  ) : (
    <div className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-gray-300 text-xs text-gray-500">
      No seal
    </div>
  );
}

/**
 * The seal field. A replacement is uploaded on pick, to a FRESH `agency/` path
 * (`putSeal` never upserts: l66 makes the seal insert-only), and only lands on
 * receipts once the card is saved. An upload that is never saved is left in
 * the bucket, which has no delete — acceptable, and not cleaned up.
 */
function SealField({
  sealPath,
  error,
  disabled,
  onUploaded,
}: {
  sealPath: string;
  error?: string;
  disabled: boolean;
  onUploaded: (path: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateImageFile(file);
    setUploadError(problem);
    if (problem) return;

    setBusy(true);
    try {
      onUploaded(await putSeal(file));
    } catch (e: unknown) {
      setUploadError(rpcErrorMessage(e, "Upload failed. Try again."));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-900">Seal</span>
      <SealImage path={sealPath} alt="Seal preview" />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        aria-label="Seal file"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <div>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : "Replace seal"}
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        JPEG or PNG, up to 5 MB. Every upload is kept; it reaches receipts only when you save.
      </p>
      {(uploadError ?? error) && (
        <p className="text-xs text-red-500">{uploadError ?? error}</p>
      )}
    </div>
  );
}

function AgencyIdentityCard({ editor }: { editor: ConfigEditor<AgencyIdentity> }) {
  const { draft, saved, errors, update } = editor;
  const sealChanged = !!draft && !!saved && draft.sealPath !== saved.sealPath;

  return (
    <Card role="region" aria-label="Agency identity">
      <CardHeader>
        <CardTitle>Agency identity</CardTitle>
      </CardHeader>
      <CardContent>
        {!draft || !saved ? (
          <ConfigLoadState error={editor.error} />
        ) : (
          <>
            <div className="grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
              <TextField
                id="agencyName"
                label="Agency name"
                value={draft.agencyName}
                error={errors.agencyName}
                onChange={(agencyName) => update({ agencyName })}
              />
              <SealField
                sealPath={draft.sealPath}
                error={errors.sealPath}
                disabled={editor.saving}
                onUploaded={(sealPath) => update({ sealPath })}
              />
            </div>
            <CardActions editor={editor} />
          </>
        )}
      </CardContent>

      <DiffConfirmModal
        open={editor.confirmOpen}
        moduleLabel="agency identity"
        changes={editor.changes}
        snapshotNote={sealChanged ? [AGENCY_NOTE, OLD_SEAL_NOTE] : AGENCY_NOTE}
        saving={editor.saving}
        onConfirm={editor.confirmSave}
        onCancel={() => editor.setConfirmOpen(false)}
      >
        {sealChanged && (
          <div className="mt-4 flex items-center gap-4">
            <SealImage path={saved.sealPath} alt="Seal before" />
            <span aria-hidden="true">→</span>
            <SealImage path={draft.sealPath} alt="Seal after" />
          </div>
        )}
      </DiffConfirmModal>
    </Card>
  );
}

export function ReceiptsView() {
  // Hooks in a fixed order, one per service — OFFICER_SERVICES is a constant.
  const officers: Record<OfficerService, ConfigEditor<Officer>> = {
    yellow_card: useOfficerEditor("yellow_card"),
    incidents: useOfficerEditor("incidents"),
    booking: useOfficerEditor("booking"),
  };

  const agency = useConfigEditor({
    load: getAgencyIdentity,
    diff: diffAgencyIdentity,
    validate: validateAgencyIdentity,
    commit: commitAgencyIdentity,
    moduleLabel: "Agency identity",
  });

  const anyDirty =
    agency.dirty || OFFICER_SERVICES.some((service) => officers[service].dirty);

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
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Officers of Record</h2>
          <p className="mt-1 text-sm text-gray-500">
            The officer named on each service&apos;s Acknowledgement Receipts. Each one saves on
            its own.
          </p>
        </div>

        {OFFICER_SERVICES.map((service) => (
          <OfficerCard key={service} service={service} editor={officers[service]} />
        ))}

        <AgencyIdentityCard editor={agency} />
      </div>
    </div>
  );
}
