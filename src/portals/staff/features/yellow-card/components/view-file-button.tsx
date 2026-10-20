/**
 * A link to a citizen's upload.
 *
 * Points at our own session-gated route, never at storage. A Supabase signed
 * URL is a bearer token — anyone holding it gets the bytes, incognito or not —
 * so no signed URL is ever put in front of the browser. What ships to the page
 * is a document id, which is worthless without a staff session.
 *
 * Being a plain anchor is the point: no client component, no Server Action, no
 * popup handling. The browser opens a gated URL the ordinary way.
 */
export function ViewFileButton({
  documentId,
  label = "View File",
}: {
  documentId: string;
  label?: string;
}) {
  return (
    <a
      href={`/staff/api/yellow-card/documents/${documentId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-gray-100 px-4 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lucena-blue"
    >
      {label}
    </a>
  );
}
