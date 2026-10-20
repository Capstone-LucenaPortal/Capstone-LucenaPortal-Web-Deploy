"use client";

import { useState } from "react";
import { Input } from "@/portals/super-staff/components/ui/input";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import {
  ActiveCell,
  CatalogCard,
  CatalogRow,
  LabelCell,
  SortCell,
} from "@/portals/super-staff/features/configuration/components/catalog-card";
import {
  byCode,
  useCatalogEditor,
} from "@/portals/super-staff/features/configuration/hooks/use-catalog-editor";
import { toPostCategoryArgs } from "@/portals/super-staff/features/configuration/lib/catalog-args";
import { listPostCategories } from "@/portals/super-staff/features/configuration/lib/catalog-queries";
import {
  isHexColor,
  validatePostCategory,
} from "@/portals/super-staff/features/configuration/lib/validation";
import type { PostCategory } from "@/portals/super-staff/features/configuration/lib/catalog-types";

/**
 * Categories belong with the content they label, not in the Configuration tabs.
 *
 * ⚠️ The DATABASE owns color_hex. The original PRD assumed category colours were
 * presentation-side; they are not, and the announcements list already renders
 * its swatch from this column.
 */

/**
 * The colour rule moved to `configuration/lib/validation`, where it is tested
 * and where the editor's own `validate` seam can reach it. This function is
 * now just the call — a row that would raise 22023 never gets here, and the
 * RPC's own message still gets through if one fires anyway.
 */
async function commitCategory(row: PostCategory): Promise<void> {
  await callRpc("update_post_category", toPostCategoryArgs(row));
}

export function CategoryManager() {
  const [open, setOpen] = useState(false);
  const editor = useCatalogEditor<PostCategory>({
    load: listPostCategories,
    commit: commitCategory,
    validate: validatePostCategory,
    keyOf: byCode,
    label: "categories",
  });

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-sm font-medium text-lucena-blue hover:underline"
      >
        {open ? "Hide categories" : "Manage categories"}
        {editor.dirtyKeys.size > 0 && (
          <span className="ml-2 text-xs text-amber-600">
            {editor.dirtyKeys.size} unsaved
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3">
          <CatalogCard
            title="Post Categories"
            rowCount={editor.rows.length}
            headers={["Category", "Colour", "Sort", "Active"]}
            loading={editor.loading}
            error={editor.error}
            note="Colours are stored in the database and drive the swatch on this list and on the citizen portal."
          >
            {editor.rows.map((row) => {
              // Live feedback while typing; `validatePostCategory` is what
              // actually refuses the save.
              const badHex = row.colorHex !== null && !isHexColor(row.colorHex);
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
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label={`${row.code} colour`}
                        value={isHexColor(row.colorHex ?? "") ? row.colorHex! : "#000000"}
                        onChange={(e) =>
                          editor.update(row.code, { colorHex: e.target.value })
                        }
                        className="h-8 w-10 cursor-pointer rounded border border-gray-300"
                      />
                      <Input
                        aria-label={`${row.code} colour hex`}
                        value={row.colorHex ?? ""}
                        placeholder="#0B5FFF"
                        error={badHex ? "Use a 6-digit hex like #0B5FFF." : undefined}
                        onChange={(e) =>
                          editor.update(row.code, {
                            colorHex: e.target.value || null,
                          })
                        }
                      />
                    </div>
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
        </div>
      )}
    </div>
  );
}
