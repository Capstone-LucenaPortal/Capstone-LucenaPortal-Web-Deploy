import { Badge } from "@/portals/super-staff/components/ui/badge";
import { PRIORITY_LABEL, STATUS_LABEL, type IssuePriority, type IssueStatus } from "../types";

const STATUS_VARIANT: Record<IssueStatus, "info" | "warning" | "success" | "default"> = {
  open: "info",
  in_progress: "warning",
  resolved: "success",
  closed: "default",
};

export function IssueStatusPill({ status }: { status: IssueStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

const PRIORITY_STYLE: Record<IssuePriority, string> = {
  high: "bg-red-700 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-gray-500 text-white",
};

/** A dashed pill while not prioritised: that is the triage still to do. */
export function PriorityPill({ priority }: { priority: IssuePriority | null }) {
  if (priority === null) {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full border border-dashed border-gray-400 px-2.5 py-0.5 text-xs text-gray-500">
        Not prioritised
      </span>
    );
  }
  return <Badge className={PRIORITY_STYLE[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
}
