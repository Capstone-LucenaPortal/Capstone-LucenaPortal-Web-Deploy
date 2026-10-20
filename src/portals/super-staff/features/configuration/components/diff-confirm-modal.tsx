"use client";

import { Button } from "@/portals/super-staff/components/ui/button";
import { Modal } from "@/portals/super-staff/components/ui/modal";
import type { ConfigChange } from "../lib/diff";

export function DiffConfirmModal({
  open,
  moduleLabel,
  changes,
  snapshotNote,
  saving,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  moduleLabel: string;
  changes: ConfigChange[];
  snapshotNote: string;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel}>
      <h3 className="text-lg font-semibold text-gray-900">
        Save {moduleLabel} changes?
      </h3>
      <ul className="mt-4 divide-y divide-gray-100 rounded-md border border-gray-200">
        {changes.map((change, i) => (
          <li
            key={`${change.label}-${i}`}
            className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
          >
            <span className="text-gray-700">{change.label}</span>
            <span className="tabular-nums text-gray-900">
              <span className="text-gray-500">{change.before}</span>
              {" → "}
              <span className="font-medium">{change.after}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-gray-500">{snapshotNote}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={saving}>
          Save changes
        </Button>
      </div>
    </Modal>
  );
}
