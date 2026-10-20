import Link from "next/link";
import { cn } from "@/portals/staff/lib/utils";
import type { IncidentQueueItem } from "../types";

/**
 * "Duplicate of INC-…", linking to the Original. Shared by the queue row and
 * the detail header so the rule below has one home.
 *
 * Both columns or neither: the view resolves the reference from the id, so a
 * Duplicate whose Original the officer cannot read shows nothing rather than a
 * link with no name.
 */
export function DuplicateOfLink({
  incident,
  className,
}: {
  incident: Pick<IncidentQueueItem, "duplicate_of" | "original_reference">;
  className?: string;
}) {
  if (!incident.duplicate_of || !incident.original_reference) return null;

  return (
    <p className={cn("text-gray-500", className)}>
      Duplicate of{" "}
      <Link
        href={`/staff/incidents/${incident.duplicate_of}`}
        className="font-medium text-lucena-blue hover:underline"
      >
        {incident.original_reference}
      </Link>
    </p>
  );
}
