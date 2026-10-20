"use client";

import { Select } from "@/portals/super-staff/components/ui/select";
import {
  ActiveCell,
  CatalogCard,
  CatalogRow,
  LabelCell,
  ReadOnlyCell,
  SortCell,
} from "./catalog-card";
import type { CatalogEditor } from "../hooks/use-catalog-editor";
import type { Department, IncidentType } from "../lib/catalog-types";

/** Presentation only — the editors live in `../hooks/use-catalog-editors`. */

// ── Departments ────────────────────────────────────────────────────────────
export function DepartmentsCard({ editor }: { editor: CatalogEditor<Department> }) {
  return (
    <CatalogCard
      title="Departments"
      rowCount={editor.rows.length}
      headers={["Department", "Sort", "Active"]}
      loading={editor.loading}
      error={editor.error}
      note="Deactivating a department removes it from Staff's routing dropdown. Incidents already routed to it keep their assignment."
    >
      {editor.rows.map((row) => (
        <CatalogRow
          key={row.code}
          isActive={row.isActive}
          dirty={editor.dirtyKeys.has(row.code)}
          saving={editor.savingKey === row.code}
          onSave={() => void editor.save(row.code)}
          onRevert={() => editor.revert(row.code)}
        >
          <LabelCell
            rowKey={row.code}
            value={row.label}
            errors={editor.rowErrors[row.code]}
            onChange={(label) => editor.update(row.code, { label })}
          />
          <SortCell
            rowKey={row.code}
            value={row.sortOrder}
            errors={editor.rowErrors[row.code]}
            onChange={(sortOrder) => editor.update(row.code, { sortOrder })}
          />
          <ActiveCell
            rowKey={row.code}
            checked={row.isActive}
            onChange={(isActive) => editor.update(row.code, { isActive })}
          />
        </CatalogRow>
      ))}
    </CatalogCard>
  );
}

// ── Incident types ─────────────────────────────────────────────────────────
export function IncidentTypesCard({
  editor,
  departments,
}: {
  editor: CatalogEditor<IncidentType>;
  departments: Department[];
}) {
  // update_incident_type raises 22023 for an INACTIVE department, so offering
  // one would produce a guaranteed error. The row's own current department is
  // kept in the list even if inactive — dropping it would silently re-point the
  // type at whatever option happened to land first.
  const active = departments.filter((d) => d.isActive);

  return (
    <CatalogCard
      title="Incident Types"
      rowCount={editor.rows.length}
      headers={["Type", "Base level", "Default department", "Sort", "Active"]}
      loading={editor.loading}
      error={editor.error}
      note={
        <>
          Response-time promises are set by migration. <code>doc 00 §8</code>{" "}
          lists them as unresolved and owned by the LGU,{" "}
          <code>inc_on_submit()</code> stamps the value onto every incoming
          report to start its SLA clock, and the citizen form publishes it. Once
          the LGU confirms them in writing they can become editable.
        </>
      }
    >
      {editor.rows.map((row) => {
        const options =
          row.defaultDepartmentCode &&
          !active.some((d) => d.code === row.defaultDepartmentCode)
            ? [
                ...active,
                departments.find((d) => d.code === row.defaultDepartmentCode) ?? {
                  code: row.defaultDepartmentCode,
                  label: `${row.defaultDepartmentCode} (inactive)`,
                  sortOrder: 0,
                  isActive: false,
                },
              ]
            : active;

        return (
          <CatalogRow
            key={row.code}
            isActive={row.isActive}
            dirty={editor.dirtyKeys.has(row.code)}
            saving={editor.savingKey === row.code}
            onSave={() => void editor.save(row.code)}
            onRevert={() => editor.revert(row.code)}
          >
            <LabelCell
              rowKey={row.code}
              value={row.label}
              errors={editor.rowErrors[row.code]}
              onChange={(label) => editor.update(row.code, { label })}
            />
            {/* base_level is READ-ONLY — a public promise the LGU owns.
                category_code is omitted entirely: taxonomy the editor cannot
                act on. */}
            <td className="px-4 py-2">
              <ReadOnlyCell>{row.baseLevel}</ReadOnlyCell>
            </td>
            <td className="px-4 py-2">
              <Select
                aria-label={`${row.code} default department`}
                value={row.defaultDepartmentCode ?? ""}
                onChange={(e) =>
                  editor.update(row.code, {
                    defaultDepartmentCode: e.target.value || null,
                  })
                }
              >
                <option value="">Unassigned</option>
                {options.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </td>
            <SortCell
              rowKey={row.code}
              value={row.sortOrder}
              errors={editor.rowErrors[row.code]}
              onChange={(sortOrder) => editor.update(row.code, { sortOrder })}
            />
            <ActiveCell
              rowKey={row.code}
              checked={row.isActive}
              onChange={(isActive) => editor.update(row.code, { isActive })}
            />
          </CatalogRow>
        );
      })}
    </CatalogCard>
  );
}
