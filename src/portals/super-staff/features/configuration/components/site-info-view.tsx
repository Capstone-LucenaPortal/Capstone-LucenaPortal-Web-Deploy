"use client";

import { Button } from "@/portals/super-staff/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/portals/super-staff/components/ui/card";
import { Input, numValue } from "@/portals/super-staff/components/ui/input";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import {
  ActiveCell,
  CatalogCard,
  CatalogRow,
  LabelCell,
  SortCell,
  TextCell,
} from "./catalog-card";
import { ConfigLoadState } from "./config-load-state";
import { ConfigTabRail } from "./config-tab-rail";
import { DiffConfirmModal } from "./diff-confirm-modal";
import { useCatalogEditor, type CatalogEditor } from "../hooks/use-catalog-editor";
import { useConfigEditor } from "../hooks/use-config-editor";
import { diffSiteInfo } from "../lib/diff";
import { toSiteInfoArgs, toSiteInfoEntryArgs } from "../lib/site-info-args";
import { getSiteInfo, listSiteInfoEntries } from "../lib/site-info-queries";
import type { SiteInfo, SiteInfoEntry } from "../lib/site-info-types";
import { validateSiteInfo, validateSiteInfoEntry } from "../lib/validation";

const SNAPSHOT_NOTE =
  "These details are published to citizens on the next page load.";

// ── Module scope — see the note in use-config-editor / use-catalog-editor ───
const byId = (r: SiteInfoEntry) => r.id;

async function commitSiteInfo(after: SiteInfo): Promise<SiteInfo> {
  await callRpc("save_site_info", toSiteInfoArgs(after));
  return getSiteInfo();
}

async function commitEntry(row: SiteInfoEntry): Promise<void> {
  await callRpc("update_site_info_entry", toSiteInfoEntryArgs(row));
}

function EntriesCard({
  title,
  note,
  editor,
  rows,
}: {
  title: string;
  note?: string;
  editor: CatalogEditor<SiteInfoEntry>;
  rows: SiteInfoEntry[];
}) {
  return (
    <CatalogCard
      title={title}
      rowCount={rows.length}
      headers={["Label", "Value", "Sort", "Active"]}
      loading={editor.loading}
      error={editor.error}
      note={note}
    >
      {rows.map((row) => (
        <CatalogRow
          key={row.id}
          isActive={row.isActive}
          dirty={editor.dirtyKeys.has(row.id)}
          saving={editor.savingKey === row.id}
          onSave={() => void editor.save(row.id)}
          onRevert={() => editor.revert(row.id)}
        >
          {/* An entry is keyed by id, not by code: two rows share the label
              "Secondary Emergency" and the owner ruled both must stay. */}
          <LabelCell
            rowKey={row.id}
            value={row.label}
            errors={editor.rowErrors[row.id]}
            onChange={(label) => editor.update(row.id, { label })}
          />
          <TextCell
            rowKey={row.id}
            field="value"
            value={row.value}
            errors={editor.rowErrors[row.id]}
            onChange={(value) => editor.update(row.id, { value })}
          />
          <SortCell
            rowKey={row.id}
            value={row.sortOrder}
            errors={editor.rowErrors[row.id]}
            onChange={(sortOrder) => editor.update(row.id, { sortOrder })}
          />
          <ActiveCell
            rowKey={row.id}
            checked={row.isActive}
            onChange={(isActive) => editor.update(row.id, { isActive })}
          />
        </CatalogRow>
      ))}
    </CatalogCard>
  );
}

export function SiteInfoView() {
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
    load: getSiteInfo,
    diff: diffSiteInfo,
    validate: validateSiteInfo,
    commit: commitSiteInfo,
    moduleLabel: "Site info",
  });

  const entries = useCatalogEditor<SiteInfoEntry>({
    load: listSiteInfoEntries,
    commit: commitEntry,
    validate: validateSiteInfoEntry,
    keyOf: byId,
    label: "site information",
  });

  const anyDirty = dirty || entries.dirtyKeys.size > 0;

  const hotlines = entries.rows.filter((r) => r.kind === "emergency_hotline");
  const officeContacts = entries.rows.filter((r) => r.kind === "office_contact");
  const floorDirectory = entries.rows.filter((r) => r.kind === "floor_directory");

  if (!draft || !saved) {
    return <ConfigLoadState error={error} />;
  }

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
            <CardTitle>Contact Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="trunkline"
                  className="text-sm font-medium text-gray-900"
                >
                  Trunkline
                </label>
                <Input
                  id="trunkline"
                  value={draft.trunkline}
                  error={errors.trunkline}
                  onChange={(e) => update({ trunkline: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="officeHours"
                  className="text-sm font-medium text-gray-900"
                >
                  Office hours
                </label>
                <Input
                  id="officeHours"
                  value={draft.officeHours}
                  error={errors.officeHours}
                  onChange={(e) => update({ officeHours: e.target.value })}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Published to citizens on the city homepage.
            </p>
          </CardContent>
        </Card>

        <EntriesCard
          title="Emergency Hotlines"
          note="These numbers are published to citizens. Order is meaningful and labels are not unique."
          editor={entries}
          rows={hotlines}
        />

        {/* office_contact is seeded empty. Render its section only when it has
            rows, so the screen does not show an empty list for a list nobody
            has filled. */}
        {officeContacts.length > 0 && (
          <EntriesCard title="Office Contacts" editor={entries} rows={officeContacts} />
        )}

        <EntriesCard title="Floor Directory" editor={entries} rows={floorDirectory} />
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
        moduleLabel="Site info"
        changes={changes}
        snapshotNote={SNAPSHOT_NOTE}
        saving={saving}
        onConfirm={confirmSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
