import { AnnouncementEditor } from "@/portals/super-staff/features/announcements/components/announcement-editor";

export default async function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AnnouncementEditor id={id} />;
}
