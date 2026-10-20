import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/portals/staff/components/ui/card";
import { BackLink } from "@/portals/staff/components/ui/back-link";
import { getReviewDossier } from "@/portals/staff/features/yellow-card/lib/review-dossier";
import { getCurrentStaffUser } from "@/portals/staff/features/auth/lib/session";
import { getFullName } from "@/portals/staff/features/yellow-card/lib/get-full-name";
import { YellowCardStatusBadge } from "@/portals/staff/features/yellow-card/components/status-badge";
import { ReviewDecisionCard } from "@/portals/staff/features/yellow-card/components/review-decision-card";
import { ViewFileButton } from "@/portals/staff/features/yellow-card/components/view-file-button";
import { formatDate, formatFileSize } from "@/portals/staff/lib/utils";

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

export default async function YellowCardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dossier = await getReviewDossier(id);

  if (!dossier) {
    notFound();
  }

  // Two reads, not one: the dossier answers "what is being looked at", the
  // session answers "who is looking", and different features own them.
  //
  // Read after the guard rather than beside it, so an id that resolves to
  // nothing still fires nothing else. That costs no latency: getMyProfileRow
  // is cache()d and the (portal) layout above has already started it in this
  // same render pass, so this awaits a promise that is already in flight.
  const user = await getCurrentStaffUser();

  const { application, documents, latestReview, genderLabel, civilStatusLabel } =
    dossier;

  return (
    <div>
      <BackLink href="/staff/yellow-card" label="Back to Yellow Card" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-lucena-blue">
            {getFullName(application)}
          </h1>
          <p className="mt-1 text-gray-500">
            {application.reference_number} · Submitted{" "}
            {formatDate(application.submitted_at)}
          </p>
        </div>
        <YellowCardStatusBadge status={application.status} />
      </div>

      <ReviewDecisionCard
        application={application}
        actorName={user.full_name}
        latestReview={latestReview}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Submitted documents</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            // Kept from the pre-l52 placeholder as the genuine empty state.
            // Post-l52 document_count excludes abandoned upload reservations,
            // so this now agrees with the list rather than contradicting it.
            <p className="text-sm text-gray-700">No documents attached.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {document.document_type_label}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {document.original_filename} · {formatFileSize(document.byte_size)}{" "}
                      · uploaded {formatDate(document.uploaded_at)}
                    </p>
                  </div>
                  <ViewFileButton documentId={document.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First Name" value={application.first_name} />
          <Field label="Middle Name" value={application.middle_name ?? "—"} />
          <Field label="Last Name" value={application.last_name} />
          <Field label="Suffix" value={application.suffix ?? "—"} />
          <Field label="Date of Birth" value={formatDate(application.date_of_birth)} />
          <Field label="Gender" value={genderLabel} />
          <Field label="Civil Status" value={civilStatusLabel} />
          <Field label="Voter ID Number" value={application.voter_id_number} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Barangay" value={application.barangay_name} />
          <Field label="Complete Address" value={application.complete_address} />
          <Field label="Contact Number" value={application.contact_number} />
          <Field label="Email Address" value={application.email_address} />
          <Field
            label="Years of Residency in Lucena"
            value={`${application.years_of_residency} years`}
          />
          <Field
            label="Data Privacy Consent"
            value={application.privacy_consent ? "Consented" : "Not consented"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
