"use client";

import {
  ActiveCell,
  CatalogCard,
  CatalogRow,
  CheckboxCell,
  LabelCell,
  SortCell,
} from "./catalog-card";
import type { CatalogEditor } from "../hooks/use-catalog-editor";
import type { YellowCardDocumentType } from "../lib/catalog-types";

/**
 * This table IS the original PRD's "service_info requirements list" — it
 * already existed, so that PRD item needed no new schema.
 *
 * Presentation only — the editor lives in `../hooks/use-catalog-editors`.
 */
export function DocumentTypesCard({
  editor,
}: {
  editor: CatalogEditor<YellowCardDocumentType>;
}) {
  return (
    <CatalogCard
      title="Required Documents"
      rowCount={editor.rows.length}
      headers={["Document", "Required", "Sort", "Active"]}
      loading={editor.loading}
      error={editor.error}
      note="Required documents must be uploaded before an application can be submitted."
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
          <CheckboxCell
            rowKey={row.code}
            field="required"
            checked={row.isRequired}
            onChange={(isRequired) => editor.update(row.code, { isRequired })}
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
