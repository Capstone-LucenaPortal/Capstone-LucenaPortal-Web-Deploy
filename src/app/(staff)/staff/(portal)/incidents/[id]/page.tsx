import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/portals/staff/components/ui/card";
import { BackLink } from "@/portals/staff/components/ui/back-link";
import { Badge } from "@/portals/staff/components/ui/badge";
import { formatDate, formatDateTime } from "@/portals/staff/lib/utils";
import { getCurrentStaffUser } from "@/portals/staff/features/auth/lib/session";
import { getAtRiskThreshold } from "@/portals/staff/features/incidents/lib/config";
import { getIncidentDossier } from "@/portals/staff/features/incidents/lib/incident-dossier";
import { IncidentTimeline } from "@/portals/staff/features/incidents/components/incident-timeline";
import { EvidenceStrip } from "@/portals/staff/features/incidents/components/evidence-strip";
import { IncidentStatusBadge } from "@/portals/staff/features/incidents/components/incident-status-badge";
import { IncidentLevelBadge } from "@/portals/staff/features/incidents/components/incident-level-badge";
import { ClosureReasonBadge } from "@/portals/staff/features/incidents/components/closure-reason-badge";
import { DuplicateOfLink } from "@/portals/staff/features/incidents/components/duplicate-of-link";
import { SlaIndicator } from "@/portals/staff/features/incidents/components/sla-indicator";
import { RouteIncidentAction } from "@/portals/staff/features/incidents/components/route-incident-action";
import { ForceReleaseAction } from "@/portals/staff/features/incidents/components/force-release-action";
import { RefuseIncidentAction } from "@/portals/staff/features/incidents/components/refuse-incident-action";
import { isRoutable } from "@/portals/staff/features/incidents/lib/status";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-gray-900">{value}</p>
    </div>
  );
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dossier = await getIncidentDossier(id);

  // Null covers both "no such incident" and "not visible to you" — the view
  // returns no rows for either, and the page must not distinguish them.
  if (!dossier) notFound();

  // Two reads beside the dossier, not folded into it. The session answers "who
  // is looking" rather than "what is being looked at". The threshold is a fact
  // about the office's configuration rather than about this incident, and is
  // the one figure here the Queue screen also reads — folding it in would give
  // it two owners.
  //
  // Both come after the guard, so an id that resolves to nothing still fires
  // nothing else. Unlike Yellow Card's detail route, that is not free here: the
  // (portal) layout has already started the profile read in this same render
  // pass, but nothing above starts the threshold read, so this pays a serial
  // round-trip to the one-row incident config view that used to run alongside
  // the event and photo reads. The read is serial, and accepted: the only thing
  // that would relieve it is starting it before the guard, which ADR-0004
  // rejects by name. See ADR-0004.
  const [user, threshold] = await Promise.all([
    getCurrentStaffUser(),
    getAtRiskThreshold(),
  ]);

  const {
    incident,
    events,
    photos,
    suggestedDepartmentLabel,
    assignedDepartmentLabel,
    departmentOptions,
  } = dossier;

  const now = new Date();
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    incident.address,
  )}`;

  return (
    <div>
      <BackLink href="/staff/incidents" label="Back to Incidents" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-lucena-blue">
            {incident.type_label}
          </h1>
          <p className="mt-1 text-gray-500">
            {incident.reference_number} · Submitted{" "}
            {formatDate(incident.submitted_at)}
            {incident.reopened_count > 0 &&
              ` · Reopened ${incident.reopened_count}×`}
          </p>
          <DuplicateOfLink incident={incident} className="mt-1 text-sm" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <IncidentLevelBadge level={incident.incident_level} />
          <IncidentStatusBadge status={incident.status} />
          <ClosureReasonBadge reason={incident.closure_reason} />
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Report</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Description" value={incident.description} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Address
            </p>
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-sm text-lucena-blue hover:underline"
            >
              {incident.address}
            </a>
          </div>
          <Field label="Barangay" value={incident.barangay_name} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Verification
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={incident.is_verified ? "success" : "warning"}>
                {incident.is_verified ? "Verified" : "Unverified"}
              </Badge>
              {incident.verified_at && (
                <span className="text-sm text-gray-500">
                  {formatDateTime(incident.verified_at)}
                </span>
              )}
            </div>
            {!incident.is_verified && (
              <p className="mt-1 text-xs text-gray-500">
                No evidence photo yet — the SLA clock cannot start.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Reporter</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Staff never see a full legal name. staff_incidents projects the
              first name only, and the literal 'Anonymous' when the report was
              filed anonymously; read_incident_pii is Admin-only. */}
          <Field label="Name" value={incident.reporter_first_name} />
          <Field
            label="Contact Number"
            value={
              incident.reporter_phone ??
              (incident.is_anonymous ? "Withheld — anonymous report" : "—")
            }
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>SLA &amp; Routing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                SLA Status
              </p>
              <div className="mt-1 flex items-center gap-2">
                <SlaIndicator incident={incident} now={now} threshold={threshold} />
                {incident.sla_due_at && (
                  <span className="text-sm text-gray-500">
                    due {formatDateTime(incident.sla_due_at)}
                    {incident.sla_target_hours !== null &&
                      ` · ${incident.sla_target_hours}h target`}
                  </span>
                )}
              </div>
            </div>
            {/* The dossier resolved the codes; the copy for "there is no code
                at all" is this screen's, so it stays here. */}
            <Field
              label="Suggested Department"
              value={suggestedDepartmentLabel ?? "None suggested"}
            />
            <Field
              label="Assigned Department"
              value={assignedDepartmentLabel ?? "Not yet routed"}
            />
            <Field
              label="Assigned Responder"
              value={incident.assigned_responder_name ?? "Unclaimed"}
            />
          </div>
          {isRoutable(incident.status) || incident.status === "in_progress" ? (
            <RouteIncidentAction
              incident={incident}
              departments={departmentOptions}
            />
          ) : null}
          {user.is_supervisor && incident.status === "in_progress" && (
            <ForceReleaseAction incident={incident} />
          )}
          {/* Any staff member with the module, not supervisors only (l85).
              The component decides the statuses itself. */}
          <RefuseIncidentAction incident={incident} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenceStrip photos={photos} isVerified={incident.is_verified} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <IncidentTimeline events={events} />
        </CardContent>
      </Card>
    </div>
  );
}
