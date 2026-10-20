import { EventEditor } from "@/portals/super-staff/features/events/components/event-editor";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventEditor id={id} />;
}
