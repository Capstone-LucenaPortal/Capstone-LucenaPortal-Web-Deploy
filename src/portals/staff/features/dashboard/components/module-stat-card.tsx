import Link from "next/link";
import { cn } from "@/portals/staff/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/portals/staff/components/ui/card";
import { Badge } from "@/portals/staff/components/ui/badge";
import type { ModuleCardData, PreviewItem } from "../types";

const MODULE_LABELS: Record<ModuleCardData["module"], string> = {
  "yellow-card": "Yellow Card",
  incidents: "Incidents",
  booking: "Booking",
};

const MODULE_HREFS: Record<ModuleCardData["module"], string> = {
  "yellow-card": "/staff/yellow-card",
  incidents: "/staff/incidents",
  booking: "/staff/booking",
};

const TAG_BADGE_VARIANT: Record<
  PreviewItem["tag"]["tone"],
  "destructive" | "warning" | "default"
> = {
  critical: "destructive",
  high: "warning",
  warning: "warning",
  neutral: "default",
};

function Figure({
  value,
  label,
  tone = "default",
}: {
  value: number;
  label: string;
  tone?: "default" | "warning" | "critical";
}) {
  return (
    <div className="flex flex-col">
      <span
        className={cn(
          "text-xl font-semibold tabular-nums",
          tone === "critical" && "text-red-600",
          tone === "warning" && "text-amber-600",
          tone === "default" && "text-gray-900"
        )}
      >
        {value}
      </span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

function StatFigures({ data }: { data: ModuleCardData }) {
  if (data.module === "yellow-card") {
    return (
      <div className="flex gap-6">
        {/*
          "Awaiting review", not "Pending": this figure counts the whole
          awaiting-review set — REVIEWABLE_STATUSES in the Yellow Card status
          module — while the queue has a narrower "Pending Review" tab.
          Labelling both "Pending" reads as a mismatch between two screens
          that are in fact both correct.
        */}
        <Figure value={data.pending} label="Awaiting review" />
        {/* Two colours on purpose: amber is At risk, red is Overdue, as on the
            queue's badge. Both are the database's deadline_state (l80). */}
        <Figure value={data.atRisk} label="At risk" tone="warning" />
        <Figure value={data.overdue} label="Overdue" tone="critical" />
      </div>
    );
  }

  if (data.module === "incidents") {
    return (
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {/* First: this is the module's backlog, the only figure here that is
            waiting on somebody in this building. */}
        <Figure value={data.awaitingTriage} label="Awaiting triage" />
        <Figure value={data.critical} label="Critical" tone="critical" />
        <Figure value={data.high} label="High" tone="warning" />
        <Figure value={data.slaBreaches} label="SLA breach" />
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <Figure value={data.awaitingQuote} label="Awaiting quote" tone="warning" />
      <Figure value={data.paymentVerification} label="Verify payment" tone="warning" />
      {/* A COUNT of confirmed bookings with money owed, not a peso total — the
          queue page's card of the same name IS pesos, and a currency figure
          beside two counts would read as a quantity. */}
      <Figure value={data.balanceOutstanding} label="Balance due" />
    </div>
  );
}

interface ModuleStatCardProps {
  data: ModuleCardData;
}

export function ModuleStatCard({ data }: ModuleStatCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{MODULE_LABELS[data.module]}</CardTitle>
      </CardHeader>
      <CardContent>
        <StatFigures data={data} />
        {data.preview.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-gray-100 pt-3">
            {data.preview.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 text-sm text-gray-600"
              >
                <span>{item.label}</span>
                <Badge variant={TAG_BADGE_VARIANT[item.tag.tone]}>
                  {item.tag.text}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={MODULE_HREFS[data.module]}
          className="mt-4 inline-block text-sm font-semibold text-lucena-blue hover:text-lucena-blue-dark"
        >
          View all →
        </Link>
      </CardContent>
    </Card>
  );
}
