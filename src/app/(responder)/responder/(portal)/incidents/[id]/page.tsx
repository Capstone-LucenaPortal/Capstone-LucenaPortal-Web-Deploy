import { redirect } from "next/navigation";

/**
 * The report detail renders as the right-hand pane of the pool so the list
 * survives selection — see `/pool?report=<id>`. This route is kept as a stable
 * permalink (e.g. for a link out of the Staff portal) and forwards there.
 */
export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/responder/pool?report=${encodeURIComponent(id)}`);
}
